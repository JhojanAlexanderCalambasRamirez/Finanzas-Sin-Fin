import { validText } from './validation.js';

export function profileInput(input, passwordRequired = true) {
  const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : '';
  const displayName = typeof input?.displayName === 'string' ? input.displayName.trim() : '';
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || !validText(displayName, 60))
    throw new Error(
      'Escribe un usuario de 3 a 32 caracteres (letras, números, punto, guion) y un nombre visible.',
    );
  if (
    passwordRequired &&
    (typeof input.password !== 'string' ||
      input.password.length < 12 ||
      input.password.length > 128 ||
      !input.password.trim())
  )
    throw new Error('La contraseña debe tener entre 12 y 128 caracteres y no estar vacía.');
  return { username, displayName, password: input.password };
}
