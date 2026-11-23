import http from 'node:http';
import { openProfileRegistry } from '../infrastructure/sqlite/profile-registry.js';
import { passwords } from '../infrastructure/security/passwords.js';
import { tokens } from '../infrastructure/security/tokens.js';
import { createIdentityService } from '../application/identity-service.js';
import { createProfileHandler } from './http/profile-handler.js';

export async function startLocalRuntime(filename) {
  const identity = createIdentityService({
    registry: openProfileRegistry(filename),
    passwords,
    tokens,
  });
  const server = http.createServer(createProfileHandler(identity));
  server.requestTimeout = 30000;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    identity.close();
    throw error;
  }
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          identity.close();
          resolve();
        });
        server.closeIdleConnections();
      }),
  };
}
