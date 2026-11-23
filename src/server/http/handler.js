import { readFile } from 'node:fs/promises';
import { DataError } from '../../application/errors.js';
import { createLedgerService } from '../../application/ledger-service.js';
import { resolveAsset } from './static-assets.js';
import { sendJson, localRequest } from './protocol.js';
import { handleLedgerRequest } from './ledger-routes.js';
import { createAccessGuard } from '../access.js';

export function createHandler(repository, options = {}) {
  const service = createLedgerService(repository);
  const guard = createAccessGuard(options);
  return async (request, response) => {
    try {
      const { host, path } = localRequest(request, options.allowedHosts);
      if (path === '/health' && request.method === 'GET') {
        const healthy = service.health();
        return sendJson(response, healthy ? 200 : 503, {
          status: healthy ? 'ok' : 'error',
          storage: 'sqlite',
        });
      }
      guard(request, response);
      if (path === '/api/transactions' || path === '/api/state')
        return await handleLedgerRequest(request, response, { service, path, host });
      if (!['GET', 'HEAD'].includes(request.method))
        throw new DataError('Metodo no permitido.', 405);
      const asset = resolveAsset(path);
      if (!asset) throw new DataError('No encontrado.', 404);
      const content = await readFile(asset[0]);
      response.writeHead(200, {
        'Content-Type': `${asset[1]}; charset=utf-8`,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      sendJson(response, error instanceof DataError ? error.status : 500, {
        error:
          error instanceof DataError
            ? error.message
            : 'No se pudo completar la solicitud. Recarga para comprobar el estado guardado.',
      });
    }
  };
}
