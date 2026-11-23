import { createTransactionStore, storageKey } from '../../data/legacy-store.js';
import { createLedgerStore } from '../../data/api-store.js';
import {
  mainAccountId,
  parseLedgerBackup,
  mergeLedger,
  ledgerBackup,
} from '../../../domain/ledger.js';

export function createBackupsController({
  $,
  getState,
  setProcessing,
  persist,
  render,
  setBusy,
  accountName,
  today,
  notify,
  clearFilters,
}) {
  function downloadBackup(backup, suffix = '') {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas-sin-fin${suffix}-${today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#export').onclick = async () => {
    setProcessing(true);
    setBusy();
    try {
      downloadBackup(ledgerBackup(await createLedgerStore().load()));
      notify('Respaldo preparado con cuentas, categorías, movimientos y transferencias.');
    } catch {
      notify('No se pudo preparar el respaldo actualizado. Comprueba la conexión al servidor.');
    } finally {
      setProcessing(false);
      setBusy();
    }
  };
  $('#import').onclick = () => $('#backup-file').click();
  $('#backup-file').onchange = async () => {
    const file = $('#backup-file').files[0];
    if (!file) return;
    setProcessing(true);
    setBusy();
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
      const incoming = parseLedgerBackup(await file.text());
      const next = mergeLedger(getState(), incoming);
      const fields = [
        'accounts',
        'transactions',
        'transfers',
        'categories',
        'recurrences',
        'budgets',
        'goals',
        'contributions',
        'debts',
        'debtPayments',
      ];
      const added = Object.fromEntries(
        fields.map((field) => [field, Math.max(0, next[field].length - getState()[field].length)]),
      );
      if (
        fields.every((field) => JSON.stringify(next[field]) === JSON.stringify(getState()[field]))
      ) {
        notify('El respaldo no contiene registros nuevos.');
        return;
      }
      if (
        !confirm(
          `Se integrará el respaldo: ${added.accounts} cuentas, ${added.transactions} movimientos, ${added.transfers} transferencias, ${added.categories} categorías, ${added.recurrences} reglas, ${added.budgets} presupuestos, ${added.goals} metas y ${added.contributions} aportes, ${added.debts} deudas y ${added.debtPayments} pagos adicionales. En una instalación vacía se restaurará su configuración. ¿Continuar?`,
        )
      )
        return;
      if (await persist(next)) {
        const dates = [...incoming.transactions, ...incoming.transfers]
          .map((item) => item.date)
          .sort();
        if (dates.length) $('#month').value = dates.at(-1).slice(0, 7);
        clearFilters();
        render();
        notify('Respaldo importado. Cuentas y movimientos conservados sin duplicados.');
      }
    } catch (error) {
      notify(error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message);
    } finally {
      setProcessing(false);
      $('#backup-file').value = '';
      setBusy();
    }
  };
  $('#migrate').onclick = async () => {
    setProcessing(true);
    setBusy();
    try {
      const local = createTransactionStore(localStorage).load();
      const incoming = parseLedgerBackup(
        JSON.stringify({ app: 'finanzas-sin-fin', version: 1, transactions: local }),
      );
      const next = mergeLedger(getState(), incoming);
      const added = next.transactions.length - getState().transactions.length;
      if (!added) {
        notify('Los registros locales ya están en la base de datos.');
        return;
      }
      if (
        !confirm(
          `Se preparará un respaldo y se agregarán ${added} movimientos a ${accountName(mainAccountId)}. La copia local se conservará. ¿Continuar?`,
        )
      )
        return;
      downloadBackup(
        {
          app: 'finanzas-sin-fin',
          version: 1,
          exportedAt: new Date().toISOString(),
          transactions: local,
        },
        '-antes-de-migrar',
      );
      if (await persist(next)) {
        if (local.length)
          $('#month').value = local
            .map((item) => item.date)
            .sort()
            .at(-1)
            .slice(0, 7);
        render();
        $('#migrate').hidden = true;
        notify('Migración completada. Conserva el respaldo descargado.');
      }
    } catch (error) {
      notify(`No se migraron registros. ${error.message}`);
    } finally {
      setProcessing(false);
      setBusy();
    }
  };
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null)
      notify('La copia local anterior cambió. Recarga antes de migrarla.');
  });

  return {};
}
