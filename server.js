import http from 'node:http';
import { defaultDatabasePath } from './provision.js';
import { openDatabase } from './database.js';
import { createHandler } from './http-handler.js';
const database = openDatabase(process.env.DATABASE_PATH || defaultDatabasePath);
const server = http.createServer(createHandler(database));
server.requestTimeout = 30000;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `El puerto ${port} está ocupado. Configura PORT con otro puerto o usa Docker Compose.`
    : `No se pudo iniciar el servidor: ${error.message}`);
  database.close(); process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Finanzas-sin-fin: http://${host}:${port}`));
let closing = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  if (closing) return;
  closing = true; server.close(() => database.close());
});
