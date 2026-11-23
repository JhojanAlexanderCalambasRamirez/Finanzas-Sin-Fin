import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { openDatabase } from '../../src/infrastructure/sqlite/ledger-repository.js';
import { createHandler } from '../../src/server/http/handler.js';

test('HTTPS compartido protege datos y acepta escrituras autenticadas del mismo origen', async () => {
  const database = openDatabase(':memory:');
  const cert = readFileSync('tests/fixtures/test-only-cert.pem');
  const server = https.createServer(
    { key: readFileSync('tests/fixtures/test-only-key.pem'), cert },
    createHandler(database, {
      allowedHosts: ['finanzas-pc:3081'],
      username: 'finanzas',
      password: 'test-password-123456',
    }),
  );
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `https://127.0.0.1:${server.address().port}`;
    const request = (
      path,
      authenticated = false,
      payload = null,
      origin = 'https://finanzas-pc:3081',
    ) =>
      new Promise((resolve, reject) => {
        const headers = { host: 'finanzas-pc:3081' };
        if (authenticated)
          headers.authorization =
            'Basic ' + Buffer.from('finanzas:test-password-123456').toString('base64');
        if (payload) {
          headers['content-type'] = 'application/json';
          headers.origin = origin;
        }
        const req = https.request(
          base + path,
          { ca: cert, method: payload ? 'PUT' : 'GET', headers },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve({ status: res.statusCode, body }));
          },
        );
        req.on('error', reject);
        req.end(payload ? JSON.stringify(payload) : undefined);
      });
    assert.equal((await request('/api/state')).status, 401);
    assert.equal((await request('/')).status, 401);
    const state = JSON.parse((await request('/api/state', true)).body);
    const next = {
      ...state,
      transactions: [
        {
          id: 'lan-income',
          type: 'income',
          description: 'Ingreso LAN',
          category: 'Salario',
          accountId: 'principal',
          amount: 100000,
          date: '2026-11-23',
        },
      ],
    };
    assert.equal((await request('/api/state', true, next, 'http://finanzas-pc:3081')).status, 403);
    assert.equal(database.readState().transactions.length, 0);
    assert.equal((await request('/api/state', true, next)).status, 200);
    assert.equal(
      JSON.parse((await request('/api/state', true)).body).transactions[0].amount,
      100000,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    database.close();
  }
});
