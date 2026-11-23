import { createHash, timingSafeEqual } from 'node:crypto';
import { DataError } from '../application/errors.js';

export function createAccessGuard({
  allowedHosts = [],
  username = 'finanzas',
  password = '',
} = {}) {
  if (!allowedHosts.length) return () => {};
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(username) || !/^[!-~]{16,128}$/.test(password))
    throw new Error(
      'El acceso LAN requiere usuario válido y contraseña ASCII de 16 a 128 caracteres sin espacios.',
    );
  const digest = (value) => createHash('sha256').update(value).digest();
  const expected = digest('Basic ' + Buffer.from(username + ':' + password).toString('base64'));
  const failures = new Map();
  return (request, response) => {
    if (!request.socket?.encrypted)
      throw new DataError('El acceso compartido requiere HTTPS.', 403);
    const ip = request.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = failures.get(ip);
    if (entry && now - entry.since >= 300000) {
      failures.delete(ip);
      entry = null;
    }
    if (entry?.count >= 10) {
      response.setHeader('Retry-After', '300');
      throw new DataError('Demasiados intentos. Espera cinco minutos.', 429);
    }
    const authorization = request.headers.authorization || '';
    if (
      typeof authorization !== 'string' ||
      authorization.length > 4096 ||
      !timingSafeEqual(expected, digest(authorization))
    ) {
      if (failures.size >= 1000 && !failures.has(ip)) failures.delete(failures.keys().next().value);
      failures.set(ip, { since: entry?.since || now, count: (entry?.count || 0) + 1 });
      response.setHeader('WWW-Authenticate', 'Basic realm="Finanzas sin fin", charset="UTF-8"');
      throw new DataError('Inicia sesión para consultar tus finanzas.', 401);
    }
    failures.delete(ip);
  };
}
