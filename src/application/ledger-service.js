import { DataError } from './errors.js';
import { validLedger } from '../domain/ledger.js';

// Synchronous repository port: readState, replaceState, read, replace and health.
// The adapter owns transaction boundaries and revision checks under the same lock.
export function createLedgerService(repository) {
  return {
    readState: () => repository.readState(),
    read: () => repository.read(),
    health: () => repository.health(),
    replace: (transactions, revision) => repository.replace(transactions, revision),
    replaceState(state, revision) {
      if (!state || typeof state !== 'object' || Array.isArray(state))
        throw new DataError('Estado financiero no valido.');
      const current = repository.readState();
      const next = { ...state };
      for (const field of [
        'categories',
        'recurrences',
        'budgets',
        'goals',
        'contributions',
        'debts',
        'debtPayments',
      ]) {
        if (next[field] === undefined) next[field] = current[field];
      }
      if (!validLedger(next))
        throw new DataError('Revisa cuentas, movimientos, fechas y referencias.');
      // The adapter checks revision again while holding the write lock.
      return repository.replaceState(next, revision);
    },
  };
}
