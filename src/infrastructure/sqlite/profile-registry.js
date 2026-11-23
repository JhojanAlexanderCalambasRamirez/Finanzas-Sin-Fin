import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './ledger-repository.js';
import { DataError } from '../../application/errors.js';

export function openProfileRegistry(legacyPath) {
  const directory = dirname(resolve(legacyPath));
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, basename(legacyPath) + '.profiles.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, displayName TEXT NOT NULL, passwordHash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')), disabled INTEGER NOT NULL DEFAULT 0, legacy INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL) STRICT;`);
  const ledgers = new Map();
  return {
    count: () => db.prepare('SELECT count(*) AS count FROM users').get().count,
    byUsername: (username) => db.prepare('SELECT * FROM users WHERE username=?').get(username),
    byId: (id) => db.prepare('SELECT * FROM users WHERE id=?').get(id),
    list: () => db.prepare('SELECT * FROM users ORDER BY rowid').all(),
    create(input, first = false) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const count = db.prepare('SELECT count(*) AS count FROM users').get().count;
        if (first && count)
          throw new DataError('El perfil administrador ya existe. Inicia sesión.', 409);
        if (count >= 20) throw new DataError('Se alcanzó el máximo de 20 perfiles.');
        if (db.prepare('SELECT 1 FROM users WHERE username=?').get(input.username))
          throw new DataError('Ese nombre de usuario ya existe.', 409);
        const id = randomUUID();
        db.prepare(
          'INSERT INTO users (id,username,displayName,passwordHash,salt,role,legacy) VALUES (?,?,?,?,?,?,?)',
        ).run(
          id,
          input.username,
          input.displayName,
          input.passwordHash,
          input.salt,
          first ? 'admin' : 'member',
          first ? 1 : 0,
        );
        db.exec('COMMIT');
        return this.byId(id);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    update(id, displayName, username) {
      const existing = this.byUsername(username);
      if (existing && existing.id !== id)
        throw new DataError('Ese nombre de usuario ya existe.', 409);
      db.prepare('UPDATE users SET displayName=?,username=? WHERE id=?').run(
        displayName,
        username,
        id,
      );
      return this.byId(id);
    },
    setPassword(id, hash, expectedHash) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const changed = db
          .prepare(
            'UPDATE users SET passwordHash=?,salt=? WHERE id=? AND passwordHash=? AND disabled=0',
          )
          .run(hash.passwordHash, hash.salt, id, expectedHash);
        if (!changed.changes)
          throw new DataError('El acceso cambió en otra sesión. Inicia sesión de nuevo.', 409);
        this.revokeUser(id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    disable(id, disabled) {
      db.prepare('UPDATE users SET disabled=? WHERE id=?').run(disabled ? 1 : 0, id);
      this.revokeUser(id);
    },
    addSession(tokenHash, userId, expires) {
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash, userId, expires);
    },
    session(tokenHash) {
      return db
        .prepare(
          'SELECT users.* FROM sessions JOIN users ON users.id=sessions.userId WHERE tokenHash=? AND expires>? AND users.disabled=0',
        )
        .get(tokenHash, Date.now());
    },
    revoke(tokenHash) {
      db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(tokenHash);
    },
    revokeUser(id) {
      db.prepare('DELETE FROM sessions WHERE userId=?').run(id);
    },
    ledger(id) {
      const user = this.byId(id);
      if (!user || user.disabled) throw new DataError('Perfil no disponible.', 401);
      if (!ledgers.has(id))
        ledgers.set(
          id,
          openDatabase(
            user.legacy
              ? resolve(legacyPath)
              : join(directory, basename(legacyPath) + '.profiles', id + '.sqlite'),
          ),
        );
      return ledgers.get(id);
    },
    health: () => db.prepare('SELECT 1 AS ok').get().ok === 1,
    close() {
      for (const ledger of ledgers.values()) ledger.close();
      db.close();
    },
  };
}
