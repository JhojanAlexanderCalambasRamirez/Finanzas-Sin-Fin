import { validTransactions } from '../../domain/finance.js';
import { validLedger } from '../../domain/ledger.js';
import { categoryList } from '../../domain/movement-tools.js';
import { recurrenceList } from '../../domain/recurrences.js';
import { budgetList } from '../../domain/budgets.js';
import { goalList, contributionList } from '../../domain/goals.js';
import { debtList, paymentList } from '../../domain/debts.js';

export function createApiStore(request = globalThis.fetch.bind(globalThis), options = {}) {
  const path = options.path || '/api/transactions';
  const valid = options.valid || ((data) => validTransactions(data.transactions));
  const select = options.select || ((data) => data.transactions);
  const payload = options.payload || ((transactions) => ({ transactions }));
  let revision;
  let uncertain = false;
  let busy = false;
  async function readResponse(response) {
    if (response.status === 401) globalThis.dispatchEvent?.(new Event('finanzas:unauthorized'));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la solicitud.');
    if (typeof data.revision !== 'string' || !valid(data))
      throw new Error('La respuesta del servidor no es valida.');
    return data;
  }
  return {
    async load() {
      if (busy) throw new Error('Espera a que termine la operacion actual.');
      busy = true;
      revision = undefined;
      try {
        const data = await readResponse(
          await request(path, { cache: 'no-store', signal: AbortSignal.timeout(15000) }),
        );
        revision = data.revision;
        uncertain = false;
        return select(data);
      } finally {
        busy = false;
      }
    },
    async save(transactions) {
      if (!revision || uncertain)
        throw new Error('Recarga la pagina para consultar los datos antes de guardar.');
      if (busy) throw new Error('Espera a que termine el guardado actual.');
      if (!valid(payload(transactions)))
        throw new Error('Revisa los datos, las cuentas y sus fechas de apertura.');
      busy = true;
      try {
        const data = await readResponse(
          await request(path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ ...payload(transactions), revision }),
          }),
        );
        revision = data.revision;
        return select(data);
      } catch (error) {
        uncertain = true;
        throw new Error(
          `${error.message} Recarga para comprobar el estado guardado antes de reintentar.`,
        );
      } finally {
        busy = false;
      }
    },
  };
}

export function createLedgerStore(request) {
  return createApiStore(request, {
    path: '/api/state',
    valid: validLedger,
    select: (state) => ({
      accounts: state.accounts,
      transactions: state.transactions,
      transfers: state.transfers,
      categories: categoryList(state),
      recurrences: recurrenceList(state),
      budgets: budgetList(state),
      goals: goalList(state),
      contributions: contributionList(state),
      debts: debtList(state),
      debtPayments: paymentList(state),
    }),
    payload: (state) => state,
  });
}
