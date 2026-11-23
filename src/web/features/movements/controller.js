import { categories, summarize } from '../../../domain/finance.js';
import { categoryList, filterMovements } from '../../../domain/movement-tools.js';
import { parseMoneyInput, validText } from '../../../domain/validation.js';
import { paymentList, validDebts, removeTransactionWithPayment } from '../../../domain/debts.js';

export function createMovementsController({
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
}) {
  let editing = null;
  let page = 1;
  let pageCount = 1;
  const pageSize = 25;
  const form = $('#form');
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
    for (const option of form.elements.toAccountId.options)
      option.disabled = option.value === form.elements.accountId.value;
    if (form.elements.toAccountId.value === form.elements.accountId.value) {
      form.elements.toAccountId.value =
        getState().accounts.find((account) => account.id !== form.elements.accountId.value)?.id ||
        '';
    }
  }
  function fillAccountOptions() {
    for (const name of ['accountId', 'toAccountId']) {
      const select = form.elements[name];
      const previous = select.value;
      select.replaceChildren();
      for (const account of getState().accounts) {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = account.name;
        select.append(option);
      }
      if (getState().accounts.some((account) => account.id === previous)) select.value = previous;
    }
    form.elements.type.querySelector('option[value="transfer"]').disabled =
      getState().accounts.length < 2;
    syncMovementType();
  }
  function fillCategoryOptions(preferred = form.elements.category.value) {
    const select = form.elements.category;
    select.replaceChildren();
    for (const category of categoryList(getState()).filter(
      (item) => !item.archived || item.name === editing?.category,
    )) {
      const option = document.createElement('option');
      option.value = category.name;
      option.textContent = `${category.name}${category.archived ? ' (archivada)' : ''}`;
      select.append(option);
    }
    if ([...select.options].some((option) => option.value === preferred)) select.value = preferred;
  }
  function fillFilters() {
    for (const [id, values, label] of [
      [
        '#account-filter',
        getState().accounts.map((account) => ({ value: account.id, label: account.name })),
        'Todas las cuentas',
      ],
      [
        '#category-filter',
        categoryList(getState()).map((category) => ({
          value: category.name,
          label: `${category.name}${category.archived ? ' (archivada)' : ''}`,
        })),
        'Todas las categorías',
      ],
    ]) {
      const select = $(id);
      const previous = select.value;
      select.replaceChildren();
      for (const item of [{ value: '', label }, ...values]) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.append(option);
      }
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    }
  }
  function openMovement(item = null) {
    editing = item ? { id: item.id, kind: item.kind, category: item.category } : null;
    form.reset();
    fillAccountOptions();
    form.elements.date.value = item?.date || today();
    fillCategoryOptions(item?.category || categories[2]);
    $('#movement-title').textContent = item ? 'Editar movimiento' : 'Nuevo movimiento';
    $('#error').textContent = '';
    if (item) {
      for (const field of ['type', 'description', 'amount'])
        form.elements[field].value = item[field];
      form.elements.accountId.value =
        item.kind === 'transfer' ? item.fromAccountId : item.accountId;
      if (item.kind === 'transfer') form.elements.toAccountId.value = item.toAccountId;
      else form.elements.category.value = item.category;
    }
    syncMovementType();
    $('#dialog').showModal();
    form.elements.description.focus();
  }
  function updateFilters() {
    page = 1;
    $('#movements .table-wrap').scrollTop = 0;
    render();
  }
  function clearFilters() {
    page = 1;
    $('#filter').value = 'all';
    $('#account-filter').value = '';
    $('#category-filter').value = '';
    $('#search').value = '';
  }
  $('#month').onchange = updateFilters;
  $('#filter').onchange = updateFilters;
  $('#account-filter').onchange = updateFilters;
  $('#category-filter').onchange = updateFilters;
  $('#search').oninput = updateFilters;
  $('#clear-filters').onclick = () => {
    clearFilters();
    render();
  };
  $('#previous-page').onclick = () => {
    if (page > 1) {
      page--;
      render();
      $('#movements .table-wrap').scrollTop = 0;
    }
  };
  $('#next-page').onclick = () => {
    if (page < pageCount) {
      page++;
      render();
      $('#movements .table-wrap').scrollTop = 0;
    }
  };
  form.elements.type.onchange = syncMovementType;
  form.elements.accountId.onchange = syncMovementType;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    const data = new FormData(form);
    const transfer = data.get('type') === 'transfer';
    if (!validText(data.get('description'), 120)) {
      $('#error').textContent =
        'Escribe una descripción visible de hasta 120 caracteres, sin controles ocultos.';
      form.elements.description.focus();
      return;
    }
    let amount;
    try {
      amount = parseMoneyInput(data.get('amount'));
    } catch (error) {
      $('#error').textContent = error.message;
      form.elements.amount.focus();
      return;
    }
    const item = {
      id: editing?.id || crypto.randomUUID(),
      description: data.get('description').trim(),
      amount,
      date: data.get('date'),
    };
    if (transfer)
      Object.assign(item, {
        fromAccountId: data.get('accountId'),
        toAccountId: data.get('toAccountId'),
      });
    else
      Object.assign(item, {
        type: data.get('type'),
        category: data.get('category'),
        accountId: data.get('accountId'),
      });
    const next = {
      ...getState(),
      transactions: [...getState().transactions],
      transfers: [...getState().transfers],
    };
    if (editing) {
      const field = editing.kind === 'transfer' ? 'transfers' : 'transactions';
      next[field] = next[field].filter((previous) => previous.id !== editing.id);
    }
    next[transfer ? 'transfers' : 'transactions'].push(item);
    if (!validDebts(next)) {
      $('#error').textContent =
        'Este cambio afecta un pago de deuda. Revisa fecha e importe; desvincula el pago antes de cambiar su tipo. No se admiten sobrepagos.';
      return;
    }
    if (await persist(next)) {
      $('#month').value = item.date.slice(0, 7);
      clearFilters();
      render();
      $('#dialog').close();
      notify('Movimiento guardado. Saldos actualizados.');
    }
  };

  function renderMovements() {
    const visible = filterMovements(getState(), {
      month: $('#month').value,
      type: $('#filter').value,
      accountId: $('#account-filter').value,
      category: $('#category-filter').value,
      query: $('#search').value,
    });
    pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    page = Math.min(page, pageCount);
    $('#page-info').textContent = `Página ${page} de ${pageCount}`;
    $('#rows').replaceChildren();
    for (const item of visible.slice((page - 1) * pageSize, page * pageSize)) {
      const row = document.createElement('tr');
      const description = document.createElement('td');
      const title = document.createElement('strong');
      title.textContent = item.description;
      const detail = document.createElement('small');
      detail.textContent =
        item.kind === 'transfer'
          ? `Transferencia: ${accountName(item.fromAccountId)} a ${accountName(item.toAccountId)}`
          : `${item.category} · ${accountName(item.accountId)}`;
      description.append(title, detail);
      const date = document.createElement('td');
      date.textContent = new Intl.DateTimeFormat('es-CO', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(`${item.date}T12:00:00`));
      const amount = document.createElement('td');
      amount.className = `amount ${item.type}`;
      amount.textContent = `${item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '⇄'} ${money(item.amount)}`;
      const actions = document.createElement('td');
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar ${item.description}`);
      edit.onclick = () => openMovement(item);
      const remove = document.createElement('button');
      remove.className = 'delete';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Eliminar ${item.description}`);
      remove.onclick = async () => {
        const linkedPayment =
          item.kind !== 'transfer' &&
          paymentList(getState()).some((payment) => payment.transactionId === item.id);
        if (
          !confirm(
            `¿Eliminar “${item.description}”?${item.kind === 'transfer' ? ' Se revertirá su efecto en ambas cuentas.' : linkedPayment ? ' Se quitará también su asociación como pago y aumentará el pendiente de la deuda.' : ''}`,
          )
        )
          return;
        const field = item.kind === 'transfer' ? 'transfers' : 'transactions';
        const next =
          field === 'transactions'
            ? removeTransactionWithPayment(getState(), item.id)
            : {
                ...getState(),
                transfers: getState().transfers.filter((previous) => previous.id !== item.id),
              };
        if (await persist(next)) {
          render();
          notify('Movimiento eliminado.');
        }
      };
      actions.append(edit, remove);
      row.append(description, date, amount, actions);
      $('#rows').append(row);
    }
    $('#empty').hidden = visible.length > 0;
    const filteredTotals = summarize(visible);
    const transferred = visible
      .filter((item) => item.kind === 'transfer')
      .reduce((sum, item) => sum + item.amount, 0);
    $('#count').textContent =
      `${visible.length} resultados · Ingresos ${money(filteredTotals.income)} · Gastos ${money(filteredTotals.expense)} · Transferencias ${money(transferred)}`;
  }
  $('#add').onclick = () => openMovement();
  $('#first').onclick = () => openMovement();

  return {
    render: renderMovements,
    clearFilters,
    fillOptions() {
      fillAccountOptions();
      fillCategoryOptions();
      fillFilters();
    },
    get page() {
      return page;
    },
    get pageCount() {
      return pageCount;
    },
  };
}
