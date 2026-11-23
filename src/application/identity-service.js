import { profileInput } from '../domain/profiles.js';
import { DataError } from './errors.js';

export const publicProfile = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  disabled: Boolean(user.disabled),
});

export function createIdentityService({ registry, passwords, tokens }) {
  const administrator = (actor) => {
    if (actor.role !== 'admin')
      throw new DataError('Solo el administrador puede gestionar otros perfiles.', 403);
  };
  async function credentials(input) {
    try {
      return profileInput(input);
    } catch (error) {
      throw new DataError(error.message);
    }
  }
  function issue(user) {
    const token = tokens.create();
    registry.addSession(tokens.hash(token), user.id, Date.now() + 12 * 60 * 60 * 1000);
    return { token, profile: publicProfile(user) };
  }
  return {
    setupRequired: () => registry.count() === 0,
    async setup(input) {
      const data = await credentials(input);
      const hash = await passwords.hash(data.password);
      return issue(registry.create({ ...data, ...hash }, true));
    },
    async login(input) {
      const username =
        typeof input?.username === 'string' ? input.username.trim().toLowerCase() : '';
      const password = input?.password;
      if (typeof password !== 'string' || password.length > 128)
        throw new DataError('Usuario o contraseña incorrectos.', 401);
      const user = registry.byUsername(username);
      // A dummy derivation keeps missing-user attempts computationally comparable.
      const candidate = user || {
        salt: '00000000000000000000000000000000',
        passwordHash: '0'.repeat(128),
      };
      const correct = await passwords.verify(password, candidate);
      const current = user ? registry.byId(user.id) : null;
      if (!current || current.disabled || current.passwordHash !== candidate.passwordHash || !correct)
        throw new DataError('Usuario o contraseña incorrectos.', 401);
      return issue(current);
    },
    current: (token) => (token ? registry.session(tokens.hash(token)) : null),
    logout(token) {
      if (token) registry.revoke(tokens.hash(token));
    },
    list(actor) {
      administrator(actor);
      return registry.list().map(publicProfile);
    },
    async create(actor, input) {
      administrator(actor);
      const data = await credentials(input);
      const hash = await passwords.hash(data.password);
      return publicProfile(registry.create({ ...data, ...hash }));
    },
    rename(actor, input) {
      let data;
      try {
        data = profileInput(
          { username: input?.username ?? actor.username, displayName: input?.displayName },
          false,
        );
      } catch (error) {
        throw new DataError(error.message);
      }
      return publicProfile(registry.update(actor.id, data.displayName, data.username));
    },
    async changePassword(actor, input) {
      const previous = registry.byId(actor.id);
      if (
        typeof input?.currentPassword !== 'string' ||
        input.currentPassword.length > 128 ||
        !(await passwords.verify(input.currentPassword, previous))
      )
        throw new DataError('La contraseña actual no es correcta.', 403);
      await credentials({
        username: actor.username,
        displayName: actor.displayName,
        password: input.password,
      });
      registry.setPassword(actor.id, await passwords.hash(input.password), previous.passwordHash);
      return issue(registry.byId(actor.id));
    },
    disable(actor, id, disabled) {
      administrator(actor);
      if (id === actor.id || typeof disabled !== 'boolean')
        throw new DataError('No puedes desactivar tu propia cuenta.');
      if (!registry.byId(id)) throw new DataError('Perfil no encontrado.', 404);
      registry.disable(id, disabled);
      return publicProfile(registry.byId(id));
    },
    ledger: (actor) => registry.ledger(actor.id),
    health: () => registry.health(),
    close: () => registry.close(),
  };
}
