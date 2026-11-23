import { monthlyHistory, movementsCsv } from '../../../domain/reports.js';

export function createReportsController({
  $,
  getState,
  isSaving,
  isProcessing,
  isReady,
  money,
  notify,
}) {
  function renderReports() {
    $('#report-rows').replaceChildren();
    for (const row of monthlyHistory(getState(), $('#month').value)) {
      const tr = document.createElement('tr');
      for (const field of ['month', 'income', 'expense', 'balance']) {
        const cell = document.createElement('td');
        cell.textContent = field === 'month' ? row.month : money(row[field]);
        if (field !== 'month') cell.className = 'amount';
        tr.append(cell);
      }
      $('#report-rows').append(tr);
    }
  }
  $('#export-csv').onclick = () => {
    if (!isReady() || isSaving() || isProcessing()) return;
    const csv = movementsCsv(getState(), {
      month: $('#month').value,
      type: $('#filter').value,
      accountId: $('#account-filter').value,
      category: $('#category-filter').value,
      query: $('#search').value,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas-sin-fin-listado-${$('#month').value}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('CSV preparado con los resultados del filtro actual, de todas sus páginas.');
  };

  return { render: renderReports };
}
