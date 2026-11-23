import { existsSync, copyFileSync, constants, accessSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { serverConfig } from '../src/server/config.js';
import { createAccessGuard } from '../src/server/access.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const filename = resolve(root, 'lan.env');
try {
  if (!existsSync(filename)) {
    copyFileSync(resolve(root, 'lan.env.example'), filename, constants.COPYFILE_EXCL);
    console.log('Se creo lan.env a partir del ejemplo. No se inicio el servidor.');
  }
  loadEnvFile(filename);
  const config = serverConfig();
  if (!config.allowedHosts.length || !config.tls) throw new Error('Configura ALLOWED_HOSTS y las rutas del certificado HTTPS en lan.env.');
  createAccessGuard(config);
  for (const path of [config.keyPath, config.certPath]) {
    try { accessSync(resolve(root, path), constants.R_OK); }
    catch { throw new Error('Falta un archivo HTTPS o no se puede leer. Revisa TLS_KEY_PATH y TLS_CERT_PATH en lan.env.'); }
  }
  const child = spawn(process.execPath, [resolve(root, 'src/server/main.js')], { cwd: root, env: process.env, stdio: 'inherit' });
  child.on('error', () => { console.error('No se pudo iniciar el servidor LAN.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(`Configuracion LAN incompleta: ${error.message}`);
  console.error('Edita lan.env: direccion real del PC central, contrasena y certificado confiable.');
  console.error('Guia: docs/LOCAL-NETWORK.md. Para usar solo este equipo: npm start.');
  process.exitCode = 1;
}
