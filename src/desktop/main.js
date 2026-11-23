import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { startLocalRuntime } from '../server/local-runtime.js';

app.setName('Finanzas Sin Fin');
const smoke = process.argv.includes('--smoke-test');
const smokeRoot = smoke ? await mkdtemp(join(tmpdir(), 'finanzas-desktop-')) : null;
if (smokeRoot) {
  app.setPath('userData', smokeRoot);
  app.setPath('sessionData', smokeRoot);
  app.setPath('crashDumps', smokeRoot);
  app.commandLine.appendSwitch('disable-gpu');
}
let runtime,
  window,
  lastBackup,
  closing = false;
if (!app.requestSingleInstanceLock()) app.exit(smoke ? 1 : 0);
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const dataRoot = smokeRoot || app.getPath('userData');
      runtime = await startLocalRuntime(join(dataRoot, 'data', 'finanzas.sqlite'));
      function authorized(event) {
        if (
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          new URL(event.senderFrame.url).origin !== runtime.url
        )
          throw new Error('Solicitud no permitida.');
      }
      ipcMain.handle('backup:save', async (event, filename, content) => {
        authorized(event);
        if (
          typeof filename !== 'string' ||
          !/^finanzas-sin-fin[\w-]*\.json$/.test(filename) ||
          typeof content !== 'string' ||
          Buffer.byteLength(content) > 5 * 1024 * 1024
        )
          throw new Error('Respaldo no válido.');
        const data = JSON.parse(content);
        if (data.app !== 'finanzas-sin-fin') throw new Error('Respaldo no válido.');
        const result = await dialog.showSaveDialog(window, {
          title: 'Guardar copia de mis finanzas',
          defaultPath: join(app.getPath('downloads'), filename),
          filters: [{ name: 'Respaldo JSON', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePath) return { canceled: true };
        // Electron's save dialog obtains explicit permission for this destination.
        const temporary = result.filePath + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
          await rename(temporary, result.filePath);
        } finally {
          await rm(temporary, { force: true });
        }
        lastBackup = result.filePath;
        return { path: lastBackup };
      });
      ipcMain.handle('backup:reveal', (event) => {
        authorized(event);
        if (lastBackup) shell.showItemInFolder(lastBackup);
      });
      window = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        show: !smoke,
        title: 'Finanzas Sin Fin',
        webPreferences: {
          preload: join(dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', (event, url) => {
        if (new URL(url).origin !== runtime.url) event.preventDefault();
      });
      window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
        callback(false),
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
          {
            label: 'Archivo',
            submenu: [
              { label: 'Mostrar carpeta de datos', click: () => shell.openPath(dataRoot) },
              { role: 'quit', label: 'Salir' },
            ],
          },
          {
            label: 'Edición',
            submenu: [
              { role: 'undo' },
              { role: 'redo' },
              { type: 'separator' },
              { role: 'cut' },
              { role: 'copy' },
              { role: 'paste' },
              { role: 'selectAll' },
            ],
          },
          {
            label: 'Vista',
            submenu: [
              { role: 'reload', label: 'Recargar' },
              { role: 'resetZoom' },
              { role: 'zoomIn' },
              { role: 'zoomOut' },
            ],
          },
        ]),
      );
      await window.loadURL(runtime.url);
      if (smoke) {
        const result = await window.webContents.executeJavaScript(`(async () => {
        const status = await (await fetch('/api/auth/status')).json();
        const blocked = (await fetch('/api/state')).status;
        const setup = await fetch('/api/auth/setup', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'desktop-test',displayName:'Prueba escritorio',password:'desktop-test-password-2026'})});
        const state = await fetch('/api/state');
        return {setupRequired:status.setupRequired,blocked,setup:setup.status,state:state.status,bridge:typeof window.finanzasDesktop.saveBackup,login:!!document.querySelector('#auth-form')};
      })()`);
        await mkdir(join(dataRoot, 'reports'), { recursive: true });
        const report = join(dataRoot, 'reports', 'smoke.json');
        await writeFile(report, JSON.stringify(result, null, 2));
        console.log('DESKTOP_SMOKE', report, JSON.stringify(result));
        process.exitCode =
          result.blocked === 401 &&
          result.setup === 200 &&
          result.state === 200 &&
          result.bridge === 'function'
            ? 0
            : 1;
        app.quit();
      }
    })
    .catch((error) => {
      console.error(error);
      if (!smoke) dialog.showErrorBox('No se pudo iniciar Finanzas Sin Fin', error.message);
      app.exit(1);
    });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!runtime || closing) return;
    event.preventDefault();
    closing = true;
    runtime.close().finally(() => app.exit(process.exitCode || 0));
  });
}
