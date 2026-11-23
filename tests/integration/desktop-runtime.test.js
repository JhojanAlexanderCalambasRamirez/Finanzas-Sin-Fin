import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalRuntime } from '../../src/server/local-runtime.js';

test('runtime de escritorio aprovisiona en carpeta independiente y elige puerto libre', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'finanzas-runtime-'));
  let runtime;
  try {
    runtime = await startLocalRuntime(join(directory, 'data', 'finanzas.sqlite'));
    assert.match(runtime.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal((await fetch(runtime.url)).status, 200);
    assert.equal((await fetch(runtime.url + '/api/state')).status, 401);
    assert.equal(
      (await (await fetch(runtime.url + '/api/auth/status')).json()).setupRequired,
      true,
    );
    assert.equal((await fetch(runtime.url + '/src/desktop/main.js')).status, 404);
  } finally {
    if (runtime) await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
