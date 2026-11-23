import { randomUUID } from 'node:crypto';
import { defaultAccount, mainAccountId } from '../../domain/ledger.js';
import { defaultCategories } from '../../domain/movement-tools.js';

export function migrateDatabase(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 7)
    throw new Error('La base de datos requiere una version mas reciente de la aplicacion.');
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), instance TEXT NOT NULL, revision INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS movements (
          id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')),
          description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0 AND amount<=1000000000000),
          date TEXT NOT NULL, category TEXT NOT NULL
        ) STRICT;`);
    db.prepare('INSERT OR IGNORE INTO metadata VALUES (1, ?, 0)').run(randomUUID());
    db.exec('PRAGMA user_version=1; COMMIT;');
  }
  if (version < 2) {
    db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
          initialBalance INTEGER NOT NULL, initialDate TEXT NOT NULL) STRICT;
        ALTER TABLE movements ADD COLUMN accountId TEXT REFERENCES accounts(id);
        CREATE TABLE transfers (id TEXT PRIMARY KEY NOT NULL, fromAccountId TEXT NOT NULL REFERENCES accounts(id),
          toAccountId TEXT NOT NULL REFERENCES accounts(id), description TEXT NOT NULL, date TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK(amount>0 AND amount<=1000000000000), CHECK(fromAccountId<>toAccountId)) STRICT;`);
    const initial = defaultAccount();
    db.prepare('INSERT INTO accounts VALUES (?,?,?,?,?)').run(
      initial.id,
      initial.name,
      initial.type,
      initial.initialBalance,
      initial.initialDate,
    );
    db.prepare('UPDATE movements SET accountId=?').run(mainAccountId);
    db.exec('UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=2; COMMIT;');
  }
  if (version < 3) {
    db.exec(
      'BEGIN IMMEDIATE; CREATE TABLE categories (name TEXT PRIMARY KEY NOT NULL, archived INTEGER NOT NULL CHECK(archived IN (0,1))) STRICT;',
    );
    const insert = db.prepare('INSERT INTO categories (name,archived) VALUES (?,0)');
    for (const category of defaultCategories()) insert.run(category.name);
    db.exec(
      'INSERT OR IGNORE INTO categories (name,archived) SELECT DISTINCT category,0 FROM movements; UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=3; COMMIT;',
    );
  }
  if (version < 4) {
    db.exec(
      'BEGIN IMMEDIATE; CREATE TABLE recurrences (id TEXT PRIMARY KEY NOT NULL, definition TEXT NOT NULL CHECK(json_valid(definition))) STRICT; UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=4; COMMIT;',
    );
  }
  if (version < 5) {
    db.exec(
      'BEGIN IMMEDIATE; CREATE TABLE budgets (id TEXT PRIMARY KEY NOT NULL, month TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0 AND amount<=1000000000000), UNIQUE(month,category)) STRICT; UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=5; COMMIT;',
    );
  }
  if (version < 6) {
    db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE savings_goals (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, targetAmount INTEGER NOT NULL CHECK(targetAmount>0 AND targetAmount<=1000000000000), startDate TEXT NOT NULL, targetDate TEXT NOT NULL, archived INTEGER NOT NULL CHECK(archived IN (0,1))) STRICT;
        CREATE TABLE goal_contributions (id TEXT PRIMARY KEY NOT NULL, goalId TEXT NOT NULL REFERENCES savings_goals(id), amount INTEGER NOT NULL CHECK(amount>0 AND amount<=1000000000000), date TEXT NOT NULL, note TEXT NOT NULL) STRICT;
        UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=6; COMMIT;`);
  }
  if (version < 7) {
    db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE debts (id TEXT PRIMARY KEY NOT NULL, definition TEXT NOT NULL CHECK(json_valid(definition))) STRICT;
        CREATE TABLE debt_payments (id TEXT PRIMARY KEY NOT NULL, debtId TEXT NOT NULL REFERENCES debts(id), transactionId TEXT NOT NULL UNIQUE REFERENCES movements(id)) STRICT;
        UPDATE metadata SET revision=revision+1 WHERE id=1; PRAGMA user_version=7; COMMIT;`);
  }
}
