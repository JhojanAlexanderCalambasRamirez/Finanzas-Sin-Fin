import { validTransactions } from '../../domain/finance.js';

export const storageKey = 'finanzas-sin-fin.transactions.v1';

export function createTransactionStore(storage) {
  let snapshot;
  let loaded = false;
  return {
    load() {
      loaded = false;
      snapshot = storage.getItem(storageKey);
      const items = snapshot === null ? [] : JSON.parse(snapshot);
      if (!validTransactions(items)) throw new Error('Los registros guardados no son validos. Se bloquearon los cambios para conservarlos.');
      loaded = true;
      return items;
    },
    save(items) {
      if (!loaded) throw new Error('No se pudieron leer los registros originales. No se guardaran cambios.');
      if (!validTransactions(items)) throw new Error('Los movimientos contienen datos invalidos o identificadores duplicados.');
      if (storage.getItem(storageKey) !== snapshot) {
        throw new Error('Los registros cambiaron en otra pestana. Recarga la pagina antes de continuar.');
      }
      const next = JSON.stringify(items);
      storage.setItem(storageKey, next);
      snapshot = next;
    }
  };
}
