import test from 'node:test';
import assert from 'node:assert/strict';
import { profileInput } from '../../src/domain/profiles.js';
import { passwords } from '../../src/infrastructure/security/passwords.js';

test('perfil normaliza usuario y permite nombres internacionales; rechaza entradas invalidas', () => {
  assert.equal(
    profileInput({
      username: ' Owner ',
      displayName: 'Álvaro 松',
      password: 'frase larga de acceso',
    }).username,
    'owner',
  );
  for (const data of [
    null,
    { username: '../owner' },
    { username: 'ab' },
    { username: ['owner'] },
    { username: 'owner', displayName: ' ', password: 'test-password' },
    { username: 'owner', displayName: 'Owner', password: ' '.repeat(12) },
    { username: 'owner', displayName: 'Owner', password: 123 },
    { username: 'owner', displayName: 'Owner', password: 'a'.repeat(129) },
  ])
    assert.throws(() => profileInput(data));
});
test('contraseñas usan sal independiente y verifican valores correctos e incorrectos', async () => {
  const first = await passwords.hash('test-password-123');
  const second = await passwords.hash('test-password-123');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.passwordHash, second.passwordHash);
  assert.equal(await passwords.verify('test-password-123', first), true);
  assert.equal(await passwords.verify('wrong-password', first), false);
});
