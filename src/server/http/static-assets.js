import { readdirSync } from 'node:fs';
const routes = new Map();
function addTree(directory, prefix) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) addTree(url, prefix + entry.name + '/');
    else if (/\.(js|css)$/.test(entry.name))
      routes.set(prefix + entry.name, [
        url,
        entry.name.endsWith('.css') ? 'text/css' : 'text/javascript',
      ]);
  }
}
addTree(new URL('../../domain/', import.meta.url), '/src/domain/');
addTree(new URL('../../web/', import.meta.url), '/src/web/');
routes.set('/', [new URL('../../web/index.html', import.meta.url), 'text/html']);
const aliases = {
  '/finance.js': '/src/domain/finance.js',
  '/validation.js': '/src/domain/validation.js',
  '/ledger.js': '/src/domain/ledger.js',
  '/movement-tools.js': '/src/domain/movement-tools.js',
  '/recurrences.js': '/src/domain/recurrences.js',
  '/budgets.js': '/src/domain/budgets.js',
  '/goals.js': '/src/domain/goals.js',
  '/debts.js': '/src/domain/debts.js',
  '/reports.js': '/src/domain/reports.js',
  '/dashboard.js': '/src/domain/dashboard.js',
  '/loans.js': '/src/domain/loans.js',
  '/app.js': '/src/web/main.js',
  '/api-store.js': '/src/web/data/api-store.js',
  '/transaction-store.js': '/src/web/data/legacy-store.js',
  '/styles.css': '/src/web/styles/app.css',
  '/backup.css': '/src/web/styles/components.css',
};
export function resolveAsset(path) {
  return routes.get(aliases[path] || path);
}
