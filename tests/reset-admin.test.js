import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import bcrypt from 'bcryptjs';
import {openDatabase} from '../database/database.js';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-reset-admin-'));
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
function run(filename){return spawnSync(process.execPath,['scripts/reset-admin.js'],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATABASE_PATH:filename,UPLOAD_PATH:path.join(temporary,'uploads')},timeout:10000});}
test('reset script creates admin on first use and repeatedly resets the same account',async()=>{
 const filename=path.join(temporary,'fresh.db');let result=run(filename);assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes('123456789123'));
 const db=openDatabase(filename);
 try{
  const admin=db.prepare("SELECT * FROM users WHERE role='admin'").get();assert.equal(admin.username,'admin');assert.ok(await bcrypt.compare('123456789123',admin.password_hash));
  db.prepare("UPDATE users SET username='achref',password_hash=? WHERE id=?").run(bcrypt.hashSync('Different-password!',12),admin.id);
  const otherId=db.prepare("INSERT INTO users(username,password_hash) VALUES ('operator','preserved-hash')").run().lastInsertRowid;
  db.prepare("INSERT INTO stores(name,code) VALUES ('Tunis','TUN')").run();db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('admin-session',Date.now()+100000,JSON.stringify({userId:admin.id}));db.prepare('INSERT INTO sessions VALUES (?,?,?)').run('operator-session',Date.now()+100000,JSON.stringify({userId:Number(otherId)}));
  result=run(filename);assert.equal(result.status,0,result.stderr);const updated=db.prepare('SELECT * FROM users WHERE id=?').get(admin.id);assert.equal(updated.username,'admin');assert.ok(await bcrypt.compare('123456789123',updated.password_hash));assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,2);assert.equal(db.prepare("SELECT password_hash FROM users WHERE username='operator'").get().password_hash,'preserved-hash');assert.equal(db.prepare('SELECT COUNT(*) n FROM stores').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  result=run(filename);assert.equal(result.status,0,result.stderr);assert.equal(db.prepare("SELECT id FROM users WHERE role='admin'").get().id,admin.id);
 }finally{db.close();}
});
test('username collision fails atomically and never overwrites another user',()=>{
 const filename=path.join(temporary,'collision.db');const db=openDatabase(filename);
 try{
  db.prepare("INSERT INTO users(username,password_hash,role) VALUES ('owner','original-admin-hash','admin')").run();db.prepare("INSERT INTO users(username,password_hash,role) VALUES ('admin','original-user-hash','user')").run();
  const before=db.prepare('SELECT * FROM users ORDER BY id').all();const result=run(filename);assert.equal(result.status,1);assert.match(result.stderr,/appartient déjà/);assert.deepEqual(db.prepare('SELECT * FROM users ORDER BY id').all(),before);
 }finally{db.close();}
});
