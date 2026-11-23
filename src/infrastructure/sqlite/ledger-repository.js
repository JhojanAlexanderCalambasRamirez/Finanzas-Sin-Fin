import { migrateDatabase } from './migrations.js';
import { DataError } from '../../application/errors.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validTransactionsWithCategories } from '../../domain/finance.js';
import { recurrenceList } from '../../domain/recurrences.js';
import { validLedger, mainAccountId } from '../../domain/ledger.js';

export { DataError } from '../../application/errors.js';

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try {
    db.exec(
      'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;',
    );
    migrateDatabase(db);
    const metadata = db.prepare('SELECT instance, revision FROM metadata WHERE id=1');
    const revision = () => {
      const value = metadata.get();
      return `${value.instance}:${value.revision}`;
    };
    const rows = (query) =>
      db
        .prepare(query)
        .all()
        .map((row) => ({ ...row }));
    const readCategories = () =>
      rows('SELECT * FROM categories ORDER BY rowid').map((item) => ({
        ...item,
        archived: !!item.archived,
      }));
    const readState = () => ({
      revision: revision(),
      accounts: rows('SELECT * FROM accounts ORDER BY rowid'),
      transactions: rows('SELECT * FROM movements ORDER BY date DESC, id'),
      transfers: rows('SELECT * FROM transfers ORDER BY date DESC, id'),
      categories: readCategories(),
      recurrences: rows('SELECT definition FROM recurrences ORDER BY rowid').map((row) =>
        JSON.parse(row.definition),
      ),
      budgets: rows('SELECT * FROM budgets ORDER BY month,category'),
      goals: rows('SELECT * FROM savings_goals ORDER BY rowid').map((goal) => ({
        ...goal,
        archived: !!goal.archived,
      })),
      contributions: rows('SELECT * FROM goal_contributions ORDER BY date,id'),
      debts: rows('SELECT definition FROM debts ORDER BY rowid').map((item) =>
        JSON.parse(item.definition),
      ),
      debtPayments: rows('SELECT * FROM debt_payments ORDER BY id'),
    });
    const legacy = (state) => ({
      revision: state.revision,
      transactions: state.transactions.map(({ accountId, ...item }) => item),
    });
    function atomicRead() {
      db.exec('BEGIN');
      try {
        const state = readState();
        db.exec('COMMIT');
        return state;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    function replaceState(state, expectedRevision) {
      if (state && state.categories === undefined)
        state = { ...state, categories: readCategories() };
      if (state && state.recurrences === undefined)
        state = { ...state, recurrences: readState().recurrences };
      if (state && state.budgets === undefined) state = { ...state, budgets: readState().budgets };
      if (state && state.goals === undefined) state = { ...state, goals: readState().goals };
      if (state && state.contributions === undefined)
        state = { ...state, contributions: readState().contributions };
      if (state && state.debts === undefined) state = { ...state, debts: readState().debts };
      if (state && state.debtPayments === undefined)
        state = { ...state, debtPayments: readState().debtPayments };
      if (!validLedger(state) || typeof expectedRevision !== 'string')
        throw new DataError('Revisa cuentas, movimientos, fechas de apertura y transferencias.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (revision() !== expectedRevision)
          throw new DataError('Los datos cambiaron en otra sesion. Recarga antes de guardar.', 409);
        const rules = recurrenceList(state);
        for (const old of readState().recurrences) {
          const rule = rules.find((item) => item.id === old.id);
          if (!rule || !old.generatedDates.every((date) => rule.generatedDates.includes(date)))
            throw new DataError(
              'No se puede borrar el registro de recurrencias generadas. Pausa la regla para detenerla.',
            );
        }
        db.exec(
          'DELETE FROM debt_payments; DELETE FROM debts; DELETE FROM goal_contributions; DELETE FROM savings_goals; DELETE FROM transfers; DELETE FROM movements; DELETE FROM accounts; DELETE FROM categories;',
        );
        const goalInsert = db.prepare(
          'INSERT INTO savings_goals (id,name,targetAmount,startDate,targetDate,archived) VALUES (?,?,?,?,?,?)',
        );
        for (const goal of state.goals)
          goalInsert.run(
            goal.id,
            goal.name,
            goal.targetAmount,
            goal.startDate,
            goal.targetDate,
            goal.archived ? 1 : 0,
          );
        const contributionInsert = db.prepare(
          'INSERT INTO goal_contributions (id,goalId,amount,date,note) VALUES (?,?,?,?,?)',
        );
        for (const item of state.contributions)
          contributionInsert.run(item.id, item.goalId, item.amount, item.date, item.note);
        const categoryInsert = db.prepare('INSERT INTO categories (name,archived) VALUES (?,?)');
        for (const category of state.categories)
          categoryInsert.run(category.name, category.archived ? 1 : 0);
        db.exec('DELETE FROM budgets;');
        const budgetInsert = db.prepare(
          'INSERT INTO budgets (id,month,category,amount) VALUES (?,?,?,?)',
        );
        for (const budget of state.budgets)
          budgetInsert.run(budget.id, budget.month, budget.category, budget.amount);
        db.exec('DELETE FROM recurrences;');
        const ruleInsert = db.prepare('INSERT INTO recurrences (id,definition) VALUES (?,?)');
        for (const rule of rules) ruleInsert.run(rule.id, JSON.stringify(rule));
        const accountInsert = db.prepare(
          'INSERT INTO accounts (id,name,type,initialBalance,initialDate) VALUES (?,?,?,?,?)',
        );
        for (const account of state.accounts)
          accountInsert.run(
            account.id,
            account.name,
            account.type,
            account.initialBalance,
            account.initialDate,
          );
        const insert = db.prepare(
          'INSERT INTO movements (id,type,description,amount,date,category,accountId) VALUES (?,?,?,?,?,?,?)',
        );
        for (const item of state.transactions)
          insert.run(
            item.id,
            item.type,
            item.description,
            item.amount,
            item.date,
            item.category,
            item.accountId,
          );
        const transferInsert = db.prepare(
          'INSERT INTO transfers (id,fromAccountId,toAccountId,description,date,amount) VALUES (?,?,?,?,?,?)',
        );
        for (const item of state.transfers)
          transferInsert.run(
            item.id,
            item.fromAccountId,
            item.toAccountId,
            item.description,
            item.date,
            item.amount,
          );
        const debtInsert = db.prepare('INSERT INTO debts (id,definition) VALUES (?,?)');
        for (const debt of state.debts) debtInsert.run(debt.id, JSON.stringify(debt));
        const paymentInsert = db.prepare(
          'INSERT INTO debt_payments (id,debtId,transactionId) VALUES (?,?,?)',
        );
        for (const payment of state.debtPayments)
          paymentInsert.run(payment.id, payment.debtId, payment.transactionId);
        db.exec('UPDATE metadata SET revision=revision+1 WHERE id=1');
        const saved = readState();
        db.exec('COMMIT');
        return saved;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return {
      readState: atomicRead,
      replaceState,
      read() {
        return legacy(atomicRead());
      },
      replace(items, expectedRevision) {
        const current = atomicRead();
        if (
          !validTransactionsWithCategories(
            items,
            current.categories.map((item) => item.name),
          )
        )
          throw new DataError('Los movimientos no son validos.');
        const ids = new Map(current.transactions.map((item) => [item.id, item.accountId]));
        const transactions = items.map((item) => ({
          ...item,
          accountId: ids.get(item.id) || mainAccountId,
        }));
        return legacy(replaceState({ ...current, transactions }, expectedRevision));
      },
      health() {
        return db.prepare('SELECT 1 AS ok').get().ok === 1;
      },
      close() {
        db.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
