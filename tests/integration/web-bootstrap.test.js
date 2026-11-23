import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDomDouble } from '../helpers/dom.js';
import { defaultAccount } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';

test('frontend compone todos los controladores y el simulador responde sin variables globales implicitas', async () => {
  const html = readFileSync('src/web/index.html', 'utf8');
  const dom = createDomDouble(
    new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])),
  );
  const keys = ['document', 'window', 'localStorage', 'FormData', 'fetch', 'confirm'];
  const previous = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const initial = {
    revision: 'test:1',
    accounts: [defaultAccount()],
    categories: defaultCategories(),
    transactions: [],
    transfers: [],
    recurrences: [],
    budgets: [],
    goals: [],
    contributions: [],
    debts: [],
    debtPayments: [],
  };
  let remote = initial;
  try {
    Object.assign(globalThis, {
      document: dom.document,
      window: { addEventListener() {} },
      localStorage: { getItem: () => null },
      FormData: dom.FormData,
      confirm: () => true,
      fetch: async (_url, options = {}) => {
        if (options.method === 'PUT') remote = { ...JSON.parse(options.body), revision: 'test:2' };
        return { ok: true, json: async () => remote };
      },
    });
    await import('../../src/web/main.js');
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(dom.query('#notice').textContent, /cargados/);
    assert.equal(dom.query('#saving-rate').textContent, 'Sin ingresos');
    for (const [button, dialog] of [
      ['#new-debt', '#debt-dialog'],
      ['#new-goal', '#goal-dialog'],
      ['#new-rule', '#rule-dialog'],
      ['#new-budget', '#budget-dialog'],
      ['#new-category', '#category-dialog'],
      ['#copy-budgets', '#budget-copy-dialog'],
    ]) {
      await dom.query(button).trigger('click');
      assert.equal(dom.query(dialog).open, true, dialog);
      dom.query(dialog).close();
    }
    await dom.query('#new-account').trigger('click');
    assert.equal(dom.query('#account-dialog').open, true);
    await dom.query('#add').trigger('click');
    assert.equal(dom.query('#dialog').open, true);
    const movement = dom.query('#form');
    for (const [name, value] of Object.entries({
      type: 'income',
      description: 'Ingreso de prueba',
      amount: '500.000',
      date: '2026-11-23',
      category: 'Salario',
      accountId: 'principal',
    }))
      movement.elements[name].value = value;
    await movement.trigger('submit');
    assert.equal(remote.transactions.length, 1);
    assert.equal(remote.transactions[0].amount, 500000);
    assert.equal(dom.query('#dialog').open, false);
    await dom.query('#new-fixed-expense').trigger('click');
    const rule = dom.query('#rule-form');
    assert.equal(rule.elements.type.value, 'expense');
    assert.equal(rule.elements.frequency.value, 'monthly');
    for (const [name, value] of Object.entries({
      description: 'Transporte mensual',
      amount: '120.000',
      startDate: '2026-11-01',
      endDate: '',
      category: 'Transporte',
      accountId: 'principal',
    }))
      rule.elements[name].value = value;
    await rule.trigger('submit');
    assert.equal(remote.recurrences.length, 1);
    assert.equal(dom.query('#fixed-cards').children.length, 1);
    await dom.query('#fixed-cards').children[0].children[2].children[0].trigger('click');
    assert.equal(remote.transactions.length, 2);
    assert.match(dom.query('#fixed-summary').textContent, /Por cubrir:.*0/);
    const form = dom.query('#loan-form');
    form.elements.principal.value = '5.000.000';
    form.elements.annualRate.value = '24';
    form.elements.months.value = '24';
    await form.trigger('submit');
    assert.equal(dom.query('#loan-result').hidden, false);
    assert.equal(dom.query('#loan-rows').children.length, 24);
    form.elements.principal.value = 'abc';
    await form.trigger('submit');
    assert.equal(dom.query('#loan-result').hidden, true);
    assert.ok(dom.query('#loan-error').textContent.length > 0);
  } finally {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
