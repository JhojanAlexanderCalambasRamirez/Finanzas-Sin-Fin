import { createFixedExpensesController } from './features/fixed-expenses/controller.js';
import { renderBusyState } from './shared/busy-state.js';
import { createLedgerStore } from './data/api-store.js';
import { createTransactionStore } from './data/legacy-store.js';
import { createLedgerSession } from './application/ledger-session.js';
import { monthEnd } from '../domain/ledger.js';
import { mountFormInteractions } from './shared/forms.js';
import { mountNavigation } from './shared/navigation.js';
import { $, money, today } from './shared/dom.js';
import { createDebtsController } from './features/debts/controller.js';
import { createGoalsController } from './features/goals/controller.js';
import { createReportsController } from './features/reports/controller.js';
import { createRecurrencesController } from './features/recurrences/controller.js';
import { createBudgetsController } from './features/budgets/controller.js';
import { createCategoriesController } from './features/categories/controller.js';
import { createAccountsController } from './features/accounts/controller.js';
import { createMovementsController } from './features/movements/controller.js';
import { createDashboardController } from './features/dashboard/controller.js';
import { createLoansController } from './features/loans/controller.js';
import { createBackupsController } from './features/backups/controller.js';

const session = createLedgerSession(createLedgerStore());
const getState = () => session.state;
const isSaving = () => session.status.saving;
const isProcessing = () => session.status.processing;
const isReady = () => session.status.ready;
const setProcessing = (value) => session.setProcessing(value);
const notify = (message) => {
  $('#notice').textContent = message;
};
const accountName = (id) =>
  getState().accounts.find((account) => account.id === id)?.name || 'Cuenta';
const clearFilters = () => movements.clearFilters();
$('#month').value = today().slice(0, 7);
let lastMonth = $('#month').value;
$('#recurrence-through').value = today();
const debts = createDebtsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  money,
  today,
  notify,
});
const goals = createGoalsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  money,
  today,
  notify,
});
const reports = createReportsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  money,
  notify,
});
const recurrences = createRecurrencesController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  accountName,
  money,
  today,
  notify,
  clearFilters,
});
const fixedExpenses = createFixedExpensesController({
  $,
  getState,
  isReady,
  isSaving,
  isProcessing,
  persist,
  render,
  notify,
  money,
  accountName,
  createRule: (month) => recurrences.openMonthlyExpense(month),
  editRule: (id) => recurrences.editRule(id),
});
const budgets = createBudgetsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  setBusy,
  money,
  notify,
});
const categories = createCategoriesController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  notify,
});
const accounts = createAccountsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  money,
  today,
  notify,
});
const movements = createMovementsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  persist,
  render,
  accountName,
  money,
  today,
  notify,
});
const dashboard = createDashboardController({ $, getState, isReady, money });
const loans = createLoansController({ $ });
const backups = createBackupsController({
  isReady,
  isSaving,
  isProcessing,
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
});
mountFormInteractions({ isSaving });
mountNavigation();
$('#reload-data').addEventListener('click', () => location.reload());

function setBusy() {
  renderBusyState(session.status, {
    pendingRecurrences: recurrences.pendingCount,
    pendingBudgets: budgets.pendingCount,
    page: movements.page,
    pageCount: movements.pageCount,
  });
}

async function persist(next) {
  try {
    const saved = await session.save(next);
    if (!saved) return false;
    notify('Cambios guardados correctamente.');
    return true;
  } catch (error) {
    const message = isReady()
      ? error.message
      : 'No se pudo confirmar el guardado. ' + error.message;
    for (const element of document.querySelectorAll('dialog [role="alert"]'))
      element.textContent = message;
    notify(message);
    return false;
  } finally {
    setBusy();
  }
}
session.subscribe(setBusy);
function render() {
  let asOf;
  try {
    asOf = monthEnd($('#month').value);
  } catch {
    $('#month').value = lastMonth;
    asOf = monthEnd(lastMonth);
    notify('Periodo inválido. Se conservó el último periodo válido.');
  }
  lastMonth = $('#month').value;
  movements.fillOptions();
  dashboard.renderSummary();
  dashboard.render();
  movements.render();
  accounts.render(asOf);
  categories.render();
  recurrences.render();
  fixedExpenses.render();
  budgets.render();
  goals.render(asOf);
  debts.render(asOf);
  reports.render();
  setBusy();
}
async function initialize() {
  setBusy();
  try {
    await session.load();
    $('.private').textContent = 'Datos cargados del servidor';
    notify('Cuentas y movimientos cargados.');
    try {
      const local = createTransactionStore(localStorage).load();
      $('#migrate').hidden = local.length === 0;
      if (local.length)
        notify(
          'Hay registros anteriores en este navegador. Puedes migrarlos a la cuenta principal.',
        );
    } catch {
      notify(
        'La base de datos está disponible. La copia local anterior no se pudo leer y se conserva sin cambios.',
      );
    }
  } catch {
    $('.private').textContent = 'Sin conexión a los datos';
    notify(
      'No se pudo conectar con la base de datos. Recarga cuando el servidor esté disponible. Los registros locales no se modificaron.',
    );
  }
  render();
}

render();
initialize();
