import { dashboardSummary } from './dashboard.js';
import { simulateLoan } from './loans.js';
import { categories, summarize } from './finance.js';
import { createTransactionStore, storageKey } from './transaction-store.js';
import { createLedgerStore } from './api-store.js';
import { accountTypes, mainAccountId, accountBalances, monthEnd, validLedger, validAccount, parseLedgerBackup, mergeLedger, ledgerBackup } from './ledger.js';
import { categoryList, saveCategory, filterMovements } from './movement-tools.js';
import { parseMoneyInput, validText, validDate } from './validation.js';
import { recurrenceList, previewRecurrences, generateRecurrences } from './recurrences.js';
import { budgetList, budgetSummary, previewBudgetCopy, copyBudgets } from './budgets.js';
import { goalList, contributionList, goalSummary, validGoals } from './goals.js';
import { debtList, paymentList, validDebts, debtSummary, recordDebtPayment, removeTransactionWithPayment } from './debts.js';
import { monthlyHistory, movementsCsv } from './reports.js';

const $ = selector => document.querySelector(selector);
const store = createLedgerStore();
let state = { accounts: [], transactions: [], transfers: [], categories: [], recurrences: [], budgets: [], goals: [], contributions: [], debts: [], debtPayments: [] };
let budgetCopyPreview = null;
let ready = false;
let saving = false;
let processing = false;
let editing = null;
let editingAccountId = null;
let editingCategory = null;
let editingRuleId = null;
let editingBudgetId = null;
let editingGoalId = null;
let editingContributionId = null;
let contributionGoalId = null;
let editingDebtId = null;
let paymentDebtId = null;
let previewDate = null;
let previewCount = 0;
let page = 1;
let pageCount = 1;
const pageSize = 25;
const form = $('#form');
const accountForm = $('#account-form');
const categoryForm = $('#category-form');
const ruleForm = $('#rule-form');
const budgetForm = $('#budget-form');
const goalForm = $('#goal-form');
const contributionForm = $('#contribution-form');
const debtForm = $('#debt-form');
const debtPaymentForm = $('#debt-payment-form');
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
const notify = message => { $('#notice').textContent = message; };
$('#month').value = today().slice(0, 7);
let lastMonth = $('#month').value;
$('#recurrence-through').value = today();

