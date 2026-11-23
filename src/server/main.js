import https from 'node:https';
import { readFileSync } from 'node:fs';
import { serverConfig } from './config.js';
import http from 'node:http';
import { defaultDatabasePath } from '../infrastructure/sqlite/provision.js';
import { openDatabase } from '../infrastructure/sqlite/ledger-repository.js';
import { createHandler } from './http/handler.js';
const config = serverConfig();
const tlsOptions = config.tls
  ? {
      key: readFileSync(config.keyPath),
      cert: readFileSync(config.certPath),
      minVersion: 'TLSv1.2',
    }
  : null;
const database = openDatabase(process.env.DATABASE_PATH || defaultDatabasePath);
const handler = createHandler(database, config);
const server = tlsOptions ? https.createServer(tlsOptions, handler) : http.createServer(handler);
server.requestTimeout = 30000;
const port = config.port;
const host = config.host;
server.on('error', (error) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `El puerto ${port} está ocupado. Configura PORT con otro puerto o usa Docker Compose.`
      : `No se pudo iniciar el servidor: ${error.message}`,
  );
  database.close();
  process.exitCode = 1;
});
server.listen(port, host, () => {
  const address = config.allowedHosts[0] || host + ':' + server.address().port;
  console.log(`Finanzas-sin-fin: ${config.tls ? 'https' : 'http'}://${address}`);
});
let closing = false;
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    server.close(() => database.close());
  });
