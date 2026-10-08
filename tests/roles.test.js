import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import {io as connect} from 'socket.io-client';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-roles-'));
process.env.DATABASE_PATH=path.join(temporary,'app.db');process.env.UPLOAD_PATH=path.join(temporary,'uploads');process.env.NODE_ENV='test';
const {openDatabase}=await import('../database/database.js');
const {createApplication}=await import('../app.js');
const {saveAdministrator,administratorTarget}=await import('../services/userService.js');
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));

test('role migration preserves credentials/data, keeps one admin, revokes demoted sessions and survives restart',()=>{
 const file=path.join(temporary,'legacy.db');const legacy=new Database(file);
 legacy.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT DEFAULT (datetime('now')))");
 legacy.exec(fs.readFileSync('database/schema.sql','utf8'));legacy.prepare('INSERT INTO schema_migrations(version) VALUES (1)').run();
 const insert=legacy.prepare('INSERT INTO users(id,username,password_hash,role) VALUES (?,?,?,?)');
 insert.run(5,'owner','original-owner-hash','admin');insert.run(9,'former-admin','original-user-hash','admin');insert.run(12,'existing-user','another-hash','user');
 const session=legacy.prepare('INSERT INTO sessions VALUES (?,?,?)');session.run('owner-session',Date.now()+10000,JSON.stringify({userId:5}));session.run('converted-session',Date.now()+10000,JSON.stringify({userId:9}));
 legacy.prepare('INSERT INTO stores(name,code) VALUES (?,?)').run('Existing store','EXISTING');legacy.close();
 const db=openDatabase(file);
 try{
  assert.deepEqual(db.prepare('SELECT id,role,password_hash FROM users ORDER BY id').all(),[{id:5,role:'admin',password_hash:'original-owner-hash'},{id:9,role:'user',password_hash:'original-user-hash'},{id:12,role:'user',password_hash:'another-hash'}]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM stores').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
  assert.throws(()=>db.prepare("INSERT INTO users(username,password_hash,role) VALUES ('second','hash','admin')").run(),/UNIQUE/);
  assert.throws(()=>db.prepare("UPDATE users SET role='user' WHERE id=5").run());assert.throws(()=>db.prepare('DELETE FROM users WHERE id=5').run());
  assert.throws(()=>db.prepare("UPDATE users SET role='admin' WHERE id=9").run());assert.throws(()=>db.prepare("UPDATE users SET role='unknown' WHERE id=12").run());
  db.prepare("INSERT INTO users(username,password_hash) VALUES ('default-user','hash')").run();assert.equal(db.prepare("SELECT role FROM users WHERE username='default-user'").get().role,'user');
 }finally{db.close();}
 const reopened=openDatabase(file);assert.equal(reopened.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n,1);assert.equal(reopened.pragma('foreign_key_check').length,0);reopened.close();
});

test('CLI account service creates/resets only the unique administrator',async()=>{
 const db=openDatabase(path.join(temporary,'cli.db'));
 try{
  const id=await saveAdministrator(db,'owner','Original-owner-password!');assert.equal(administratorTarget(db,'OWNER').id,id);
  db.prepare("INSERT INTO users(username,password_hash) VALUES ('operator','hash')").run();
  assert.throws(()=>administratorTarget(db,'second-admin'),/Un seul administrateur/);await assert.rejects(saveAdministrator(db,'operator','Another-owner-password!'),/Un seul administrateur/);
  assert.equal(await saveAdministrator(db,'owner','Changed-owner-password!'),id);assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n,1);
 }finally{db.close();}
});

