import { fixedExpensesSummary, recordFixedExpense } from '../../../domain/fixed-expenses.js';

export function createFixedExpensesController({
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
  createRule,
  editRule,
}) {
  $('#new-fixed-expense').addEventListener('click', () => {
    if (isReady() && !isSaving() && !isProcessing()) createRule($('#month').value);
  });
  function renderFixedExpenses() {
    const month = $('#month').value;
    const summary = fixedExpensesSummary(getState(), month);
    $('#fixed-summary').textContent =
      `Plan ${month}: ${money(summary.planned)} · Registrado: ${money(summary.recorded)} · Por cubrir: ${money(summary.pending)}`;
    const labels = {
      pending: 'Por registrar',
      recorded: 'Gasto registrado',
      partial: 'Importe registrado menor al plan',
      missing: 'Registro eliminado o cambiado de fecha/tipo: revisar',
      blocked: 'Categoría archivada',
      collision: 'Identificador ocupado: revisar',
    };
    $('#fixed-cards').replaceChildren(
      ...summary.rows.map((row) => {
        const card = document.createElement('article');
        card.className = 'account-card fixed-card';
        const title = document.createElement('h3');
        title.textContent = row.name;
        const detail = document.createElement('p');
        detail.textContent = `${labels[row.status]}. Fecha prevista: ${row.date}. ${accountName(row.accountId)} · ${row.category}. Plan: ${money(row.expected)}. Registrado: ${money(row.recorded)}. Pendiente: ${money(row.remaining)}.`;
        const actions = document.createElement('footer');
        if (row.status === 'pending') {
          const record = document.createElement('button');
          record.type = 'button';
          record.className = 'secondary';
          record.textContent = 'Registrar gasto del mes';
          record.setAttribute('aria-label', `Registrar gasto del mes: ${row.name}`);
          record.onclick = async () => {
            if (!isReady() || isSaving() || isProcessing()) return;
            if (
              !confirm(
                `Se registrará ${row.name}: ${money(row.expected)}, con fecha ${row.date}, en ${accountName(row.accountId)}. Si ya lo ingresaste manualmente, cancela para no duplicarlo. ¿Continuar?`,
              )
            )
              return;
            try {
              if (await persist(recordFixedExpense(getState(), row.ruleId, month))) {
                render();
                notify(
                  'Gasto fijo registrado una sola vez. La generación de recurrencias no lo repetirá.',
                );
              }
            } catch (error) {
              notify(error.message);
            }
          };
          actions.append(record);
        }
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'secondary';
        edit.textContent = 'Editar regla';
        edit.setAttribute('aria-label', `Editar regla: ${row.name}`);
        edit.onclick = () => {
          if (isReady() && !isSaving() && !isProcessing()) editRule(row.ruleId);
        };
        actions.append(edit);
        const movements = document.createElement('a');
        movements.href = '#movements';
        movements.textContent = 'Revisar movimientos';
        actions.append(movements);
        card.append(title, detail, actions);
        return card;
      }),
    );
    $('#fixed-empty').hidden = summary.rows.length > 0;
  }
  return { render: renderFixedExpenses };
}
