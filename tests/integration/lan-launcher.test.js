import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('arranque LAN prepara configuracion faltante sin exponer un servidor ni sobrescribir archivos', () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-lan-init-'));
  try {
    for (const path of ['scripts', 'src/server', 'src/application']) mkdirSync(join(directory, path), { recursive: true });
    for (const path of ['scripts/start-lan.mjs', 'src/server/config.js', 'src/server/access.js', 'src/application/errors.js', 'lan.env.example']) copyFileSync(path, join(directory, path));
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    const run = () => spawnSync(process.execPath, ['scripts/start-lan.mjs'], { cwd: directory, encoding: 'utf8', env: { ...process.env, AUTH_PASSWORD: '' } });
    const first = run(); assert.equal(first.status, 1); assert.match(first.stdout, /Se creo lan.env/); assert.match(first.stderr, /Configuracion LAN incompleta/);
    const config = readFileSync(join(directory, 'lan.env'), 'utf8') + '\n# configuracion personal\n';
    writeFileSync(join(directory, 'lan.env'), config);
    assert.equal(run().status, 1); assert.equal(readFileSync(join(directory, 'lan.env'), 'utf8'), config);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
