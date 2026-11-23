import { readdirSync, readFileSync } from 'node:fs';
import { isUtf8 } from 'node:buffer';
import { spawnSync } from 'node:child_process';

const files = readdirSync('.').filter(file => file.endsWith('.js'));
for (const file of files) {
  const bytes = readFileSync(file);
  if (!isUtf8(bytes)) throw new Error(`${file}: codificacion UTF-8 no valida`);
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('index.html contiene identificadores duplicados');
console.log(`Comprobados ${files.length} archivos JavaScript y ${ids.length} identificadores HTML.`);
