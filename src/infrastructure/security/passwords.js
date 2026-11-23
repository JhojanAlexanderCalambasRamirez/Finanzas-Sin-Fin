import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export const passwords = {
  async hash(password) {
    const salt = randomBytes(16).toString('hex');
    const encoded = (await derive(password, salt, 64, parameters)).toString('hex');
    return { salt, passwordHash: 'scrypt-v1$' + encoded };
  },
  async verify(password, user) {
    const actual = await derive(password, user.salt, 64, parameters);
    const encoded = user.passwordHash.replace(/^scrypt-v1\$/, '');
    return /^[a-f0-9]{128}$/.test(encoded) && timingSafeEqual(actual, Buffer.from(encoded, 'hex'));
  },
};
