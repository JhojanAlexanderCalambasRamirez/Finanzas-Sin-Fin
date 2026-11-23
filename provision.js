import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';

export const defaultDatabasePath = fileURLToPath(new URL('./data/finanzas.sqlite', import.meta.url));

// El mismo aprovisionamiento se ejecuta al iniciar el servidor. No siembra finanzas ficticias.
export function provisionDatabase(filename = process.env.DATABASE_PATH || defaultDatabasePath) {
  const database = openDatabase(filename === ':memory:' ? filename : resolve(filename));
  try {
    const state = database.readState();
    return { ready: database.health(), accounts: state.accounts.length, categories: state.categories.length,
      transactions: state.transactions.length, revision: state.revision };
  } finally { database.close(); }
}
