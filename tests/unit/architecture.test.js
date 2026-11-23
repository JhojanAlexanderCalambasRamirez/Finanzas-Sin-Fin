import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';

const walk = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(resolve(directory, entry.name)) : [resolve(directory, entry.name)],
  );
const normalized = (file) => relative(process.cwd(), file).split(sep).join('/');

test('dependencias respetan capas y cada funcionalidad web permanece independiente', () => {
  for (const file of walk('src').filter((file) => file.endsWith('.js'))) {
    const name = normalized(file);
    const source = readFileSync(file, 'utf8');
    for (const [, specifier] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const target = specifier.startsWith('.')
        ? normalized(resolve(dirname(file), specifier))
        : specifier;
      if (name.startsWith('src/domain/'))
        assert.ok(target.startsWith('src/domain/'), `${name} depende de ${target}`);
      if (name.startsWith('src/web/'))
        assert.ok(
          target.startsWith('src/web/') || target.startsWith('src/domain/'),
          `${name} depende del backend ${target}`,
        );
      if (name.startsWith('src/application/'))
        assert.ok(
          target.startsWith('src/domain/') || target.startsWith('src/application/'),
          `${name} depende de un adaptador ${target}`,
        );
      if (name.startsWith('src/server/http/'))
        assert.ok(!target.startsWith('src/infrastructure/'), `${name} conoce SQLite`);
      if (name.startsWith('src/web/features/') && target.startsWith('src/web/features/'))
        assert.equal(
          name.split('/')[3],
          target.split('/')[3],
          `${name} importa otra funcionalidad`,
        );
    }
  }
});
