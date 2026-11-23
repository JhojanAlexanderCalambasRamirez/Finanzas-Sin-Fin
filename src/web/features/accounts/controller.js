import { accountTypes, accountBalances, validAccount } from '../../../domain/ledger.js';
import { parseMoneyInput } from '../../../domain/validation.js';

export function createAccountsController({
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
}) {
  let editingAccountId = null;
  const accountForm = $('#account-form');
  function openAccount(account = null) {
    editingAccountId = account?.id || null;
    accountForm.reset();
    accountForm.elements.initialDate.value = today();
    $('#account-error').textContent = '';
    $('#account-title').textContent = account ? 'Editar cuenta' : 'Nueva cuenta';
    if (account)
      for (const field of ['name', 'type', 'initialBalance', 'initialDate'])
        accountForm.elements[field].value = account[field];
    $('#account-dialog').showModal();
    accountForm.elements.name.focus();
  }
  accountForm.onsubmit = async (event) => {
    event.preventDefault();
    if (isSaving() || isProcessing() || !isReady()) return;
    const data = new FormData(accountForm);
    let initialBalance;
    try {
      initialBalance = parseMoneyInput(data.get('initialBalance'), { signed: true });
    } catch (error) {
      $('#account-error').textContent = error.message;
      accountForm.elements.initialBalance.focus();
      return;
    }
    const account = {
      id: editingAccountId || crypto.randomUUID(),
      name: data.get('name').trim(),
      type: data.get('type'),
      initialBalance,
      initialDate: data.get('initialDate'),
    };
    if (!validAccount(account)) {
      $('#account-error').textContent = 'Revisa nombre, tipo, monto y fecha.';
      return;
    }
    const accounts = editingAccountId
      ? getState().accounts.map((previous) => (previous.id === account.id ? account : previous))
      : [...getState().accounts, account];
    if (await persist({ ...getState(), accounts })) {
      render();
      $('#account-dialog').close();
      notify('Cuenta guardada. Saldos actualizados.');
    }
  };

  function renderAccounts(asOf) {
    $('#accounts-period').textContent =
      `Saldos acumulados al ${asOf.split('-').reverse().join('/')}, incluidos saldos iniciales`;
    const balances = accountBalances(getState(), asOf);
    $('#total-balance').textContent = money(
      balances.reduce((sum, account) => sum + account.balance, 0),
    );
    $('#account-cards').replaceChildren();
    for (const account of balances) {
      const card = document.createElement('article');
      card.className = 'account-card';
      const label = document.createElement('small');
      label.textContent = accountTypes[account.type];
      const title = document.createElement('h3');
      title.textContent = account.name;
      const balance = document.createElement('strong');
      balance.textContent = money(account.balance);
      if (account.balance < 0) balance.className = 'negative';
      const initial = document.createElement('p');
      initial.textContent = `Inicial: ${money(account.initialBalance)} · ${account.initialDate === '0001-01-01' ? 'Desde el primer registro' : account.initialDate.split('-').reverse().join('/')}`;
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Editar cuenta';
      edit.setAttribute('aria-label', `Editar cuenta ${account.name}`);
      edit.onclick = () => openAccount(account);
      card.append(label, title, balance, initial, edit);
      $('#account-cards').append(card);
    }
  }
  $('#new-account').onclick = () => openAccount();

  return { render: renderAccounts };
}
