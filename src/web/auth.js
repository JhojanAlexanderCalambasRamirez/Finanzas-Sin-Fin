import { identityRequest } from './data/identity-api.js';
import { mountProfiles } from './features/profiles/controller.js';
import { $ } from './shared/dom.js';

$('#app-shell').hidden = true;
$('#auth-screen').hidden = false;
let setup = false;
let busy = false;
async function enter(profile) {
  document.documentElement.dataset.profileRole = profile.role;
  $('#auth-password').value = '';
  await import('./main.js');
  mountProfiles(profile, $);
  $('#app-shell').hidden = false;
  $('#auth-screen').hidden = true;
}
$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $('#auth-submit').disabled = true;
  $('#auth-error').textContent = '';
  $('#auth-form').setAttribute('aria-busy', 'true');
  try {
    const data = await identityRequest(setup ? '/api/auth/setup' : '/api/auth/login', 'POST', {
      username: $('#auth-username').value,
      password: $('#auth-password').value,
      displayName: $('#auth-name').value,
    });
    await enter(data.profile);
  } catch (error) {
    $('#auth-error').textContent = error.message;
  } finally {
    busy = false;
    $('#auth-submit').disabled = false;
    $('#auth-form').setAttribute('aria-busy', 'false');
  }
});
$('#auth-show-password').addEventListener('click', () => {
  const visible = $('#auth-password').type === 'password';
  $('#auth-password').type = visible ? 'text' : 'password';
  $('#auth-show-password').textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
  $('#auth-show-password').setAttribute('aria-pressed', String(visible));
});
$('#auth-logout').addEventListener('click', async () => {
  $('#auth-logout').disabled = true;
  try {
    await identityRequest('/api/auth/logout', 'POST', {});
    location.reload();
  } catch (error) {
    if (error.status === 401) {
      location.reload();
      return;
    }
    $('#profile-message').textContent = error.message;
    $('#auth-logout').disabled = false;
  }
});
window.addEventListener('finanzas:unauthorized', () => location.reload());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
try {
  const status = await identityRequest('/api/auth/status');
  if (status.profile) await enter(status.profile);
  else {
    setup = status.setupRequired;
    $('#auth-title').textContent = setup ? 'Crea tu primer perfil' : 'Entra a tus finanzas';
    $('#auth-description').textContent = setup
      ? 'Este perfil será administrador y conservará los datos que ya existen en esta instalación.'
      : 'Cada perfil tiene sus propias cuentas, movimientos y respaldos.';
    $('#auth-name-field').hidden = !setup;
    $('#auth-name').required = setup;
    $('#auth-password').autocomplete = setup ? 'new-password' : 'current-password';
    $('#auth-submit').textContent = setup ? 'Crear mi perfil' : 'Iniciar sesión';
    $('#auth-submit').disabled = false;
  }
} catch (error) {
  $('#auth-error').textContent = 'No se pudo conectar con el servidor. ' + error.message;
}
