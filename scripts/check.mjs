import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { isUtf8 } from 'node:buffer';
import { spawnSync } from 'node:child_process';

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)],
  );
}
const files = ['src', 'tests', 'scripts'].flatMap(walk).filter((file) => /\.(js|mjs)$/.test(file));
for (const file of files) {
  const bytes = readFileSync(file);
  if (!isUtf8(bytes)) throw new Error(`${file}: codificacion UTF-8 no valida`);
  for (const match of bytes.toString().matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    if (!existsSync(resolve(dirname(file), match[1])))
      throw new Error(`${file}: import inexistente ${match[1]}`);
  }
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
const html = readFileSync('src/web/index.html', 'utf8');
if (!/<\/html>\s*$/.test(html)) throw new Error('Hay contenido fuera del documento HTML');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
if (new Set(ids).size !== ids.length)
  throw new Error('index.html contiene identificadores duplicados');
console.log(
  `Comprobados ${files.length} archivos JavaScript y ${ids.length} identificadores HTML.`,
);
