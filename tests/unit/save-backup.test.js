import test from 'node:test';
import assert from 'node:assert/strict';
import { saveJsonBackup } from '../../src/web/shared/save-backup.js';
import { createDomDouble } from '../helpers/dom.js';

test('escritorio muestra la ruta real devuelta por el guardado nativo y respeta cancelar', async () => {
  let message;
  const browser = {
    finanzasDesktop: {
      saveBackup: async (filename, content) => {
        assert.equal(filename, 'finanzas-sin-fin.json');
        assert.deepEqual(JSON.parse(content), { amount: 4 });
        return { path: 'C:\\Copias\\finanzas-sin-fin.json' };
      },
    },
  };
  await saveJsonBackup(
    'finanzas-sin-fin.json',
    async () => ({ amount: 4 }),
    (value) => {
      message = value;
    },
    browser,
  );
  assert.match(message, /C:\\Copias\\finanzas-sin-fin.json/);
  browser.finanzasDesktop.saveBackup = async () => ({ canceled: true });
  await assert.rejects(
    saveJsonBackup(
      'finanzas-sin-fin.json',
      async () => ({}),
      () => assert.fail(),
      browser,
    ),
    { name: 'AbortError' },
  );
});

test('respaldo elige ubicación antes de consultar y confirma solo después de cerrar el archivo', async () => {
  const steps = [];
  const browser = {
    async showSaveFilePicker(options) {
      steps.push('picker');
      assert.equal(options.suggestedName, 'copia.json');
      return {
        name: 'mi-copia.json',
        async createWritable() {
          return {
            async write(content) {
              steps.push('write');
              assert.deepEqual(JSON.parse(content), { amount: 12 });
            },
            async close() {
              steps.push('close');
            },
          };
        },
      };
    },
  };
  await saveJsonBackup(
    'copia.json',
    async () => {
      steps.push('load');
      return { amount: 12 };
    },
    (message) => {
      steps.push('feedback');
      assert.match(message, /mi-copia.json/);
    },
    browser,
  );
  assert.deepEqual(steps, ['picker', 'load', 'write', 'close', 'feedback']);
});

test('cancelar no consulta datos ni anuncia copia; un fallo de escritura tampoco confirma', async () => {
  let loaded = false;
  const cancel = Object.assign(new Error('cancel'), { name: 'AbortError' });
  await assert.rejects(
    saveJsonBackup(
      'x.json',
      () => {
        loaded = true;
      },
      () => assert.fail(),
      {
        showSaveFilePicker: async () => {
          throw cancel;
        },
      },
    ),
    { name: 'AbortError' },
  );
  assert.equal(loaded, false);
  let aborted = false;
  await assert.rejects(
    saveJsonBackup(
      'x.json',
      async () => ({}),
      () => assert.fail(),
      {
        showSaveFilePicker: async () => ({
          createWritable: async () => ({
            write: async () => {
              throw new Error('disk full');
            },
            abort: async () => {
              aborted = true;
            },
          }),
        }),
      },
    ),
    /disk full/,
  );
  assert.equal(aborted, true);
});

test('sin selector descarga el JSON e indica cómo encontrar la carpeta sin inventar una ruta', async () => {
  const previous = globalThis.document;
  const dom = createDomDouble();
  globalThis.document = dom.document;
  try {
    let feedback;
    await saveJsonBackup(
      'copia.json',
      async () => ({ amount: 1 }),
      (message) => {
        feedback = message;
      },
      {},
    );
    assert.equal(dom.document.body.children[0].download, 'copia.json');
    assert.match(feedback, /Ctrl\+J/);
    assert.match(feedback, /Mostrar en carpeta/);
    assert.match(feedback, /Descarga solicitada/);
  } finally {
    globalThis.document = previous;
  }
});
