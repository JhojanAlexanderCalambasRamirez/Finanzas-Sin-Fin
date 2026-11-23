import { DataError } from '../../application/errors.js';
import { readJson, sendJson } from './protocol.js';

export async function handleLedgerRequest(request, response, { service, path, host }) {
  const fullState = path === '/api/state';
  if (request.method === 'GET')
    return sendJson(response, 200, fullState ? service.readState() : service.read());
  if (request.method !== 'PUT') {
    response.setHeader('Allow', 'GET, PUT');
    throw new DataError('Metodo no permitido.', 405);
  }
  const data = await readJson(request, host);
  const saved = fullState
    ? service.replaceState(data, data?.revision)
    : service.replace(data?.transactions, data?.revision);
  return sendJson(response, 200, saved);
}
