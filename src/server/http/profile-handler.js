import { DataError } from '../../application/errors.js';
import { publicProfile } from '../../application/identity-service.js';
import { createHandler } from './handler.js';
import { localRequest, readJson, sendJson } from './protocol.js';

const cookieName = 'finanzas_session';
function sessionToken(request) {
  const match = (request.headers.cookie || '').match(
    /(?:^|;\s*)finanzas_session=([A-Za-z0-9_-]{43})(?:;|$)/,
  );
  return match?.[1] || '';
}
function cookie(response, token, request) {
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? 43200 : 0}${request.socket?.encrypted ? '; Secure' : ''}`,
  );
}

export function createProfileHandler(identity) {
  const publicHandler = createHandler({ health: identity.health });
  const attempts = new Map();
  return async (request, response) => {
    try {
      const { path, host } = localRequest(request);
      if (path === '/health') return await publicHandler(request, response);
      const token = sessionToken(request);
      const actor = identity.current(token);
      if (path === '/api/auth/status' && request.method === 'GET')
        return sendJson(response, 200, {
          setupRequired: identity.setupRequired(),
          profile: actor ? publicProfile(actor) : null,
        });
      if (['/api/auth/setup', '/api/auth/login'].includes(path) && request.method === 'POST') {
        const data = await readJson(request, host);
        const ip = request.socket?.remoteAddress || 'local';
        const now = Date.now();
        let entry = attempts.get(ip);
        if (!entry || now - entry.since >= 300000) entry = { count: 0, since: now };
        if (entry.count >= 10) {
          response.setHeader('Retry-After', '300');
          throw new DataError('Demasiados intentos. Espera cinco minutos.', 429);
        }
        if (attempts.size >= 1000 && !attempts.has(ip))
          attempts.delete(attempts.keys().next().value);
        entry.count++;
        attempts.set(ip, entry);
        const result = await (path.endsWith('/setup')
          ? identity.setup(data)
          : identity.login(data));
        attempts.delete(ip);
        cookie(response, result.token, request);
        return sendJson(response, 200, { profile: result.profile });
      }
      if (path.startsWith('/api/')) {
        if (!actor) throw new DataError('Inicia sesión para continuar.', 401);
        if (path === '/api/auth/logout' && request.method === 'POST') {
          await readJson(request, host);
          identity.logout(token);
          cookie(response, '', request);
          return sendJson(response, 200, { ok: true });
        }
        if (path === '/api/profiles' && request.method === 'GET')
          return sendJson(response, 200, { profiles: identity.list(actor) });
        if (path === '/api/profiles' && request.method === 'POST')
          return sendJson(response, 201, {
            profile: await identity.create(actor, await readJson(request, host)),
          });
        if (path === '/api/profiles/me' && request.method === 'PATCH')
          return sendJson(response, 200, {
            profile: identity.rename(actor, await readJson(request, host)),
          });
        if (path === '/api/profiles/password' && request.method === 'POST') {
          const result = await identity.changePassword(actor, await readJson(request, host));
          cookie(response, result.token, request);
          return sendJson(response, 200, { profile: result.profile });
        }
        const disable = path.match(/^\/api\/profiles\/([a-f0-9-]{36})\/status$/);
        if (disable && request.method === 'PATCH')
          return sendJson(response, 200, {
            profile: identity.disable(actor, disable[1], (await readJson(request, host))?.disabled),
          });
        if (!['/api/state', '/api/transactions'].includes(path))
          throw new DataError('No encontrado.', 404);
        const scopedRepository = {};
        for (const method of ['readState', 'replaceState', 'read', 'replace', 'health']) {
          scopedRepository[method] = (...args) => {
            const current = identity.current(token);
            if (!current || current.id !== actor.id)
              throw new DataError('La sesión ya no está disponible.', 401);
            return identity.ledger(current)[method](...args);
          };
        }
        return await createHandler(scopedRepository)(request, response);
      }
      return await publicHandler(request, response);
    } catch (error) {
      sendJson(response, error instanceof DataError ? error.status : 500, {
        error: error instanceof DataError ? error.message : 'No se pudo completar la operación.',
      });
    }
  };
}
