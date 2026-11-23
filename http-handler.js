import { readFile } from 'node:fs/promises';
import { DataError } from './database.js';

const routes = new Map([
  ['/dashboard.js', ['dashboard.js', 'text/javascript']],
  ['/loans.js', ['loans.js', 'text/javascript']],
  ['/', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']],
  ['/backup.css', ['backup.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']],
  ['/finance.js', ['finance.js', 'text/javascript']], ['/api-store.js', ['api-store.js', 'text/javascript']],
  ['/transaction-store.js', ['transaction-store.js', 'text/javascript']],
  ['/ledger.js', ['ledger.js', 'text/javascript']],
  ['/movement-tools.js', ['movement-tools.js', 'text/javascript']],
  ['/validation.js', ['validation.js', 'text/javascript']],
  ['/recurrences.js', ['recurrences.js', 'text/javascript']],
  ['/budgets.js', ['budgets.js', 'text/javascript']],
  ['/goals.js', ['goals.js', 'text/javascript']],
  ['/debts.js', ['debts.js', 'text/javascript']],
  ['/reports.js', ['reports.js', 'text/javascript']]
]);
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
};

export function createHandler(database) {
  return async (req, res) => {
    try {
      const host = req.headers.host;
      let address;
      try { address = new URL(`http://${host}`); } catch { throw new DataError('Direccion de servidor no valida.'); }
      if (!host || address.username || address.password || address.pathname !== '/' || address.search || address.hash || !['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)) {
        throw new DataError('Acceso local requerido.', 403);
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new DataError('Origen no permitido.', 403);
      const path = new URL(req.url, `http://${host}`).pathname;
      if (path === '/health' && req.method === 'GET') {
        const healthy = database.health();
        return json(res, healthy ? 200 : 503, { status: healthy ? 'ok' : 'error', storage: 'sqlite' });
      }
      if (path === '/api/transactions' || path === '/api/state') {
        const fullState = path === '/api/state';
        if (req.method === 'GET') return json(res, 200, fullState ? database.readState() : database.read());
        if (req.method !== 'PUT') { res.setHeader('Allow', 'GET, PUT'); throw new DataError('Metodo no permitido.', 405); }
        if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new DataError('Origen no permitido.', 403);
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new DataError('Se requiere JSON.', 415);
        let size = 0; const chunks = [];
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk);
          if (size > 5 * 1024 * 1024) throw new DataError('El archivo supera 5 MB.', 413);
          chunks.push(Buffer.from(chunk));
        }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw new DataError('JSON no valido.'); }
        return json(res, 200, fullState ? database.replaceState(data, data?.revision) : database.replace(data?.transactions, data?.revision));
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw new DataError('Metodo no permitido.', 405);
      const route = routes.get(path);
      if (!route) throw new DataError('No encontrado.', 404);
      const content = await readFile(new URL(route[0], import.meta.url));
      res.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      json(res, error instanceof DataError ? error.status : 500, { error: error instanceof DataError ? error.message : 'No se pudo completar la solicitud. Recarga para comprobar el estado guardado.' });
    }
  };
}
