import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessGuard } from '../../src/server/access.js';
import { serverConfig } from '../../src/server/config.js';
import { localRequest } from '../../src/server/http/protocol.js';

test('configuracion LAN exige TLS y hosts exactos; conserva arranque local y contenedor', () => {
  assert.equal(serverConfig({}).host, '127.0.0.1');
  assert.equal(serverConfig({ HOST: '0.0.0.0' }).tls, false);
  assert.throws(
    () => serverConfig({ HOST: '0.0.0.0', TLS_KEY_PATH: 'key', TLS_CERT_PATH: 'cert' }),
    /ALLOWED_HOSTS/,
  );
  assert.throws(() => serverConfig({ ALLOWED_HOSTS: '192.168.1.50:3081' }), /HTTPS/);
  assert.throws(() =>
    serverConfig({
      ALLOWED_HOSTS: '192.168.1.50:3081/path',
      TLS_KEY_PATH: 'x',
      TLS_CERT_PATH: 'y',
    }),
  );
  assert.throws(() => serverConfig({ PORT: 'abc' }));
  assert.throws(() => createAccessGuard({ allowedHosts: ['pc'], password: 'short' }));
  assert.throws(() => localRequest({ headers: { host: 'evil:3081' }, url: '/' }, ['pc:3081']));
  assert.equal(localRequest({ headers: { host: 'pc:3081' }, url: '/' }, ['pc:3081']).path, '/');
});
test('acceso compartido rechaza HTTP y credenciales incorrectas; limita intentos', () => {
  const password = 'test-password-123456';
  const headers = {};
  const guard = createAccessGuard({ allowedHosts: ['pc:3081'], password });
  const response = {
    setHeader: (key, value) => {
      headers[key] = value;
    },
  };
  const request = { headers: {}, socket: { encrypted: false, remoteAddress: 'test' } };
  assert.throws(
    () => guard(request, response),
    (error) => error.status === 403,
  );
  request.socket.encrypted = true;
  assert.throws(
    () => guard(request, response),
    (error) => error.status === 401,
  );
  assert.ok(headers['WWW-Authenticate']);
  request.headers.authorization = 'Basic ' + Buffer.from('finanzas:' + password).toString('base64');
  assert.doesNotThrow(() => guard(request, response));
  delete request.headers.authorization;
  for (let index = 0; index < 10; index++)
    assert.throws(
      () => guard(request, response),
      (error) => error.status === 401,
    );
  assert.throws(
    () => guard(request, response),
    (error) => error.status === 429,
  );
});
