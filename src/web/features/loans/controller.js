import { simulateLoan } from '../../../domain/loans.js';
import { parseMoneyInput } from '../../../domain/validation.js';

export function createLoansController({ $ }) {
  $('#loan-form').addEventListener('submit', (event) => {
    event.preventDefault();
    $('#loan-error').textContent = '';
    $('#loan-result').hidden = true;
    try {
      const data = new FormData(event.currentTarget);
      const result = simulateLoan({
        principal: parseMoneyInput(data.get('principal')),
        annualRate: Number(data.get('annualRate')),
        months: Number(data.get('months')),
      });
      const format = (value) =>
        new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(value);
      $('#loan-summary').textContent =
        'Cuota inicial: ' +
        format(result.payment) +
        ' · Total: ' +
        format(result.total) +
        ' · Intereses: ' +
        format(result.interest) +
        '. La última cuota ajusta el redondeo.';
      const rows = result.schedule.map((item) => {
        const row = document.createElement('tr');
        for (const value of [
          item.month,
          format(item.payment),
          format(item.interest),
          format(item.capital),
          format(item.balance),
        ]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        return row;
      });
      $('#loan-rows').replaceChildren(...rows);
      $('#loan-result').hidden = false;
    } catch (error) {
      $('#loan-error').textContent = error.message;
    }
  });

  $('#loan-form').addEventListener('input', () => {
    $('#loan-result').hidden = true;
    $('#loan-error').textContent = '';
  });

  return {};
}
