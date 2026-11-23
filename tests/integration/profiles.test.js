import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openProfileRegistry } from '../../src/infrastructure/sqlite/profile-registry.js';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { passwords } from '../../src/infrastructure/security/passwords.js';
import { tokens } from '../../src/infrastructure/security/tokens.js';
import { createIdentityService } from '../../src/application/identity-service.js';
import { createProfileHandler } from '../../src/server/http/profile-handler.js';
import { invoke } from '../helpers/http.js';

test('perfiles conservan datos anteriores, aislan finanzas, protegen roles y revocan sesiones', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-profiles-'));
  let registry;
  try {
    const file = join(directory, 'finance.sqlite');
    const legacy = openDatabase(file);
    const state = legacy.readState();
    legacy.replaceState(
      {
        ...state,
        transactions: [
          {
            id: 'old-income',
            type: 'income',
            description: 'Ingreso anterior',
            amount: 500000,
            category: 'Salario',
            date: '2026-11-23',
            accountId: 'principal',
          },
        ],
      },
      state.revision,
    );
    legacy.close();
    registry = openProfileRegistry(file);
    let identity = createIdentityService({ registry, passwords, tokens });
    let handler = createProfileHandler(identity);
    const call = (url, method = 'GET', body, cookie = '') =>
      invoke(handler, {
        url,
        method,
        headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? '' : JSON.stringify(body),
      });
    assert.equal((await call('/api/state')).status, 401);
    assert.equal((await call('/api/transactions')).status, 401);
    assert.equal((await call('/api/profiles')).status, 401);
    assert.equal((await call('/api/auth/status')).status, 200);
    const setup = await call('/api/auth/setup', 'POST', {
      username: 'Owner',
      displayName: 'Dueño',
      password: 'test-owner-password',
    });
    assert.equal(setup.status, 200);
    const owner = setup.headers['Set-Cookie'].split(';')[0];
    assert.match(setup.headers['Set-Cookie'], /HttpOnly/);
    assert.match(setup.headers['Set-Cookie'], /SameSite=Strict/);
    assert.equal(
      JSON.parse((await call('/api/state', 'GET', undefined, owner)).body).transactions[0].amount,
      500000,
    );

    assert.equal(
      (
        await call('/api/auth/setup', 'POST', {
          username: 'other',
          displayName: 'Otro',
          password: 'test-owner-password',
        })
      ).status,
      409,
    );
    const created = await call(
      '/api/profiles',
      'POST',
      { username: 'member', displayName: 'Perfil independiente', password: 'test-member-password' },
      owner,
    );
    assert.equal(created.status, 201);
    assert.equal(JSON.parse(created.body).profile.role, 'member');
    const memberId = JSON.parse(created.body).profile.id;
    const login = await call('/api/auth/login', 'POST', {
      username: 'member',
      password: 'test-member-password',
    });
    const member = login.headers['Set-Cookie'].split(';')[0];
    const memberState = JSON.parse((await call('/api/state', 'GET', undefined, member)).body);
    assert.equal(memberState.transactions.length, 0);
    assert.equal(
      JSON.parse((await call('/api/state?profile=owner', 'GET', undefined, member)).body)
        .transactions.length,
      0,
    );
    assert.equal((await call('/api/profiles', 'GET', undefined, member)).status, 403);
    assert.equal(
      (
        await call(
          '/api/profiles',
          'POST',
          { username: 'third', displayName: 'Tercero', password: 'test-third-password' },
          member,
        )
      ).status,
      403,
    );
    memberState.transactions.push({
      id: 'member-income',
      type: 'income',
      description: 'Ingreso propio',
      amount: 100000,
      category: 'Salario',
      accountId: 'principal',
      date: '2026-11-23',
    });
    assert.equal((await call('/api/state', 'PUT', memberState, member)).status, 200);
    assert.equal(
      JSON.parse((await call('/api/state', 'GET', undefined, owner)).body).transactions[0].amount,
      500000,
    );
    assert.equal(
      (
        await call(
          '/api/profiles/me',
          'PATCH',
          { displayName: 'Nuevo nombre', username: 'member2' },
          member,
        )
      ).status,
      200,
    );
    assert.equal(
      (await call('/api/profiles/me', 'PATCH', { displayName: 'Otro', username: 'owner' }, member))
        .status,
      409,
    );
    assert.equal(
      JSON.parse((await call('/api/state', 'GET', undefined, member)).body).transactions[0].amount,
      100000,
    );
    assert.equal((await call('/api/profiles/password', 'POST', null, owner)).status, 403);
    assert.equal((await call('/api/state', 'GET', undefined, owner)).status, 200);
    assert.equal(
      (await call('/api/profiles/' + memberId + '/status', 'PATCH', { disabled: true }, owner))
        .status,
      200,
    );
    assert.equal((await call('/api/state', 'GET', undefined, member)).status, 401);
    assert.equal(
      (await call('/api/profiles/' + memberId + '/status', 'PATCH', { disabled: false }, owner))
        .status,
      200,
    );
    assert.equal(
      (await call('/api/state', 'GET', undefined, member)).status,
      401,
      'Reactivar no revive sesiones antiguas',
    );
    const changed = await call(
      '/api/profiles/password',
      'POST',
      { currentPassword: 'test-owner-password', password: 'new-owner-password' },
      owner,
    );
    assert.equal(changed.status, 200);
    assert.equal((await call('/api/state', 'GET', undefined, owner)).status, 401);
    const newCookie = changed.headers['Set-Cookie'].split(';')[0];
    const listing = await call('/api/profiles', 'GET', undefined, newCookie);
    assert.ok(!listing.body.includes('passwordHash'));
    assert.ok(!listing.body.includes('salt'));
    registry.close();
    registry = openProfileRegistry(file);
    identity = createIdentityService({ registry, passwords, tokens });
    handler = createProfileHandler(identity);
    assert.equal(
      (await call('/api/state', 'GET', undefined, newCookie)).status,
      200,
      'La sesion persiste al reiniciar',
    );
    assert.equal((await call('/api/auth/logout', 'POST', {}, newCookie)).status, 200);
    assert.equal((await call('/api/state', 'GET', undefined, newCookie)).status, 401);
  } finally {
    registry?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('alta inicial concurrente crea un solo administrador y las sesiones vencidas se rechazan', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-setup-'));
  let registry;
  try {
    const file = join(directory, 'finance.sqlite');
    registry = openProfileRegistry(file);
    const handler = createProfileHandler(createIdentityService({ registry, passwords, tokens }));
    const results = await Promise.all(
      ['first', 'second'].map((username) =>
        invoke(handler, {
          url: '/api/auth/setup',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username,
            displayName: username,
            password: 'test-owner-password',
          }),
        }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(registry.count(), 1);
    const cookie = results
      .find((result) => result.status === 200)
      .headers['Set-Cookie'].split(';')[0];
    const connection = new DatabaseSync(join(directory, 'finance.sqlite.profiles.sqlite'));
    const stored = connection.prepare('SELECT tokenHash FROM sessions').get();
    assert.notEqual(stored.tokenHash, cookie.split('=')[1]);
    connection.prepare('UPDATE sessions SET expires=?').run(Date.now() - 1);
    connection.close();
    assert.equal((await invoke(handler, { url: '/api/state', headers: { cookie } })).status, 401);
  } finally {
    registry?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('login rechaza datos invalidos y limita intentos sin exponer credenciales', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-login-'));
  let registry;
  try {
    registry = openProfileRegistry(join(directory, 'db.sqlite'));
    const handler = createProfileHandler(createIdentityService({ registry, passwords, tokens }));
    const post = (body) =>
      invoke(handler, {
        url: '/api/auth/login',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    for (let index = 0; index < 10; index++) {
      const result = await post({ username: 'missing', password: 123 });
      assert.equal(result.status, 401);
      assert.match(result.body, /incorrectos/);
    }
    assert.equal((await post({ username: 'missing', password: 123 })).status, 429);
  } finally {
    registry?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
