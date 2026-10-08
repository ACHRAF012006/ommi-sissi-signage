import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {config} from '../config/config.js';
export function openDatabase(filename = config.databasePath) {
  fs.mkdirSync(path.dirname(filename), {recursive: true});
  const db = new Database(filename);
  db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (datetime(\'now\')))');
  if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=1').get()) db.transaction(()=>{
    db.exec(fs.readFileSync(path.join(config.root,'database/schema.sql'),'utf8'));
    db.prepare('INSERT INTO schema_migrations(version) VALUES (1)').run();
  })();
  const migrations = fs.readdirSync(path.join(config.root,'database/migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort((a,b)=>parseInt(a,10)-parseInt(b,10));
  for (const file of migrations) {
    const version = Number(file.match(/^\d+/)[0]);
    if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) db.transaction(()=>{
      db.exec(fs.readFileSync(path.join(config.root,'database/migrations',file),'utf8'));
      db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version);
    })();
  }
  try { fs.chmodSync(filename,0o600); } catch {}
  return db;
}
