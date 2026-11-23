import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDomDouble } from '../helpers/dom.js';
import { defaultAccount } from '../../src/domain/ledger.js';
import { defaultCategories } from '../../src/domain/movement-tools.js';

test('login muestra alta inicial y carga la aplicacion solo al autenticar', async () => {
  const html = readFileSync('src/web/index.html', 'utf8');
  const dom = createDomDouble(
    new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])),
  );
  dom.document.documentElement = { dataset: {} };
  const keys = ['document', 'window', 'localStorage', 'FormData', 'fetch'];
  const previous = new Map(
    keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const profile = { id: 'owner', username: 'owner', displayName: 'Propietario', role: 'admin' };
  let financialReads = 0;
  let submitted;
  try {
    Object.assign(globalThis, {
      document: dom.document,
      window: { addEventListener() {} },
      localStorage: { getItem: () => null },
      FormData: dom.FormData,
      fetch: async (url, options = {}) => {
        let data;
        if (url === '/api/auth/status') data = { setupRequired: true, profile: null };
        else if (url === '/api/auth/setup') {
          submitted = JSON.parse(options.body);
          data = { profile };
        } else if (url === '/api/profiles')
          data =
            options.method === 'POST'
              ? { profile: { id: 'member', ...JSON.parse(options.body), role: 'member' } }
              : { profiles: [profile] };
        else if (url === '/api/profiles/me') {
          Object.assign(profile, JSON.parse(options.body));
          data = { profile };
        } else if (url === '/api/profiles/password') data = { profile };
        else if (url === '/api/state') {
          financialReads++;
          data = {
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
        } else throw Error('Solicitud inesperada ' + url);
        return { ok: true, json: async () => data };
      },
    });
    await import('../../src/web/auth.js');
    assert.match(dom.query('#auth-title').textContent, /primer perfil/);
    assert.equal(financialReads, 0);
    dom.query('#auth-username').value = 'owner';
    dom.query('#auth-name').value = 'Propietario';
    dom.query('#auth-password').value = 'test-owner-password';
    await dom.query('#auth-form').trigger('submit');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(submitted.username, 'owner');
    assert.equal(dom.query('#auth-password').value, '');
    assert.equal(dom.query('#app-shell').hidden, false);
    assert.equal(dom.query('#auth-screen').hidden, true);
    assert.equal(financialReads, 1);
    assert.match(dom.query('#signed-in-name').textContent, /owner/);
    assert.equal(dom.query('#profile-admin').hidden, false);
    dom.query('#profile-current-name').value = 'Nombre actualizado';
    dom.query('#profile-current-username').value = 'owner';
    await dom.query('#profile-name-form').trigger('submit');
    assert.match(dom.query('#profile-message').textContent, /actualizado/);
    dom.query('#profile-old-password').value = 'test-owner-password';
    dom.query('#profile-new-password').value = 'new-owner-password';
    await dom.query('#profile-password-form').trigger('submit');
    assert.match(dom.query('#profile-message').textContent, /Contraseña actualizada/);
    dom.query('#profile-create-name').value = 'Otro perfil';
    dom.query('#profile-create-username').value = 'member';
    dom.query('#profile-create-password').value = 'test-member-password';
    await dom.query('#profile-create-form').trigger('submit');
    assert.match(dom.query('#profile-message').textContent, /Perfil creado/);
  } finally {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