function setBusy() {
  const disabled = saving || processing || !ready;
  $('.private').textContent = saving ? 'Guardando…' : ready ? 'Datos cargados en este equipo' : 'Sin conexión confirmada';
  $('#reload-data').hidden = ready || saving;
  $('#reload-data').disabled = saving || processing;
  for (const form of document.querySelectorAll('dialog form')) form.setAttribute('aria-busy', String(saving));
  for (const button of document.querySelectorAll('#add, #first, #new-account, #new-category, #new-rule, #new-budget, #copy-budgets, #new-goal, #new-debt, #debt-cards button, #debt-payment-list button, #goal-cards button, #contribution-list button, #budget-cards button, #preview-rules, #export, #import, #migrate, #rows button, #account-cards button, #category-list button, #rule-list button, button[type="submit"]')) button.disabled = disabled;
  $('#confirm-generation').disabled = disabled || !previewCount;
  $('#confirm-budget-copy').disabled = disabled || !budgetCopyPreview?.candidates.length;
  $('#export-csv').disabled = disabled;
  $('#previous-page').disabled = disabled || page <= 1;
  $('#next-page').disabled = disabled || page >= pageCount;
  for (const button of document.querySelectorAll('[data-close]')) button.disabled = saving;
  for (const input of document.querySelectorAll('dialog input')) input.readOnly = saving;
  for (const select of document.querySelectorAll('dialog select')) {
    if (saving) { if (select.dataset.wasDisabled === undefined) select.dataset.wasDisabled = String(select.disabled); select.disabled = true; }
    else if (select.dataset.wasDisabled !== undefined) { select.disabled = select.dataset.wasDisabled === 'true'; delete select.dataset.wasDisabled; }
  }
}
async function persist(next) {
  if (saving || !ready) return false;
  if (!validLedger(next)) {
    const message = 'Revisa las cuentas, categorías, montos y fechas. Los movimientos requieren categorías existentes y fechas desde el saldo inicial. Origen y destino deben ser distintos.';
    for (const id of ['#error', '#account-error', '#category-error', '#rule-error', '#generation-error', '#budget-error', '#goal-error', '#contribution-error', '#history-error', '#debt-error', '#debt-payment-error', '#debt-history-error', '#budget-copy-error']) $(id).textContent = message;
    notify(message); return false;
  }
  saving = true; setBusy();
  try { state = await store.save(next); notify('Cambios guardados correctamente.'); return true; }
  catch (error) {
    ready = false;
    const message = `No se pudo confirmar el guardado. ${error.message}`;
    for (const id of ['#error', '#account-error', '#category-error', '#rule-error', '#generation-error', '#budget-error', '#goal-error', '#contribution-error', '#history-error', '#debt-error', '#debt-payment-error', '#debt-history-error', '#budget-copy-error']) $(id).textContent = message;
    notify(message); return false;
  } finally { saving = false; setBusy(); }
}
function accountName(id) { return state.accounts.find(account => account.id === id)?.name || 'Cuenta'; }
function syncMovementType() {
  const transfer = form.elements.type.value === 'transfer';
  $('#source-label').textContent = transfer ? 'Cuenta de origen' : 'Cuenta';
  $('#destination-label').hidden = !transfer;
  form.elements.toAccountId.disabled = !transfer;
  form.elements.toAccountId.required = transfer;
  $('#category-label').hidden = transfer;
  form.elements.category.disabled = transfer;
  form.elements.category.required = !transfer;
  $('#transfer-help').hidden = !transfer;
  for (const option of form.elements.toAccountId.options) option.disabled = option.value === form.elements.accountId.value;
  if (form.elements.toAccountId.value === form.elements.accountId.value) {
    form.elements.toAccountId.value = state.accounts.find(account => account.id !== form.elements.accountId.value)?.id || '';
  }
}
function fillAccountOptions() {
  for (const name of ['accountId', 'toAccountId']) {
    const select = form.elements[name]; const previous = select.value; select.replaceChildren();
    for (const account of state.accounts) { const option = document.createElement('option'); option.value = account.id; option.textContent = account.name; select.append(option); }
    if (state.accounts.some(account => account.id === previous)) select.value = previous;
  }
  form.elements.type.querySelector('option[value="transfer"]').disabled = state.accounts.length < 2;
  syncMovementType();
}
function fillCategoryOptions(preferred = form.elements.category.value) {
  const select = form.elements.category; select.replaceChildren();
  for (const category of categoryList(state).filter(item => !item.archived || item.name === editing?.category)) {
    const option = document.createElement('option'); option.value = category.name; option.textContent = `${category.name}${category.archived ? ' (archivada)' : ''}`; select.append(option);
  }
  if ([...select.options].some(option => option.value === preferred)) select.value = preferred;
}
function fillFilters() {
  for (const [id, values, label] of [
    ['#account-filter', state.accounts.map(account => ({ value: account.id, label: account.name })), 'Todas las cuentas'],
    ['#category-filter', categoryList(state).map(category => ({ value: category.name, label: `${category.name}${category.archived ? ' (archivada)' : ''}` })), 'Todas las categorías']
  ]) {
    const select = $(id); const previous = select.value; select.replaceChildren();
    for (const item of [{ value: '', label }, ...values]) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; select.append(option); }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
}
function renderCategoryManagement() {
  $('#category-list').replaceChildren();
  for (const category of categoryList(state)) {
    const row = document.createElement('li');
    const label = document.createElement('span'); label.textContent = category.name;
    const count = state.transactions.filter(item => item.category === category.name).length;
    const detail = document.createElement('small'); detail.textContent = `${count} movimiento${count === 1 ? '' : 's'} · ${category.archived ? 'Archivada' : 'Activa'}`; label.append(detail);
    const actions = document.createElement('div');
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Renombrar'; edit.setAttribute('aria-label', `Renombrar ${category.name}`); edit.onclick = () => openCategory(category.name);
    const archive = document.createElement('button'); archive.className = 'secondary'; archive.textContent = category.archived ? 'Reactivar' : 'Archivar'; archive.setAttribute('aria-label', `${archive.textContent} ${category.name}`);
    archive.onclick = async () => {
      const categories = categoryList(state).map(item => item.name === category.name ? { ...item, archived: !item.archived } : item);
      if (await persist({ ...state, categories })) { render(); notify(category.archived ? 'Categoría reactivada.' : 'Categoría archivada. Su historial se conserva.'); }
    };
    actions.append(edit, archive); row.append(label, actions); $('#category-list').append(row);
  }
}
function render() {
  let asOf;
  try { asOf = monthEnd($('#month').value); }
  catch { $('#month').value = lastMonth; asOf = monthEnd(lastMonth); notify('Periodo inválido. Se conservó el último periodo válido.'); }
  lastMonth = $('#month').value;
  const items = state.transactions.filter(item => item.date.startsWith($('#month').value));
  const totals = summarize(items);
  for (const field of ['income', 'expense', 'balance']) $(`#${field}`).textContent = money(totals[field]);
  $('#accounts-period').textContent = `Saldos acumulados al ${asOf.split('-').reverse().join('/')}, incluidos saldos iniciales`;
  const balances = accountBalances(state, asOf);
  $('#total-balance').textContent = money(balances.reduce((sum, account) => sum + account.balance, 0));
  $('#account-cards').replaceChildren();
  for (const account of balances) {
    const card = document.createElement('article'); card.className = 'account-card';
    const label = document.createElement('small'); label.textContent = accountTypes[account.type];
    const title = document.createElement('h3'); title.textContent = account.name;
    const balance = document.createElement('strong'); balance.textContent = money(account.balance); if (account.balance < 0) balance.className = 'negative';
    const initial = document.createElement('p'); initial.textContent = `Inicial: ${money(account.initialBalance)} · ${account.initialDate === '0001-01-01' ? 'Desde el primer registro' : account.initialDate.split('-').reverse().join('/')}`;
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar cuenta'; edit.setAttribute('aria-label', `Editar cuenta ${account.name}`); edit.onclick = () => openAccount(account);
    card.append(label, title, balance, initial, edit); $('#account-cards').append(card);
  }
  fillAccountOptions(); fillCategoryOptions(); fillFilters(); renderCategoryManagement(); renderRules(); renderBudgets(); renderGoals(asOf); renderDebts(asOf); renderReports(); renderDashboard();
  const visible = filterMovements(state, { month: $('#month').value, type: $('#filter').value, accountId: $('#account-filter').value, category: $('#category-filter').value, query: $('#search').value });
  pageCount = Math.max(1, Math.ceil(visible.length / pageSize)); page = Math.min(page, pageCount);
  $('#page-info').textContent = `Página ${page} de ${pageCount}`;
  $('#rows').replaceChildren();
  for (const item of visible.slice((page - 1) * pageSize, page * pageSize)) {
    const row = document.createElement('tr'); const description = document.createElement('td');
    const title = document.createElement('strong'); title.textContent = item.description;
    const detail = document.createElement('small'); detail.textContent = item.kind === 'transfer'
      ? `Transferencia: ${accountName(item.fromAccountId)} a ${accountName(item.toAccountId)}`
      : `${item.category} · ${accountName(item.accountId)}`;
    description.append(title, detail);
    const date = document.createElement('td'); date.textContent = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(new Date(`${item.date}T12:00:00`));
    const amount = document.createElement('td'); amount.className = `amount ${item.type}`;
    amount.textContent = `${item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '⇄'} ${money(item.amount)}`;
    const actions = document.createElement('td');
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar'; edit.setAttribute('aria-label', `Editar ${item.description}`); edit.onclick = () => openMovement(item);
    const remove = document.createElement('button'); remove.className = 'delete'; remove.textContent = '×'; remove.setAttribute('aria-label', `Eliminar ${item.description}`);
    remove.onclick = async () => {
      const linkedPayment = item.kind !== 'transfer' && paymentList(state).some(payment => payment.transactionId === item.id);
      if (!confirm(`¿Eliminar “${item.description}”?${item.kind === 'transfer' ? ' Se revertirá su efecto en ambas cuentas.' : linkedPayment ? ' Se quitará también su asociación como pago y aumentará el pendiente de la deuda.' : ''}`)) return;
      const field = item.kind === 'transfer' ? 'transfers' : 'transactions';
      const next = field === 'transactions' ? removeTransactionWithPayment(state, item.id) : { ...state, transfers: state.transfers.filter(previous => previous.id !== item.id) };
      if (await persist(next)) { render(); notify('Movimiento eliminado.'); }
    };
    actions.append(edit, remove); row.append(description, date, amount, actions); $('#rows').append(row);
  }
  $('#empty').hidden = visible.length > 0;
  const filteredTotals = summarize(visible);
  const transferred = visible.filter(item => item.kind === 'transfer').reduce((sum, item) => sum + item.amount, 0);
  $('#count').textContent = `${visible.length} resultados · Ingresos ${money(filteredTotals.income)} · Gastos ${money(filteredTotals.expense)} · Transferencias ${money(transferred)}`;
  $('#categories').replaceChildren();
  const grouped = categoryList(state).map(({ name }) => ({ name, amount: items.filter(item => item.type === 'expense' && item.category === name).reduce((sum, item) => sum + item.amount, 0) })).filter(group => group.amount).sort((a, b) => b.amount - a.amount);
  if (!grouped.length) { const empty = document.createElement('p'); empty.className = 'category-empty'; empty.textContent = 'Cuando registres gastos, aquí verás en qué categorías se concentran.'; $('#categories').append(empty); }
  for (const group of grouped) {
    const block = document.createElement('div'); block.className = 'category-item';
    const label = document.createElement('div'); const name = document.createElement('span'); name.textContent = group.name;
    const amount = document.createElement('strong'); amount.textContent = money(group.amount); label.append(name, amount);
    const track = document.createElement('div'); track.className = 'track'; const bar = document.createElement('div'); bar.style.width = `${group.amount / totals.expense * 100}%`; track.append(bar);
    block.append(label, track); $('#categories').append(block);
  }
  setBusy();
}
function openMovement(item = null) {
  editing = item ? { id: item.id, kind: item.kind, category: item.category } : null;
  form.reset(); fillAccountOptions();
  form.elements.date.value = item?.date || today();
  fillCategoryOptions(item?.category || categories[2]);
  $('#movement-title').textContent = item ? 'Editar movimiento' : 'Nuevo movimiento'; $('#error').textContent = '';
  if (item) {
    for (const field of ['type', 'description', 'amount']) form.elements[field].value = item[field];
    form.elements.accountId.value = item.kind === 'transfer' ? item.fromAccountId : item.accountId;
    if (item.kind === 'transfer') form.elements.toAccountId.value = item.toAccountId;
    else form.elements.category.value = item.category;
  }
  syncMovementType(); $('#dialog').showModal(); form.elements.description.focus();
}
function openAccount(account = null) {
  editingAccountId = account?.id || null; accountForm.reset();
  accountForm.elements.initialDate.value = today(); $('#account-error').textContent = '';
  $('#account-title').textContent = account ? 'Editar cuenta' : 'Nueva cuenta';
  if (account) for (const field of ['name', 'type', 'initialBalance', 'initialDate']) accountForm.elements[field].value = account[field];
  $('#account-dialog').showModal(); accountForm.elements.name.focus();
}
function openCategory(name = null) {
  editingCategory = name; categoryForm.reset(); categoryForm.elements.name.value = name || '';
  $('#category-title').textContent = name ? 'Renombrar categoría' : 'Nueva categoría'; $('#category-error').textContent = '';
  $('#category-dialog').showModal(); categoryForm.elements.name.focus();
}
function renderReports() {
  $('#report-rows').replaceChildren();
  for (const row of monthlyHistory(state, $('#month').value)) {
    const tr = document.createElement('tr');
    for (const field of ['month', 'income', 'expense', 'balance']) { const cell = document.createElement('td'); cell.textContent = field === 'month' ? row.month : money(row[field]); if (field !== 'month') cell.className = 'amount'; tr.append(cell); }
    $('#report-rows').append(tr);
  }
}
$('#export-csv').onclick = () => {
  if (!ready || saving || processing) return;
  const csv = movementsCsv(state, { month: $('#month').value, type: $('#filter').value, accountId: $('#account-filter').value, category: $('#category-filter').value, query: $('#search').value });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `finanzas-sin-fin-listado-${$('#month').value}.csv`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); notify('CSV preparado con los resultados del filtro actual, de todas sus páginas.');
};
function renderDebts(asOf) {
  $('#debts-period').textContent = `Saldos y vencimientos al ${asOf.split('-').reverse().join('/')}. Los pagos futuros se ven en el historial.`;
  $('#debt-cards').replaceChildren();
  const all = new Map(debtSummary(state, '9999-12-31').map(debt => [debt.id, debt]));
  const labels = { 'not-started': 'Inicio posterior al periodo', active: 'Al día', overdue: 'Cuotas vencidas', paid: 'Pagada' };
  for (const debt of debtSummary(state, asOf)) {
    const card = document.createElement('article'); card.className = `account-card debt-card ${debt.status}`;
    const title = document.createElement('h3'); title.textContent = debt.name;
    const creditor = document.createElement('small'); creditor.textContent = debt.creditor;
    const status = document.createElement('p'); status.className = 'debt-status'; status.textContent = `${debt.archived ? 'Archivada · ' : ''}${labels[debt.status]}`;
    const balance = document.createElement('strong'); balance.textContent = money(debt.remaining);
    const detail = document.createElement('p'); detail.textContent = `Pendiente · Total ${money(debt.amount)} · Pagado ${money(debt.paid)}`;
    const due = document.createElement('p'); due.textContent = `Vencido ${money(debt.overdue)}${debt.firstPending ? ` · Primera cuota pendiente ${debt.firstPending.split('-').reverse().join('/')}` : ''}`;
    const actions = document.createElement('div'); actions.className = 'budget-actions';
    const addAction = (text, action) => { const button = document.createElement('button'); button.className = 'secondary'; button.textContent = text; button.setAttribute('aria-label', `${text}: ${debt.name}`); button.onclick = action; actions.append(button); };
    if (!debt.archived && all.get(debt.id).remaining > 0) addAction('Registrar pago', () => openDebtPayment(debt));
    addAction('Cuotas y pagos', () => openDebtHistory(debt.id));
    addAction('Editar', () => openDebt(debt));
    addAction(debt.archived ? 'Reactivar' : 'Archivar', async () => {
      if (await persist({ ...state, debts: debtList(state).map(item => item.id === debt.id ? { ...item, archived: !item.archived } : item) })) { render(); notify('Estado de la deuda actualizado. Los pagos se conservan.'); }
    });
    card.append(title, creditor, status, balance, detail, due, actions); $('#debt-cards').append(card);
  }
  if (!debtList(state).length) { const empty = document.createElement('p'); empty.className = 'form-intro'; empty.textContent = 'Registra una deuda para consultar cuotas y asociar tus pagos.'; $('#debt-cards').append(empty); }
}
function openDebt(debt = null) {
  editingDebtId = debt?.id || null; debtForm.reset(); $('#debt-error').textContent = '';
  $('#debt-title').textContent = debt ? 'Editar deuda' : 'Nueva deuda';
  debtForm.elements.startDate.value = today(); debtForm.elements.firstDueDate.value = today();
  if (debt) for (const field of ['name', 'creditor', 'amount', 'startDate', 'firstDueDate', 'installments']) debtForm.elements[field].value = debt[field];
  $('#debt-dialog').showModal(); debtForm.elements.name.focus();
}
$('#new-debt').onclick = () => openDebt();
debtForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(debtForm); const previous = debtList(state).find(debt => debt.id === editingDebtId);
    if (!/^\d{1,3}$/.test(data.get('installments'))) throw new Error('Escribe un número entero de cuotas entre 1 y 360.');
    const debt = { id: editingDebtId || crypto.randomUUID(), name: data.get('name').trim(), creditor: data.get('creditor').trim(), amount: parseMoneyInput(data.get('amount')),
      startDate: data.get('startDate'), firstDueDate: data.get('firstDueDate'), installments: Number(data.get('installments')), archived: previous?.archived || false };
    const debts = previous ? debtList(state).map(item => item.id === debt.id ? debt : item) : [...debtList(state), debt];
    if (!validDebts({ ...state, debts })) throw new Error('Revisa nombre, acreedor, cuotas, fechas y monto. El total no puede ser menor a los pagos asociados.');
    if (await persist({ ...state, debts })) { render(); $('#debt-dialog').close(); notify('Deuda guardada. Crear o editar la obligación no mueve dinero.'); }
  } catch (error) { $('#debt-error').textContent = error.message; }
};
function syncPaymentMode() {
  const existing = debtPaymentForm.elements.mode.value === 'existing';
  $('#existing-expense-label').hidden = !existing; debtPaymentForm.elements.transactionId.disabled = !existing; debtPaymentForm.elements.transactionId.required = existing;
  $('#new-payment-fields').hidden = existing; $('#new-payment-fields').disabled = existing;
  const debt = debtList(state).find(item => item.id === paymentDebtId); const account = state.accounts.find(item => item.id === debtPaymentForm.elements.accountId.value);
  if (debt) debtPaymentForm.elements.date.min = account && account.initialDate > debt.startDate ? account.initialDate : debt.startDate;
}
function openDebtPayment(debt) {
  paymentDebtId = debt.id; debtPaymentForm.reset(); $('#debt-payment-error').textContent = '';
  const remaining = debtSummary(state, '9999-12-31').find(item => item.id === debt.id).remaining;
  $('#payment-debt-name').textContent = `${debt.name} · Pendiente incluyendo pagos futuros: ${money(remaining)}`;
  const linked = new Set(paymentList(state).map(item => item.transactionId));
  const options = {
    accountId: state.accounts.map(account => ({ value: account.id, text: account.name })),
    category: categoryList(state).filter(category => !category.archived).map(category => ({ value: category.name, text: category.name })),
    transactionId: state.transactions.filter(item => item.type === 'expense' && !linked.has(item.id) && item.date >= debt.startDate && item.amount <= remaining).map(item => ({ value: item.id, text: `${item.date} · ${item.description} · ${money(item.amount)}` }))
  };
  for (const [field, values] of Object.entries(options)) {
    const select = debtPaymentForm.elements[field]; select.replaceChildren();
    for (const item of values) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.text; select.append(option); }
  }
  if (options.category.some(item => item.value === categories.at(-1))) debtPaymentForm.elements.category.value = categories.at(-1);
  debtPaymentForm.elements.date.value = today(); debtPaymentForm.elements.description.value = `Pago: ${debt.name}`;
  syncPaymentMode(); $('#debt-payment-dialog').showModal(); debtPaymentForm.elements.mode.focus();
}
debtPaymentForm.elements.mode.onchange = syncPaymentMode; debtPaymentForm.elements.accountId.onchange = syncPaymentMode;
debtPaymentForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(debtPaymentForm); const isNew = data.get('mode') === 'new'; const transactionId = isNew ? crypto.randomUUID() : data.get('transactionId');
    const expense = isNew ? { id: transactionId, type: 'expense', description: data.get('description').trim(), amount: parseMoneyInput(data.get('amount')), date: data.get('date'), category: data.get('category'), accountId: data.get('accountId') } : null;
    const next = recordDebtPayment(state, { id: crypto.randomUUID(), debtId: paymentDebtId, transactionId }, expense);
    if (await persist(next)) { render(); $('#debt-payment-dialog').close(); notify(isNew ? 'Pago guardado con un único gasto.' : 'Gasto existente asociado al pago. No se creó otro gasto.'); }
  } catch (error) { $('#debt-payment-error').textContent = error.message; }
};
function openDebtHistory(id) {
  const debt = debtSummary(state, monthEnd($('#month').value)).find(item => item.id === id); if (!debt) return;
  $('#debt-history-title').textContent = debt.name; $('#debt-history-error').textContent = ''; $('#installment-list').replaceChildren(); $('#debt-payment-list').replaceChildren();
  const labels = { paid: 'Pagada', pending: 'Pendiente', due: 'Vence en la fecha de corte', overdue: 'Vencida' };
  for (const installment of debt.schedule) { const row = document.createElement('li'); row.textContent = `Cuota ${installment.number} · ${installment.date.split('-').reverse().join('/')} · ${money(installment.amount)} · Pendiente ${money(installment.remaining)} · ${labels[installment.status]}`; $('#installment-list').append(row); }
  for (const payment of paymentList(state).filter(item => item.debtId === id)) {
    const expense = state.transactions.find(item => item.id === payment.transactionId); const row = document.createElement('li');
    const text = document.createElement('span'); text.textContent = `${expense.date.split('-').reverse().join('/')} · ${expense.description} · ${money(expense.amount)}`;
    const actions = document.createElement('div'); actions.className = 'budget-actions'; const unlink = document.createElement('button'); unlink.className = 'secondary'; unlink.textContent = 'Desvincular'; unlink.setAttribute('aria-label', `Desvincular pago ${expense.description}`);
    unlink.onclick = async () => {
      if (!confirm('¿Desvincular este pago? El gasto se conserva y vuelve a aumentar el pendiente de la deuda.')) return;
      if (await persist({ ...state, debtPayments: paymentList(state).filter(item => item.id !== payment.id) })) { render(); openDebtHistory(id); notify('Pago desvinculado. El gasto se conserva.'); }
    };
    actions.append(unlink); row.append(text, actions); $('#debt-payment-list').append(row);
  }
  if (!paymentList(state).some(item => item.debtId === id)) { const empty = document.createElement('li'); empty.textContent = 'Sin pagos asociados.'; $('#debt-payment-list').append(empty); }
  setBusy(); if (!$('#debt-history').open) $('#debt-history').showModal();
}
function renderGoals(asOf) {
  $('#goals-period').textContent = `Aportes registrados al ${asOf.split('-').reverse().join('/')}. No representan saldo reservado.`;
  $('#goal-cards').replaceChildren();
  const labels = { 'not-started': 'Inicio posterior al periodo', 'in-progress': 'En progreso', completed: 'Objetivo alcanzado', overdue: 'Fecha objetivo vencida' };
  for (const goal of goalSummary(state, asOf)) {
    const card = document.createElement('article'); card.className = `account-card goal-card ${goal.status}`;
    const title = document.createElement('h3'); title.textContent = goal.name;
    const status = document.createElement('p'); status.className = 'goal-status'; status.textContent = `${goal.archived ? 'Archivada · ' : ''}${labels[goal.status]}`;
    const saved = document.createElement('strong'); saved.textContent = money(goal.saved);
    const detail = document.createElement('p'); detail.textContent = `Objetivo ${money(goal.targetAmount)} · ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(goal.percent)} %`;
    const remaining = document.createElement('p'); remaining.textContent = `Faltante ${money(goal.remaining)}${goal.targetDate ? ` · Fecha objetivo ${goal.targetDate.split('-').reverse().join('/')}` : ''}`;
    const progress = document.createElement('progress'); progress.max = 100; progress.value = Math.min(100, goal.percent); progress.setAttribute('aria-label', `Avance de ${goal.name}`);
    const actions = document.createElement('div'); actions.className = 'budget-actions';
    const addAction = (label, action) => { const button = document.createElement('button'); button.className = 'secondary'; button.textContent = label; button.setAttribute('aria-label', `${label}: ${goal.name}`); button.onclick = action; actions.append(button); };
    if (!goal.archived) addAction('Registrar aporte', () => openContribution(goal));
    addAction('Historial', () => openGoalHistory(goal.id));
    addAction('Editar', () => openGoal(goal));
    addAction(goal.archived ? 'Reactivar' : 'Archivar', async () => {
      const goals = goalList(state).map(item => item.id === goal.id ? { ...item, archived: !item.archived } : item);
      if (await persist({ ...state, goals })) { render(); notify(goal.archived ? 'Meta reactivada.' : 'Meta archivada. Sus aportes se conservan.'); }
    });
    card.append(title, status, saved, detail, progress, remaining, actions); $('#goal-cards').append(card);
  }
  if (!goalList(state).length) { const empty = document.createElement('p'); empty.className = 'form-intro'; empty.textContent = 'Crea una meta y lleva el seguimiento de tus aportes.'; $('#goal-cards').append(empty); }
}
function openGoal(goal = null) {
  editingGoalId = goal?.id || null; goalForm.reset(); $('#goal-error').textContent = '';
  $('#goal-title').textContent = goal ? 'Editar meta' : 'Nueva meta';
  goalForm.elements.startDate.value = today();
  if (goal) for (const field of ['name', 'targetAmount', 'startDate', 'targetDate']) goalForm.elements[field].value = goal[field];
  $('#goal-dialog').showModal(); goalForm.elements.name.focus();
}
$('#new-goal').onclick = () => openGoal();
goalForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(goalForm); const previous = goalList(state).find(goal => goal.id === editingGoalId);
    const goal = { id: editingGoalId || crypto.randomUUID(), name: data.get('name').trim(), targetAmount: parseMoneyInput(data.get('targetAmount')),
      startDate: data.get('startDate'), targetDate: data.get('targetDate'), archived: previous?.archived || false };
    const goals = previous ? goalList(state).map(item => item.id === goal.id ? goal : item) : [...goalList(state), goal];
    if (!validGoals({ ...state, goals })) throw new Error('Revisa nombre, objetivo y fechas. El inicio no puede ser posterior a los aportes existentes y la fecha objetivo no puede ser anterior al inicio.');
    if (await persist({ ...state, goals })) { render(); $('#goal-dialog').close(); notify('Meta guardada. Los saldos de tus cuentas no cambiaron.'); }
  } catch (error) { $('#goal-error').textContent = error.message; }
};
function openContribution(goal, item = null) {
  if (goal.archived && !item) return;
  contributionGoalId = goal.id; editingContributionId = item?.id || null; contributionForm.reset();
  $('#contribution-title').textContent = item ? 'Editar aporte' : 'Registrar aporte'; $('#contribution-goal').textContent = goal.name;
  $('#contribution-error').textContent = ''; contributionForm.elements.date.min = goal.startDate;
  contributionForm.elements.date.value = item?.date || today();
  if (item) for (const field of ['amount', 'date', 'note']) contributionForm.elements[field].value = item[field];
  if ($('#goal-history').open) $('#goal-history').close();
  $('#contribution-dialog').showModal(); contributionForm.elements.amount.focus();
}
contributionForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(contributionForm);
    const item = { id: editingContributionId || crypto.randomUUID(), goalId: contributionGoalId, amount: parseMoneyInput(data.get('amount')), date: data.get('date'), note: data.get('note').trim() };
    const contributions = editingContributionId ? contributionList(state).map(previous => previous.id === item.id ? item : previous) : [...contributionList(state), item];
    if (!validGoals({ ...state, contributions })) throw new Error('Revisa la nota, el monto y la fecha. El aporte debe corresponder a una meta existente y no ser anterior a su inicio.');
    if (await persist({ ...state, contributions })) { $('#month').value = item.date.slice(0, 7); render(); $('#contribution-dialog').close(); notify('Aporte de seguimiento guardado. No se creó un ingreso ni un gasto.'); }
  } catch (error) { $('#contribution-error').textContent = error.message; }
};
function openGoalHistory(goalId) {
  const goal = goalList(state).find(item => item.id === goalId); if (!goal) return;
  $('#goal-history-title').textContent = `Aportes: ${goal.name}`; $('#history-error').textContent = ''; $('#contribution-list').replaceChildren();
  const entries = contributionList(state).filter(item => item.goalId === goalId).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  for (const item of entries) {
    const row = document.createElement('li'); const text = document.createElement('span'); text.textContent = `${item.date.split('-').reverse().join('/')} · ${item.note} · ${money(item.amount)}`;
    const actions = document.createElement('div'); actions.className = 'budget-actions';
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar'; edit.setAttribute('aria-label', `Editar aporte ${item.note}`); edit.onclick = () => openContribution(goal, item);
    const remove = document.createElement('button'); remove.className = 'secondary'; remove.textContent = 'Eliminar'; remove.setAttribute('aria-label', `Eliminar aporte ${item.note}`);
    remove.onclick = async () => {
      if (!confirm(`¿Eliminar el aporte de seguimiento “${item.note}”? No se moverá dinero.`)) return;
      if (await persist({ ...state, contributions: contributionList(state).filter(previous => previous.id !== item.id) })) { render(); openGoalHistory(goalId); notify('Aporte de seguimiento eliminado.'); }
    };
    actions.append(edit, remove); row.append(text, actions); $('#contribution-list').append(row);
  }
  if (!entries.length) { const empty = document.createElement('li'); empty.textContent = 'Esta meta aún no tiene aportes registrados.'; $('#contribution-list').append(empty); }
  setBusy(); if (!$('#goal-history').open) $('#goal-history').showModal();
}
function renderRules() {
  $('#rule-list').replaceChildren();
  for (const rule of recurrenceList(state)) {
    const row = document.createElement('li'); const label = document.createElement('span'); label.textContent = rule.description;
    const detail = document.createElement('small'); detail.textContent = `${rule.type === 'income' ? 'Ingreso' : 'Gasto'} ${money(rule.amount)} · ${rule.frequency === 'monthly' ? 'Mensual' : 'Semanal'} · ${accountName(rule.accountId)} · ${rule.paused ? 'Pausada' : 'Activa'} · ${rule.generatedDates.length} fechas procesadas`;
    label.append(detail);
    const actions = document.createElement('div'); const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar'; edit.setAttribute('aria-label', `Editar regla ${rule.description}`); edit.onclick = () => openRule(rule);
    const pause = document.createElement('button'); pause.className = 'secondary'; pause.textContent = rule.paused ? 'Reactivar' : 'Pausar'; pause.setAttribute('aria-label', `${pause.textContent} regla ${rule.description}`);
    pause.onclick = async () => {
      const recurrences = recurrenceList(state).map(item => item.id === rule.id ? { ...item, paused: !item.paused } : item);
      if (await persist({ ...state, recurrences })) { render(); notify(rule.paused ? 'Regla reactivada. Revisa sus fechas pendientes antes de registrarlas.' : 'Regla pausada. Sus movimientos anteriores se conservan.'); }
    };
    actions.append(edit, pause); row.append(label, actions); $('#rule-list').append(row);
  }
  if (!recurrenceList(state).length) { const empty = document.createElement('li'); empty.textContent = 'Crea una regla para tu salario, arriendo u otros movimientos habituales.'; $('#rule-list').append(empty); }
}
function renderBudgets() {
  const summaries = budgetSummary(state, $('#month').value);
  const limit = summaries.reduce((sum, budget) => sum + budget.amount, 0);
  const spent = summaries.reduce((sum, budget) => sum + budget.spent, 0);
  const budgeted = new Set(summaries.map(budget => budget.category));
  const unbudgeted = state.transactions.filter(item => item.type === 'expense' && item.date.startsWith($('#month').value) && !budgeted.has(item.category)).reduce((sum, item) => sum + item.amount, 0);
  $('#budget-summary').textContent = `Periodo ${$('#month').value} · Límites ${money(limit)} · Gastado en categorías con límite ${money(spent)} · Gastos sin límite ${money(unbudgeted)}`;
  $('#budget-cards').replaceChildren();
  const labels = { ok: 'Dentro del límite', warning: 'Atención: 80 % o más', reached: 'Límite alcanzado', exceeded: 'Límite superado' };
  for (const budget of summaries) {
    const card = document.createElement('article'); card.className = `account-card budget-card ${budget.status}`;
    const title = document.createElement('h3'); title.textContent = budget.category;
    const status = document.createElement('p'); status.className = 'budget-status'; status.textContent = labels[budget.status];
    const value = document.createElement('strong'); value.textContent = money(budget.spent);
    const detail = document.createElement('p'); detail.textContent = `De ${money(budget.amount)} · ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(budget.percent)} % usado`;
    const remaining = document.createElement('p'); remaining.textContent = budget.remaining < 0 ? `Exceso: ${money(-budget.remaining)}` : `Disponible: ${money(budget.remaining)}`;
    const progress = document.createElement('progress'); progress.max = 100; progress.value = Math.min(100, budget.percent); progress.setAttribute('aria-label', `Consumo del presupuesto ${budget.category}`);
    const actions = document.createElement('div'); actions.className = 'budget-actions';
    const edit = document.createElement('button'); edit.className = 'secondary'; edit.textContent = 'Editar'; edit.setAttribute('aria-label', `Editar límite ${budget.category}`); edit.onclick = () => openBudget(budget);
    const remove = document.createElement('button'); remove.className = 'secondary'; remove.textContent = 'Quitar límite'; remove.setAttribute('aria-label', `Quitar límite ${budget.category}`);
    remove.onclick = async () => {
      if (!confirm(`¿Quitar el límite de ${budget.category} para ${budget.month}? Los movimientos se conservarán.`)) return;
      if (await persist({ ...state, budgets: budgetList(state).filter(item => item.id !== budget.id) })) { render(); notify('Límite eliminado. Los gastos se conservan.'); }
    };
    actions.append(edit, remove); card.append(title, status, value, detail, progress, remaining, actions); $('#budget-cards').append(card);
  }
  if (!summaries.length) {
    const empty = document.createElement('p'); empty.className = 'form-intro'; empty.textContent = 'Este mes aún no tiene límites. Crea uno para empezar a comparar tus gastos.'; $('#budget-cards').append(empty);
  }
}
function openBudget(budget = null) {
  editingBudgetId = budget?.id || null; budgetForm.reset(); $('#budget-error').textContent = '';
  $('#budget-title').textContent = budget ? 'Editar límite mensual' : 'Nuevo límite mensual';
  budgetForm.elements.month.value = budget?.month || $('#month').value;
  const select = budgetForm.elements.category; select.replaceChildren();
  for (const category of categoryList(state).filter(item => !item.archived || item.name === budget?.category)) {
    const option = document.createElement('option'); option.value = category.name; option.textContent = `${category.name}${category.archived ? ' (archivada)' : ''}`; select.append(option);
  }
  if (budget) { select.value = budget.category; budgetForm.elements.amount.value = budget.amount; }
  $('#budget-dialog').showModal(); budgetForm.elements.amount.focus();
}
$('#new-budget').onclick = () => openBudget();
budgetForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(budgetForm);
    const budget = { id: editingBudgetId || crypto.randomUUID(), month: data.get('month'), category: data.get('category'), amount: parseMoneyInput(data.get('amount')) };
    if (!validDate(`${budget.month}-01`) || !categoryList(state).some(category => category.name === budget.category)) throw new Error('Selecciona un mes y una categoría válidos.');
    if (budgetList(state).some(item => item.id !== budget.id && item.month === budget.month && item.category === budget.category)) throw new Error('Ya existe un límite para esa categoría y mes. Edita el límite existente.');
    const budgets = editingBudgetId ? budgetList(state).map(item => item.id === editingBudgetId ? budget : item) : [...budgetList(state), budget];
    if (await persist({ ...state, budgets })) { $('#month').value = budget.month; render(); $('#budget-dialog').close(); notify('Presupuesto guardado. Los avisos se actualizan con tus gastos registrados.'); }
  } catch (error) { $('#budget-error').textContent = error.message; }
};
function openRule(rule = null) {
  editingRuleId = rule?.id || null; ruleForm.reset(); $('#rule-error').textContent = '';
  $('#rule-title').textContent = rule ? 'Editar regla recurrente' : 'Nueva regla recurrente';
  for (const [name, options] of [
    ['accountId', state.accounts.map(account => ({ value: account.id, label: account.name }))],
    ['category', categoryList(state).filter(category => !category.archived || category.name === rule?.category).map(category => ({ value: category.name, label: `${category.name}${category.archived ? ' (archivada)' : ''}` }))]
  ]) {
    const select = ruleForm.elements[name]; select.replaceChildren();
    for (const option of options) { const element = document.createElement('option'); element.value = option.value; element.textContent = option.label; select.append(element); }
  }
  ruleForm.elements.startDate.value = today();
  if (rule) for (const field of ['type', 'description', 'amount', 'accountId', 'category', 'frequency', 'startDate', 'endDate']) ruleForm.elements[field].value = rule[field];
  $('#rule-dialog').showModal(); ruleForm.elements.description.focus();
}
$('#new-rule').onclick = () => openRule();
ruleForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const data = new FormData(ruleForm); const previous = recurrenceList(state).find(rule => rule.id === editingRuleId);
    const rule = { id: editingRuleId || crypto.randomUUID(), type: data.get('type'), description: data.get('description').trim(), amount: parseMoneyInput(data.get('amount')),
      accountId: data.get('accountId'), category: data.get('category'), frequency: data.get('frequency'), startDate: data.get('startDate'), endDate: data.get('endDate'),
      paused: previous?.paused || false, generatedDates: previous?.generatedDates || [] };
    const recurrences = previous ? recurrenceList(state).map(item => item.id === rule.id ? rule : item) : [...recurrenceList(state), rule];
    if (!validLedger({ ...state, recurrences })) throw new Error('Revisa descripción, cuenta, categoría, fechas y límite de reglas. El inicio debe ser desde la apertura de la cuenta y el fin no puede ser anterior al inicio.');
    if (await persist({ ...state, recurrences })) { render(); $('#rule-dialog').close(); notify('Regla guardada. Revisa pendientes para crear sus movimientos.'); }
  } catch (error) { $('#rule-error').textContent = error.message; }
};
$('#preview-rules').onclick = () => {
  previewCount = 0; previewDate = null;
  try {
    const through = $('#recurrence-through').value;
    if (!validDate(through)) throw new Error('Selecciona una fecha de corte válida.');
    const preview = previewRecurrences(state, through); previewDate = through; previewCount = preview.entries.length;
    const totals = summarize(preview.entries.map(item => item.transaction));
    $('#preview-summary').textContent = `${previewCount} movimientos hasta ${through.split('-').reverse().join('/')}. Ingresos: ${money(totals.income)}. Gastos: ${money(totals.expense)}. Solo se guardarán al pulsar Registrar pendientes.`;
    $('#preview-warnings').textContent = preview.blocked.map(item => item.reason).join(' ');
    $('#generation-error').textContent = ''; $('#preview-list').replaceChildren();
    for (const entry of preview.entries) {
      const row = document.createElement('li'); row.textContent = `${entry.date.split('-').reverse().join('/')} · ${entry.transaction.description} · ${accountName(entry.transaction.accountId)} · ${money(entry.transaction.amount)}`; $('#preview-list').append(row);
    }
    setBusy(); $('#preview-dialog').showModal();
  } catch (error) { notify(error.message); $('#recurrence-through').focus(); setBusy(); }
};
$('#confirm-generation').onclick = async () => {
  if (!previewDate || !previewCount || saving || processing || !ready) return;
  try {
    const count = previewCount; const through = previewDate;
    if (await persist(generateRecurrences(state, through))) {
      $('#month').value = through.slice(0, 7); clearFilters(); previewCount = 0; render(); $('#preview-dialog').close(); notify(`${count} movimientos recurrentes registrados. Sus fechas no se volverán a generar.`);
    }
  } catch (error) { $('#generation-error').textContent = error.message; }
};
for (const input of document.querySelectorAll('input[name="amount"], input[name="initialBalance"], input[name="targetAmount"]')) {
  input.addEventListener('blur', () => {
    try { input.value = new Intl.NumberFormat('es-CO').format(parseMoneyInput(input.value, { signed: input.name === 'initialBalance' })); }
    catch { /* Keep invalid input visible so the user can correct it. */ }
  });
}
$('#new-category').onclick = () => openCategory();
$('#add').onclick = () => openMovement(); $('#first').onclick = () => openMovement(); $('#new-account').onclick = () => openAccount();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => document.getElementById(button.dataset.close).close();
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
function updateFilters() { page = 1; $('#movements .table-wrap').scrollTop = 0; render(); }
function clearFilters() { page = 1; $('#filter').value = 'all'; $('#account-filter').value = ''; $('#category-filter').value = ''; $('#search').value = ''; }
$('#month').onchange = updateFilters; $('#filter').onchange = updateFilters;
$('#account-filter').onchange = updateFilters; $('#category-filter').onchange = updateFilters; $('#search').oninput = updateFilters;
$('#clear-filters').onclick = () => { clearFilters(); render(); };
$('#previous-page').onclick = () => { if (page > 1) { page--; render(); $('#movements .table-wrap').scrollTop = 0; } };
$('#next-page').onclick = () => { if (page < pageCount) { page++; render(); $('#movements .table-wrap').scrollTop = 0; } };
form.elements.type.onchange = syncMovementType; form.elements.accountId.onchange = syncMovementType;
form.onsubmit = async event => {
  event.preventDefault();
  if (saving || processing || !ready) return;
  const data = new FormData(form); const transfer = data.get('type') === 'transfer';
  if (!validText(data.get('description'), 120)) { $('#error').textContent = 'Escribe una descripción visible de hasta 120 caracteres, sin controles ocultos.'; form.elements.description.focus(); return; }
  let amount;
  try { amount = parseMoneyInput(data.get('amount')); }
  catch (error) { $('#error').textContent = error.message; form.elements.amount.focus(); return; }
  const item = { id: editing?.id || crypto.randomUUID(), description: data.get('description').trim(), amount, date: data.get('date') };
  if (transfer) Object.assign(item, { fromAccountId: data.get('accountId'), toAccountId: data.get('toAccountId') });
  else Object.assign(item, { type: data.get('type'), category: data.get('category'), accountId: data.get('accountId') });
  const next = { ...state, transactions: [...state.transactions], transfers: [...state.transfers] };
  if (editing) { const field = editing.kind === 'transfer' ? 'transfers' : 'transactions'; next[field] = next[field].filter(previous => previous.id !== editing.id); }
  next[transfer ? 'transfers' : 'transactions'].push(item);
  if (!validDebts(next)) { $('#error').textContent = 'Este cambio afecta un pago de deuda. Revisa fecha e importe; desvincula el pago antes de cambiar su tipo. No se admiten sobrepagos.'; return; }
  if (await persist(next)) {
    $('#month').value = item.date.slice(0, 7); clearFilters(); render(); $('#dialog').close(); notify('Movimiento guardado. Saldos actualizados.');
  }
};
accountForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return; const data = new FormData(accountForm);
  let initialBalance;
  try { initialBalance = parseMoneyInput(data.get('initialBalance'), { signed: true }); }
  catch (error) { $('#account-error').textContent = error.message; accountForm.elements.initialBalance.focus(); return; }
  const account = { id: editingAccountId || crypto.randomUUID(), name: data.get('name').trim(), type: data.get('type'), initialBalance, initialDate: data.get('initialDate') };
  if (!validAccount(account)) { $('#account-error').textContent = 'Revisa nombre, tipo, monto y fecha.'; return; }
  const accounts = editingAccountId ? state.accounts.map(previous => previous.id === account.id ? account : previous) : [...state.accounts, account];
  if (await persist({ ...state, accounts })) { render(); $('#account-dialog').close(); notify('Cuenta guardada. Saldos actualizados.'); }
};
categoryForm.onsubmit = async event => {
  event.preventDefault(); if (saving || processing || !ready) return;
  try {
    const name = categoryForm.elements.name.value.trim();
    const next = saveCategory(state, editingCategory, name);
    if (await persist(next)) {
      if ($('#category-filter').value === editingCategory) { const option = $('#category-filter').selectedOptions[0]; option.value = name; }
      render(); $('#category-dialog').close(); notify(editingCategory ? 'Categoría renombrada en todos sus movimientos.' : 'Categoría creada.');
    }
  } catch (error) { $('#category-error').textContent = error.message; }
};
function downloadBackup(backup, suffix = '') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `finanzas-sin-fin${suffix}-${today()}.json`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export').onclick = async () => {
  processing = true; setBusy();
  try { downloadBackup(ledgerBackup(await createLedgerStore().load())); notify('Respaldo preparado con cuentas, categorías, movimientos y transferencias.'); }
  catch { notify('No se pudo preparar el respaldo actualizado. Comprueba la conexión al servidor.'); }
  finally { processing = false; setBusy(); }
};
$('#import').onclick = () => $('#backup-file').click();
$('#backup-file').onchange = async () => {
  const file = $('#backup-file').files[0]; if (!file) return;
  processing = true; setBusy();
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('El archivo supera el límite de 5 MB.');
    const incoming = parseLedgerBackup(await file.text()); const next = mergeLedger(state, incoming);
    const fields = ['accounts', 'transactions', 'transfers', 'categories', 'recurrences', 'budgets', 'goals', 'contributions', 'debts', 'debtPayments'];
    const added = Object.fromEntries(fields.map(field => [field, Math.max(0, next[field].length - state[field].length)]));
    if (fields.every(field => JSON.stringify(next[field]) === JSON.stringify(state[field]))) { notify('El respaldo no contiene registros nuevos.'); return; }
    if (!confirm(`Se integrará el respaldo: ${added.accounts} cuentas, ${added.transactions} movimientos, ${added.transfers} transferencias, ${added.categories} categorías, ${added.recurrences} reglas, ${added.budgets} presupuestos, ${added.goals} metas y ${added.contributions} aportes, ${added.debts} deudas y ${added.debtPayments} pagos adicionales. En una instalación vacía se restaurará su configuración. ¿Continuar?`)) return;
    if (await persist(next)) {
      const dates = [...incoming.transactions, ...incoming.transfers].map(item => item.date).sort(); if (dates.length) $('#month').value = dates.at(-1).slice(0, 7);
      clearFilters(); render(); notify('Respaldo importado. Cuentas y movimientos conservados sin duplicados.');
    }
  } catch (error) { notify(error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message); }
  finally { processing = false; $('#backup-file').value = ''; setBusy(); }
};
$('#migrate').onclick = async () => {
  processing = true; setBusy();
  try {
    const local = createTransactionStore(localStorage).load();
    const incoming = parseLedgerBackup(JSON.stringify({ app: 'finanzas-sin-fin', version: 1, transactions: local }));
    const next = mergeLedger(state, incoming); const added = next.transactions.length - state.transactions.length;
    if (!added) { notify('Los registros locales ya están en la base de datos.'); return; }
    if (!confirm(`Se preparará un respaldo y se agregarán ${added} movimientos a ${accountName(mainAccountId)}. La copia local se conservará. ¿Continuar?`)) return;
    downloadBackup({ app: 'finanzas-sin-fin', version: 1, exportedAt: new Date().toISOString(), transactions: local }, '-antes-de-migrar');
    if (await persist(next)) {
      if (local.length) $('#month').value = local.map(item => item.date).sort().at(-1).slice(0, 7);
      render(); $('#migrate').hidden = true; notify('Migración completada. Conserva el respaldo descargado.');
    }
  } catch (error) { notify(`No se migraron registros. ${error.message}`); }
  finally { processing = false; setBusy(); }
};
async function initialize() {
  setBusy();
  try {
    state = await store.load(); ready = true; $('.private').textContent = 'Guardado en este equipo'; notify('Cuentas y movimientos cargados.');
    try {
      const local = createTransactionStore(localStorage).load(); $('#migrate').hidden = local.length === 0;
      if (local.length) notify('Hay registros anteriores en este navegador. Puedes migrarlos a la cuenta principal.');
    } catch { notify('La base de datos está disponible. La copia local anterior no se pudo leer y se conserva sin cambios.'); }
  } catch { $('.private').textContent = 'Sin conexión a los datos'; notify('No se pudo conectar con la base de datos. Recarga cuando el servidor esté disponible. Los registros locales no se modificaron.'); }
  render();
}
window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) notify('La copia local anterior cambió. Recarga antes de migrarla.'); });
let navigationFrame = false;
function updateNavigation() {
  const links = [...document.querySelectorAll('.sidebar .nav')]; let active = links[0];
  for (const link of links) {
    const section = document.getElementById(link.hash.slice(1));
    if (section && section.getBoundingClientRect().top <= 160) active = link;
  }
  for (const link of links) {
    link.classList.toggle('active', link === active);
    if (link === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', () => {
  if (navigationFrame) return; navigationFrame = true;
  requestAnimationFrame(() => { updateNavigation(); navigationFrame = false; });
}, { passive: true });
render(); initialize();
updateNavigation();

$('#loan-form').addEventListener('submit', event => {
  event.preventDefault(); $('#loan-error').textContent = ''; $('#loan-result').hidden = true;
  try {
    const data = new FormData(event.currentTarget);
    const result = simulateLoan({ principal: parseMoneyInput(data.get('principal')), annualRate: Number(data.get('annualRate')), months: Number(data.get('months')) });
    const format = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
    $('#loan-summary').textContent = 'Cuota inicial: ' + format(result.payment) + ' · Total: ' + format(result.total) + ' · Intereses: ' + format(result.interest) + '. La última cuota ajusta el redondeo.';
    const rows = result.schedule.map(item => { const row = document.createElement('tr'); for (const value of [item.month, format(item.payment), format(item.interest), format(item.capital), format(item.balance)]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } return row; });
    $('#loan-rows').replaceChildren(...rows); $('#loan-result').hidden = false;
  } catch (error) { $('#loan-error').textContent = error.message; }
});

function renderDashboard() {
  if (!ready) {
    for (const id of ['#saving-rate', '#expense-change', '#pending-debt']) $(id).textContent = '—';
    $('#dashboard-alerts').replaceChildren(); $('#dashboard-empty').textContent = 'Conecta con tus datos para consultar alertas y comparaciones.'; return;
  }
  const result = dashboardSummary(state, $('#month').value);
  $('#saving-rate').textContent = result.savingRate === null ? 'Sin ingresos' : new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(result.savingRate) + ' %';
  $('#expense-change').textContent = result.expenseChange === null ? 'Sin periodo anterior' : result.expenseChange === 0 ? 'Sin variación' : (result.expenseChange > 0 ? '+ ' : '− ') + money(Math.abs(result.expenseChange));
  $('#comparison-period').textContent = result.previous ? 'Respecto a ' + result.previous.month + '. Incluye movimientos futuros ya registrados.' : 'No hay un mes anterior válido para comparar.';
  $('#pending-debt').textContent = money(result.pendingDebt);
  $('#overdue-total').textContent = 'Cuotas vencidas al cierre: ' + money(result.overdue) + '. Excluye deudas archivadas.';
  $('#dashboard-alerts').replaceChildren(...result.alerts.map(alert => {
    const li = document.createElement('li'); li.className = 'priority ' + alert.kind;
    const link = document.createElement('a'); link.href = alert.target; link.textContent = alert.title + ': ' + alert.message + ' Ver detalle'; li.append(link); return li;
  }));
  $('#dashboard-empty').textContent = result.alerts.length ? '' : result.hasMovements ? 'Sin alertas de presupuesto, cuotas o saldos negativos para este periodo.' : 'Empieza creando tus cuentas y registrando un movimiento. Las alertas aparecerán aquí.';
}
$('#reload-data').addEventListener('click', () => location.reload());

$('#loan-form').addEventListener('input', () => { $('#loan-result').hidden = true; $('#loan-error').textContent = ''; });

$('#copy-budgets').addEventListener('click', () => {
  if (!ready || saving || processing) return;
  const history = monthlyHistory(state, $('#month').value, 2);
  if (history.length < 2) { notify('No hay un mes anterior válido para copiar.'); return; }
  budgetCopyPreview = previewBudgetCopy(state, history[0].month, $('#month').value);
  $('#budget-copy-error').textContent = '';
  $('#budget-copy-summary').textContent = 'De ' + budgetCopyPreview.sourceMonth + ' a ' + budgetCopyPreview.targetMonth + ': ' + budgetCopyPreview.candidates.length + ' límite(s) para copiar. Omitidos: ' + budgetCopyPreview.skipped + '. Si no hay candidatos, crea un límite o selecciona otro periodo.';
  $('#budget-copy-list').replaceChildren(...budgetCopyPreview.candidates.map(item => { const li = document.createElement('li'); li.textContent = item.category + ': ' + money(item.amount); return li; }));
  setBusy(); $('#budget-copy-dialog').showModal();
});
$('#confirm-budget-copy').addEventListener('click', async () => {
  if (!ready || saving || processing || !budgetCopyPreview?.candidates.length) return;
  try {
    const preview = budgetCopyPreview;
    const next = copyBudgets(state, preview.sourceMonth, preview.targetMonth, () => crypto.randomUUID());
    if (await persist(next)) { $('#budget-copy-dialog').close(); render(); notify('Límites copiados. Los gastos y límites existentes se conservaron.'); }
  } catch (error) { $('#budget-copy-error').textContent = error.message; }
});
$('#budget-copy-dialog').addEventListener('close', () => { budgetCopyPreview = null; setBusy(); });
