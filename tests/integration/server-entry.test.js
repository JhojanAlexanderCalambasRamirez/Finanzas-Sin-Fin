import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function start(databasePath) {
  const child = spawn(process.execPath, ['src/server/main.js'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', DATABASE_PATH: databasePath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  child.stderr.on('data', (chunk) => {
    errors += chunk;
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('El servidor no arranco: ' + errors));
    }, 10000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Servidor terminado ${code}: ${errors}`));
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });
  return { child, url };
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, 'exit');
  child.kill();
  await exit;
}

test(
  'entrypoint inicia desde cero y conserva los registros tras reiniciar el proceso',
  { timeout: 20000 },
  async () => {
    const directory = mkdtempSync(join(tmpdir(), 'finanzas-entry-'));
    let running;
    try {
      const path = join(directory, 'nested', 'finance.sqlite');
      running = await start(path);
      assert.equal((await fetch(running.url + '/health')).status, 200);
      const state = await (await fetch(running.url + '/api/state')).json();
      assert.equal(state.accounts.length, 1);
      assert.ok(state.categories.length > 0);
      const next = {
        ...state,
        transactions: [
          {
            id: 'entry-income',
            type: 'income',
            description: 'Primer ingreso',
            amount: 100000,
            date: '2026-11-23',
            category: 'Salario',
            accountId: 'principal',
          },
        ],
      };
      assert.equal(
        (
          await fetch(running.url + '/api/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(next),
          })
        ).status,
        200,
      );
      await stop(running.child);
      running = await start(path);
      const restored = await (await fetch(running.url + '/api/state')).json();
      assert.equal(restored.transactions[0].amount, 100000);
    } finally {
      await stop(running?.child);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
