import 'dotenv/config';
import {parseTrustProxy} from './proxy.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolve = value => path.resolve(root, value);
const positive = (value, fallback) => { const n = Number(value || fallback); if (!Number.isFinite(n) || n <= 0) throw new Error('Configuration numérique invalide'); return n; };
const dataDir = resolve('data');
fs.mkdirSync(dataDir, {recursive: true, mode: 0o700});
let secret = process.env.SESSION_SECRET;
if (!secret || secret === 'CHANGE_ME') {
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET doit être défini en production (au moins 32 caractères).');
  const secretPath = path.join(dataDir, '.session-secret');
  if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, crypto.randomBytes(48).toString('hex'), {mode: 0o600});
  secret = fs.readFileSync(secretPath, 'utf8').trim();
}
if (secret.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
export const config = {
  root, host: process.env.HOST || '0.0.0.0', port: positive(process.env.PORT, 3000),
  production: process.env.NODE_ENV === 'production', secret,
  databasePath: resolve(process.env.DATABASE_PATH || './data/ommisissi.db'),
  uploadPath: resolve(process.env.UPLOAD_PATH || './uploads'),
  timezone: process.env.TIMEZONE || 'Africa/Tunis',
  maxUploadBytes: positive(process.env.MAX_UPLOAD_SIZE_MB, 1000) * 1024 * 1024,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY), secureCookie: process.env.COOKIE_SECURE === 'true',
  registration: process.env.ALLOW_DISPLAY_REGISTRATION !== 'false',
  offlineSeconds: positive(process.env.OFFLINE_TIMEOUT_SECONDS, 90)
};
new Intl.DateTimeFormat('fr', {timeZone: config.timezone});
for (const dir of [path.dirname(config.databasePath), config.uploadPath, ...['images', 'videos', 'thumbnails', 'tmp'].map(d=>path.join(config.uploadPath,d)), resolve('logs'), resolve('backups')]) fs.mkdirSync(dir, {recursive:true, mode:0o700});
