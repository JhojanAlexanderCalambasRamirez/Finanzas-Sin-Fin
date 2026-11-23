import { parseMoneyInput } from '../../domain/validation.js';
export function mountFormInteractions({ isSaving }) {
  for (const input of document.querySelectorAll(
    'input[name="amount"], input[name="initialBalance"], input[name="targetAmount"]',
  )) {
    input.addEventListener('blur', () => {
      try {
        input.value = new Intl.NumberFormat('es-CO').format(
          parseMoneyInput(input.value, { signed: input.name === 'initialBalance' }),
        );
      } catch {
        /* Keep invalid input visible so the user can correct it. */
      }
    });
  }

  for (const button of document.querySelectorAll('[data-close]'))
    button.onclick = () => document.getElementById(button.dataset.close).close();
  for (const dialog of document.querySelectorAll('dialog'))
    dialog.addEventListener('cancel', (event) => {
      if (isSaving()) event.preventDefault();
    });
}
