import { DataError } from '../../application/errors.js';

export function sendJson(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

export function localRequest(request) {
  const host = request.headers.host;
  let address;
  try {
    address = new URL(`http://${host}`);
  } catch {
    throw new DataError('Direccion de servidor no valida.');
  }
  if (
    !host ||
    address.username ||
    address.password ||
    address.pathname !== '/' ||
    address.search ||
    address.hash ||
    !['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
  )
    throw new DataError('Acceso local requerido.', 403);
  if (request.headers['sec-fetch-site'] === 'cross-site')
    throw new DataError('Origen no permitido.', 403);
  return { host, path: new URL(request.url, `http://${host}`).pathname };
}

export async function readJson(request, host) {
  const scheme = request.socket?.encrypted ? 'https' : 'http';
  if (request.headers.origin && request.headers.origin !== `${scheme}://${host}`)
    throw new DataError('Origen no permitido.', 403);
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json')
    throw new DataError('Se requiere JSON.', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > 5 * 1024 * 1024) throw new DataError('El archivo supera 5 MB.', 413);
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DataError('JSON no valido.');
  }
}
