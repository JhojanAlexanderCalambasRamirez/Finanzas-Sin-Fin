import { identityRequest } from '../../data/identity-api.js';

export function mountProfiles(profile, $) {
  $('#signed-in-name').textContent = profile.displayName + ' · ' + profile.username;
  $('#profile-current-name').value = profile.displayName;
  $('#profile-current-username').value = profile.username;
  $('#profile-admin').hidden = profile.role !== 'admin';
  let busy = false;
  async function submit(form, action) {
    if (busy) return;
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    $('#profile-message').textContent = '';
    try {
      await action();
    } catch (error) {
      $('#profile-message').textContent = error.message;
    } finally {
      busy = false;
      button.disabled = false;
    }
  }
  $('#profile-name-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    return submit(form, async () => {
      const data = await identityRequest('/api/profiles/me', 'PATCH', {
        displayName: $('#profile-current-name').value,
        username: $('#profile-current-username').value,
      });
      $('#signed-in-name').textContent = data.profile.displayName + ' · ' + data.profile.username;
      $('#profile-message').textContent = 'Perfil actualizado.';
    });
  });
  $('#profile-password-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    return submit(form, async () => {
      await identityRequest('/api/profiles/password', 'POST', {
        currentPassword: $('#profile-old-password').value,
        password: $('#profile-new-password').value,
      });
      form.reset();
      $('#profile-message').textContent =
        'Contraseña actualizada. Se cerraron las otras sesiones de este perfil.';
    });
  });
  async function list() {
    if (profile.role !== 'admin') return;
    const data = await identityRequest('/api/profiles');
    $('#profile-list').replaceChildren(
      ...data.profiles.map((item) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent =
          item.displayName +
          ' · ' +
          item.username +
          (item.disabled ? ' · Desactivado' : ' · Activo');
        li.append(name);
        if (item.id !== profile.id) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary';
          button.textContent = item.disabled ? 'Reactivar' : 'Desactivar';
          button.setAttribute('aria-label', button.textContent + ' perfil ' + item.username);
          button.onclick = async () => {
            if (
              busy ||
              !confirm(
                `${button.textContent} el acceso de ${item.username}? Sus finanzas se conservarán.`,
              )
            )
              return;
            busy = true;
            button.disabled = true;
            try {
              await identityRequest('/api/profiles/' + item.id + '/status', 'PATCH', {
                disabled: !item.disabled,
              });
              await list();
              $('#profile-message').textContent = 'Estado del perfil actualizado.';
            } catch (error) {
              $('#profile-message').textContent = error.message;
            } finally {
              busy = false;
              button.disabled = false;
            }
          };
          li.append(button);
        }
        return li;
      }),
    );
  }
  $('#profile-create-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    return submit(form, async () => {
      await identityRequest('/api/profiles', 'POST', {
        displayName: $('#profile-create-name').value,
        username: $('#profile-create-username').value,
        password: $('#profile-create-password').value,
      });
      form.reset();
      await list();
      $('#profile-message').textContent =
        'Perfil creado con finanzas vacías. Puede entrar con su usuario y contraseña.';
    });
  });
  list().catch((error) => {
    $('#profile-message').textContent = error.message;
  });
}