test('users manage signage and existing stores, while privileged pages/actions and role escalation are blocked',async()=>{
 const application=createApplication();let socket;
 try{
  await saveAdministrator(application.db,'owner','Owner-test-password!');const admin=request.agent(application.app),user=request.agent(application.app);
  const login=async(agent,username,password)=>{const state=await agent.get('/auth/session');return agent.post('/auth/login').set('X-CSRF-Token',state.body.data.csrfToken).send({username,password}).expect(200);};
  const adminLogin=await login(admin,'owner','Owner-test-password!'),adminHeaders={'X-CSRF-Token':adminLogin.body.data.csrfToken};
  const created=await admin.post('/api/users').set(adminHeaders).send({username:'operator',password:'Operator-test-password!'}).expect(201);const userId=created.body.data.id;assert.equal(created.body.data.role,'user');
  await admin.post('/api/users').set(adminHeaders).send({username:'second-admin',password:'Second-admin-password!',role:'admin'}).expect(409);
  await admin.put(`/api/users/${userId}`).set(adminHeaders).send({username:'operator',password:'Operator-test-password!',role:'admin'}).expect(400);
  const adminId=application.db.prepare("SELECT id FROM users WHERE role='admin'").get().id;
  await admin.put(`/api/users/${adminId}`).set(adminHeaders).send({username:'owner',password:'Owner-test-password!',role:'user'}).expect(400);
  await admin.delete(`/api/users/${adminId}`).set(adminHeaders).expect(400);
  const hours=Array.from({length:7},(_,day_of_week)=>({day_of_week,is_closed:0,opening_time:'09:00',closing_time:'20:00'}));
  const store=(await admin.post('/api/stores').set(adminHeaders).send({name:'Tunis',code:'TUN',hours}).expect(201)).body.data;
  const userLogin=await login(user,'operator','Operator-test-password!'),headers={'X-CSRF-Token':userLogin.body.data.csrfToken};assert.equal(userLogin.body.data.role,'user');
  assert.equal((await user.get('/auth/session')).body.data.user.role,'user');
  for(const page of ['','/stores','/displays','/groups','/media','/playlists','/scheduling'])await user.get('/admin'+page).expect(200);
  for(const page of ['/users','/settings','/settings/']){const denied=await user.get('/admin'+page).expect(302);assert.equal(denied.headers.location,'/admin');}
  for(const route of ['/dashboard','/stores','/displays','/groups','/media','/playlists','/overrides'])await user.get('/api'+route).expect(200);
  for(const route of ['/users','/settings'])await user.get('/api'+route).expect(403);
  await user.post('/api/stores').set(headers).send({name:'Forbidden',code:'NO',hours}).expect(403);
  await user.post('/api/users').set(headers).send({username:'bypass',password:'Bypass-test-password!'}).expect(403);
  await user.put(`/api/users/${adminId}`).set(headers).send({username:'hacked',password:'Bypass-test-password!',role:'admin'}).expect(403);
  await user.delete(`/api/users/${adminId}`).set(headers).expect(403);await user.put('/api/settings').set(headers).send({company_name:'Changed'}).expect(403);
  await user.put(`/api/stores/${store.id}`).set(headers).send({name:'Tunis Centre',code:'TUN',hours:hours.map(h=>({...h,closing_time:'21:00'}))}).expect(200);
  const media=(await user.post('/api/media').set(headers).attach('files','IMG_LOGO.png').expect(201)).body.data[0];
  await user.put(`/api/media/${media.id}`).set(headers).send({title:'User campaign',description:'Updated'}).expect(200);
  const playlist=(await user.post('/api/playlists').set(headers).send({name:'User playlist',items:[{media_id:media.id}]}).expect(201)).body.data;
  await user.get(`/api/playlists/${playlist.id}`).expect(200);await user.get(`/api/playlists/${playlist.id}/preview`).expect(200);
  const group=(await user.post('/api/groups').set(headers).send({name:'User group',playlist_id:playlist.id}).expect(201)).body.data;
  await user.put(`/api/groups/${group.id}`).set(headers).send({name:'Updated group',playlist_id:playlist.id}).expect(200);
  await user.put('/api/overrides').set(headers).send({store_id:store.id,group_id:group.id,playlist_id:playlist.id}).expect(200);
  const display=(await user.post('/api/display/register').send({unique_identifier:crypto.randomUUID(),store_id:store.id,group_id:group.id}).expect(201)).body.data;
  await user.put(`/api/displays/${display.id}`).set(headers).send({name:'User screen',store_id:store.id,group_id:group.id}).expect(200);
  await user.post(`/api/displays/${display.id}/refresh`).set(headers).expect(200);
  await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));
  const cookie=userLogin.headers['set-cookie'].map(value=>value.split(';')[0]).join('; ');
  socket=connect(`http://127.0.0.1:${application.server.address().port}`,{transports:['websocket'],extraHeaders:{Cookie:cookie},auth:{admin:true},reconnection:false});
  const event=name=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Missing socket event '+name)),4000);socket.once(name,(...args)=>{clearTimeout(timeout);resolve(args);});});
  await event('connect');const updated=event('data:updated');application.live.admin();await updated;
  await user.delete(`/api/displays/${display.id}`).set(headers).expect(200);await user.delete(`/api/groups/${group.id}`).set(headers).expect(200);await user.delete(`/api/playlists/${playlist.id}`).set(headers).expect(200);await user.delete(`/api/media/${media.id}`).set(headers).expect(200);await user.delete(`/api/stores/${store.id}`).set(headers).expect(200);
  const disconnected=event('disconnect');await admin.delete(`/api/users/${userId}`).set(adminHeaders).expect(200);await disconnected;await user.get('/api/dashboard').expect(401);
  assert.equal(application.db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin'").get().n,1);
  const logoutUser=(await admin.post('/api/users').set(adminHeaders).send({username:'logout-user',password:'Logout-user-password!'}).expect(201)).body.data;
  const second=request.agent(application.app),secondLogin=await login(second,logoutUser.username,'Logout-user-password!');await second.post('/auth/logout').set('X-CSRF-Token',secondLogin.body.data.csrfToken).expect(200);assert.equal((await second.get('/auth/session')).body.data.user,null);
 }finally{socket?.disconnect();await application.close();}
});
