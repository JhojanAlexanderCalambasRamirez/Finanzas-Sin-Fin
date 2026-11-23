import { categories } from '../../../domain/finance.js';
import { monthEnd } from '../../../domain/ledger.js';
import { categoryList } from '../../../domain/movement-tools.js';
import { parseMoneyInput } from '../../../domain/validation.js';
import {
  debtList,
  paymentList,
  validDebts,
  debtSummary,
  recordDebtPayment,
} from '../../../domain/debts.js';

export function createDebtsController({
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
}) {
  let editingDebtId = null;
  let paymentDebtId = null;
  const debtForm = $('#debt-form');
  const debtPaymentForm = $('#debt-payment-form');
  function renderDebts(asOf) {
    $('#debts-period').textContent =
      `Saldos y vencimientos al ${asOf.split('-').reverse().join('/')}. Los pagos futuros se ven en el historial.`;
    $('#debt-cards').replaceChildren();
    const all = new Map(debtSummary(getState(), '9999-12-31').map((debt) => [debt.id, debt]));
    const labels = {
      'not-started': 'Inicio posterior al periodo',
      active: 'Al día',
      overdue: 'Cuotas vencidas',
      paid: 'Pagada',
    };
    for (const debt of debtSummary(getState(), asOf)) {
      const card = document.createElement('article');
      card.className = `account-card debt-card ${debt.status}`;
      const title = document.createElement('h3');
      title.textContent = debt.name;
      const creditor = document.createElement('small');
      creditor.textContent = debt.creditor;
      const status = document.createElement('p');
      status.className = 'debt-status';
      status.textContent = `${debt.archived ? 'Archivada · ' : ''}${labels[debt.status]}`;
      const balance = document.createElement('strong');
      balance.textContent = money(debt.remaining);
      const detail = document.createElement('p');
      detail.textContent = `Pendiente · Total ${money(debt.amount)} · Pagado ${money(debt.paid)}`;
      const due = document.createElement('p');
      due.textContent = `Vencido ${money(debt.overdue)}${debt.firstPending ? ` · Primera cuota pendiente ${debt.firstPending.split('-').reverse().join('/')}` : ''}`;
      const actions = document.createElement('div');
      actions.className = 'budget-actions';
      const addAction = (text, action) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = text;
        button.setAttribute('aria-label', `${text}: ${debt.name}`);
        button.onclick = action;
        actions.append(button);
      };
      if (!debt.archived && all.get(debt.id).remaining > 0)
        addAction('Registrar pago', () => openDebtPayment(debt));
      addAction('Cuotas y pagos', () => openDebtHistory(debt.id));
      addAction('Editar', () => openDebt(debt));
      addAction(debt.archived ? 'Reactivar' : 'Archivar', async () => {
        if (
          await persist({
            ...getState(),
            debts: debtList(getState()).map((item) =>
              item.id === debt.id ? { ...item, archived: !item.archived } : item,
            ),
          })
        ) {
          render();
          notify('Estado de la deuda actualizado. Los pagos se conservan.');
        }
      });
      card.append(title, creditor, status, balance, detail, due, actions);
      $('#debt-cards').append(card);
    }
    if (!debtList(getState()).length) {
      const empty = document.createElement('p');
      empty.className = 'form-intro';
      empty.textContent = 'Registra una deuda para consultar cuotas y asociar tus pagos.';
      $('#debt-cards').append(empty);
    }
  }
  function openDebt(debt = null) {
    editingDebtId = debt?.id || null;
    debtForm.reset();
    $('#debt-error').textContent = '';
    $('#debt-title').textContent = debt ? 'Editar deuda' : 'Nueva deuda';
    debtForm.elements.startDate.value = today();
    debtForm.elements.firstDueDate.value = today();
    if (debt)
      for (const field of [
        'name',
        'creditor',
        'amount',
        'startDate',
        'firstDueDate',
        'installments',
      ])
        debtForm.elements[field].value = debt[field];
    $('#debt-dialog').showModal();
    debtForm.elements.name.focus();
  }
  $('#new-debt').onclick = () => openDebt();
  debtForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(debtForm);
      const previous = debtList(getState()).find((debt) => debt.id === editingDebtId);
      if (!/^\d{1,3}$/.test(data.get('installments')))
        throw new Error('Escribe un número entero de cuotas entre 1 y 360.');
      const debt = {
        id: editingDebtId || crypto.randomUUID(),
        name: data.get('name').trim(),
        creditor: data.get('creditor').trim(),
        amount: parseMoneyInput(data.get('amount')),
        startDate: data.get('startDate'),
        firstDueDate: data.get('firstDueDate'),
        installments: Number(data.get('installments')),
        archived: previous?.archived || false,
      };
      const debts = previous
        ? debtList(getState()).map((item) => (item.id === debt.id ? debt : item))
        : [...debtList(getState()), debt];
      if (!validDebts({ ...getState(), debts }))
        throw new Error(
          'Revisa nombre, acreedor, cuotas, fechas y monto. El total no puede ser menor a los pagos asociados.',
        );
      if (await persist({ ...getState(), debts })) {
        render();
        $('#debt-dialog').close();
        notify('Deuda guardada. Crear o editar la obligación no mueve dinero.');
      }
    } catch (error) {
      $('#debt-error').textContent = error.message;
    }
  };
  function syncPaymentMode() {
    const existing = debtPaymentForm.elements.mode.value === 'existing';
    $('#existing-expense-label').hidden = !existing;
    debtPaymentForm.elements.transactionId.disabled = !existing;
    debtPaymentForm.elements.transactionId.required = existing;
    $('#new-payment-fields').hidden = existing;
    $('#new-payment-fields').disabled = existing;
    const debt = debtList(getState()).find((item) => item.id === paymentDebtId);
    const account = getState().accounts.find(
      (item) => item.id === debtPaymentForm.elements.accountId.value,
    );
    if (debt)
      debtPaymentForm.elements.date.min =
        account && account.initialDate > debt.startDate ? account.initialDate : debt.startDate;
  }
  function openDebtPayment(debt) {
    paymentDebtId = debt.id;
    debtPaymentForm.reset();
    $('#debt-payment-error').textContent = '';
    const remaining = debtSummary(getState(), '9999-12-31').find(
      (item) => item.id === debt.id,
    ).remaining;
    $('#payment-debt-name').textContent =
      `${debt.name} · Pendiente incluyendo pagos futuros: ${money(remaining)}`;
    const linked = new Set(paymentList(getState()).map((item) => item.transactionId));
    const options = {
      accountId: getState().accounts.map((account) => ({ value: account.id, text: account.name })),
      category: categoryList(getState())
        .filter((category) => !category.archived)
        .map((category) => ({ value: category.name, text: category.name })),
      transactionId: getState()
        .transactions.filter(
          (item) =>
            item.type === 'expense' &&
            !linked.has(item.id) &&
            item.date >= debt.startDate &&
            item.amount <= remaining,
        )
        .map((item) => ({
          value: item.id,
          text: `${item.date} · ${item.description} · ${money(item.amount)}`,
        })),
    };
    for (const [field, values] of Object.entries(options)) {
      const select = debtPaymentForm.elements[field];
      select.replaceChildren();
      for (const item of values) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        select.append(option);
      }
    }
    if (options.category.some((item) => item.value === categories.at(-1)))
      debtPaymentForm.elements.category.value = categories.at(-1);
    debtPaymentForm.elements.date.value = today();
    debtPaymentForm.elements.description.value = `Pago: ${debt.name}`;
    syncPaymentMode();
    $('#debt-payment-dialog').showModal();
    debtPaymentForm.elements.mode.focus();
  }
  debtPaymentForm.elements.mode.onchange = syncPaymentMode;
  debtPaymentForm.elements.accountId.onchange = syncPaymentMode;
  debtPaymentForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    try {
      const data = new FormData(debtPaymentForm);
      const isNew = data.get('mode') === 'new';
      const transactionId = isNew ? crypto.randomUUID() : data.get('transactionId');
      const expense = isNew
        ? {
            id: transactionId,
            type: 'expense',
            description: data.get('description').trim(),
            amount: parseMoneyInput(data.get('amount')),
            date: data.get('date'),
            category: data.get('category'),
            accountId: data.get('accountId'),
          }
        : null;
      const next = recordDebtPayment(
        getState(),
        { id: crypto.randomUUID(), debtId: paymentDebtId, transactionId },
        expense,
      );
      if (await persist(next)) {
        render();
        $('#debt-payment-dialog').close();
        notify(
          isNew
            ? 'Pago guardado con un único gasto.'
            : 'Gasto existente asociado al pago. No se creó otro gasto.',
        );
      }
    } catch (error) {
      $('#debt-payment-error').textContent = error.message;
    }
  };
  function openDebtHistory(id) {
    const debt = debtSummary(getState(), monthEnd($('#month').value)).find(
      (item) => item.id === id,
    );
    if (!debt) return;
    $('#debt-history-title').textContent = debt.name;
    $('#debt-history-error').textContent = '';
    $('#installment-list').replaceChildren();
    $('#debt-payment-list').replaceChildren();
    const labels = {
      paid: 'Pagada',
      pending: 'Pendiente',
      due: 'Vence en la fecha de corte',
      overdue: 'Vencida',
    };
    for (const installment of debt.schedule) {
      const row = document.createElement('li');
      row.textContent = `Cuota ${installment.number} · ${installment.date.split('-').reverse().join('/')} · ${money(installment.amount)} · Pendiente ${money(installment.remaining)} · ${labels[installment.status]}`;
      $('#installment-list').append(row);
    }
    for (const payment of paymentList(getState()).filter((item) => item.debtId === id)) {
      const expense = getState().transactions.find((item) => item.id === payment.transactionId);
      const row = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${expense.date.split('-').reverse().join('/')} · ${expense.description} · ${money(expense.amount)}`;
      const actions = document.createElement('div');
      actions.className = 'budget-actions';
      const unlink = document.createElement('button');
      unlink.className = 'secondary';
      unlink.textContent = 'Desvincular';
      unlink.setAttribute('aria-label', `Desvincular pago ${expense.description}`);
      unlink.onclick = async () => {
        if (
          !confirm(
            '¿Desvincular este pago? El gasto se conserva y vuelve a aumentar el pendiente de la deuda.',
          )
        )
          return;
        if (
          await persist({
            ...getState(),
            debtPayments: paymentList(getState()).filter((item) => item.id !== payment.id),
          })
        ) {
          render();
          openDebtHistory(id);
          notify('Pago desvinculado. El gasto se conserva.');
        }
      };
      actions.append(unlink);
      row.append(text, actions);
      $('#debt-payment-list').append(row);
    }
    if (!paymentList(getState()).some((item) => item.debtId === id)) {
      const empty = document.createElement('li');
      empty.textContent = 'Sin pagos asociados.';
      $('#debt-payment-list').append(empty);
    }
    setBusy();
    if (!$('#debt-history').open) $('#debt-history').showModal();
  }

  return { render: renderDebts };
}
