import { createHash, randomBytes } from 'node:crypto';
export const tokens = {
  create: () => randomBytes(32).toString('base64url'),
  hash: (token) => createHash('sha256').update(token).digest('hex'),
};
