import { validLedger } from '../../domain/ledger.js';

const emptyState = () => ({
  accounts: [],
  categories: [],
  transactions: [],
  transfers: [],
  recurrences: [],
  budgets: [],
  goals: [],
  contributions: [],
  debts: [],
  debtPayments: [],
});

// Browser application state. No DOM, selectors or financial feature handlers.
export function createLedgerSession(store) {
  let state = emptyState();
  let ready = false;
  let saving = false;
  let processing = false;
  const listeners = new Set();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    get state() {
      return state;
    },
    get status() {
      return { ready, saving, processing };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setProcessing(value) {
      processing = Boolean(value);
      emit();
    },
    async load() {
      if (saving || processing) throw new Error('Hay una operación en curso.');
      ready = false;
      emit();
      try {
        state = await store.load();
        ready = true;
        return state;
      } finally {
        emit();
      }
    },
    async save(next) {
      if (!ready || saving) return false;
      if (!validLedger(next))
        throw new Error('Revisa cuentas, categorías, montos, fechas y referencias.');
      saving = true;
      emit();
      try {
        state = await store.save(next);
        return true;
      } catch (error) {
        ready = false;
        throw error;
      } finally {
        saving = false;
        emit();
      }
    },
  };
}
