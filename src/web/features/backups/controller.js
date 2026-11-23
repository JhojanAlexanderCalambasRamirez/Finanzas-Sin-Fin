import { prepareImport } from '../../../domain/import-plan.js';
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
  isReady,
  isSaving,
  isProcessing,
}) {
  let pendingImport = null;
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
      notify(
        'Archivo completo preparado: todos los meses, cuentas, movimientos, reglas, presupuestos, metas, deudas y pagos.',
      );
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
    if (!file || !isReady() || isSaving() || isProcessing()) return;
    setProcessing(true);
    $('#import-feedback').textContent = '';
    pendingImport = null;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MB.');
      const text = await file.text();
      const plan = prepareImport(getState(), text);
      if (!plan.changed) {
        $('#import-feedback').textContent =
          'Este respaldo ya está cargado. No hay cambios que importar.';
        return;
      }
      pendingImport = { text, baseline: JSON.stringify(getState()) };
      $('#import-file-name').textContent = file.name;
      $('#import-preview-rows').replaceChildren(
        ...plan.rows.map((item) => {
          const row = document.createElement('tr');
          for (const value of [item.label, item.current, item.incoming, item.result]) {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.append(cell);
          }
          return row;
        }),
      );
      $('#import-result-balance').textContent =
        'Saldo total resultante, incluidos registros futuros: ' +
        new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(plan.totalBalance);
      $('#import-preview-error').textContent = '';
      $('#import-preview-dialog').showModal();
    } catch (error) {
      $('#import-feedback').textContent =
        error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message;
    } finally {
      $('#backup-file').value = '';
      setProcessing(false);
      setBusy();
    }
  };
  $('#confirm-import').addEventListener('click', async () => {
    if (!pendingImport || !isReady() || isSaving() || isProcessing()) return;
    if (JSON.stringify(getState()) !== pendingImport.baseline) {
      $('#import-preview-error').textContent =
        'Los datos cambiaron. Cancela y selecciona de nuevo el respaldo para revisar las cantidades.';
      return;
    }
    setProcessing(true);
    try {
      const plan = prepareImport(getState(), pendingImport.text);
      downloadBackup(ledgerBackup(getState()), '-antes-de-importar');
      if (await persist(plan.next)) {
        $('#import-preview-dialog').close();
        if (plan.lastDate) $('#month').value = plan.lastDate.slice(0, 7);
        clearFilters();
        render();
        $('#import-feedback').textContent =
          'Datos cargados correctamente. Se conservaron los registros existentes sin duplicados.';
        notify('Importación completada.');
      }
    } catch (error) {
      $('#import-preview-error').textContent = error.message;
    } finally {
      setProcessing(false);
      setBusy();
    }
  });
  $('#import-preview-dialog').addEventListener('close', () => {
    pendingImport = null;
  });
  $('#migrate').onclick = async () => {
    if (document.documentElement?.dataset.profileRole !== 'admin') return;
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
