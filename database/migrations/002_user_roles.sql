-- Preserve the oldest administrator and all account credentials.
CREATE TABLE users_with_roles (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO users_with_roles (id,username,password_hash,role,created_at,updated_at)
 SELECT id,username,password_hash,
 CASE WHEN role='admin' AND id=(SELECT MIN(id) FROM users WHERE role='admin') THEN 'admin' ELSE 'user' END,
 created_at,updated_at FROM users;
DELETE FROM sessions WHERE json_valid(data) AND json_extract(data,'$.userId') IN (
 SELECT old.id FROM users old JOIN users_with_roles current ON current.id=old.id WHERE old.role<>current.role
);
DROP TABLE users;
ALTER TABLE users_with_roles RENAME TO users;
CREATE UNIQUE INDEX users_single_administrator ON users(role) WHERE role='admin';
CREATE TRIGGER users_keep_administrator_role BEFORE UPDATE OF role ON users
 WHEN OLD.role='admin' AND NEW.role<>'admin'
 BEGIN SELECT RAISE(ABORT,'L’administrateur unique doit conserver son rôle.'); END;
CREATE TRIGGER users_keep_administrator BEFORE DELETE ON users
 WHEN OLD.role='admin'
 BEGIN SELECT RAISE(ABORT,'L’administrateur unique ne peut pas être supprimé.'); END;
