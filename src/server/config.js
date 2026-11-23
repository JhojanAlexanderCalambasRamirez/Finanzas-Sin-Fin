export function serverConfig(env = process.env) {
  const allowedHosts = (env.ALLOWED_HOSTS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const host of allowedHosts) {
    const url = new URL('https://' + host);
    if (
      url.host !== host ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error('ALLOWED_HOSTS debe contener hosts exactos, con puerto si aplica.');
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT no es válido.');
  const tls = Boolean(env.TLS_KEY_PATH && env.TLS_CERT_PATH);
  if (Boolean(env.TLS_KEY_PATH) !== Boolean(env.TLS_CERT_PATH))
    throw new Error('Configura certificado y clave HTTPS juntos.');
  const host = env.HOST || '127.0.0.1';
  if (tls && !['127.0.0.1', 'localhost', '::1'].includes(host) && !allowedHosts.length)
    throw new Error('Configura ALLOWED_HOSTS antes de compartir por HTTPS.');
  if (allowedHosts.length && !tls) throw new Error('El modo compartido requiere HTTPS.');
  return {
    port,
    host,
    tls,
    allowedHosts,
    username: env.AUTH_USERNAME || 'finanzas',
    password: env.AUTH_PASSWORD || '',
    keyPath: env.TLS_KEY_PATH,
    certPath: env.TLS_CERT_PATH,
  };
}
