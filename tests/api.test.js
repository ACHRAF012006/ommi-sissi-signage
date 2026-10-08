import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {openDatabase} from '../database/database.js';
import {createApplication} from '../app.js';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-api-'));const db=openDatabase(path.join(tmp,'test.db'));const application=createApplication({db});let agent,token,storeId,groupId,playlistId;
const headers=()=>({'X-CSRF-Token':token});
const store={name:'Tunis',code:'TUN',address:'',description:'',timezone:'Africa/Tunis',enabled:1,closed_screen_enabled:1,hours:Array.from({length:7},(_,i)=>({day_of_week:i,is_closed:i===0?1:0,opening_time:'09:00',closing_time:'20:00'})),exceptions:[]};
before(()=>{db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,\'admin\')').run('admin',bcrypt.hashSync('Test-password-2026!',12));agent=request.agent(application.app);});
after(async()=>{await application.close();db.close();fs.rmSync(tmp,{recursive:true,force:true});});
test('authentication protects pages and API, enforces CSRF, hashes passwords and rotates session',async()=>{
 await request(application.app).get('/admin/stores').expect(302);await request(application.app).get('/api/stores').expect(401);
 const session=await agent.get('/auth/session').expect(200);token=session.body.data.csrfToken;
 await agent.post('/auth/login').send({username:'admin',password:'wrong'}).expect(403);
 await agent.post('/auth/login').set(headers()).send({username:'admin',password:'wrong'}).expect(401);
 const login=await agent.post('/auth/login').set(headers()).send({username:'admin',password:'Test-password-2026!'}).expect(200);assert.notEqual(login.body.data.csrfToken,token);token=login.body.data.csrfToken;
 await agent.get('/admin').expect(200);assert.match(db.prepare('SELECT password_hash FROM users').get().password_hash,/^\$2/);
});
test('stores CRUD, hours validation and foreign keys',async()=>{
 const response=await agent.post('/api/stores').set(headers()).send(store).expect(201);storeId=response.body.data.id;
 const list=await agent.get('/api/stores').expect(200);assert.equal(list.body.data[0].hours.length,7);
 await agent.put(`/api/stores/${storeId}`).set(headers()).send({...store,name:'Tunis Centre'}).expect(200);
 await agent.post('/api/stores').set(headers()).send({...store,code:'INVALID',hours:[]}).expect(400);
 await agent.post('/api/stores').set(headers()).send(store).expect(409);
});
test('groups CRUD and assigned playlist retrieval',async()=>{
 const p=await agent.post('/api/playlists').set(headers()).send({name:'Promotions',items:[]}).expect(201);playlistId=p.body.data.id;
 const g=await agent.post('/api/groups').set(headers()).send({name:'Entrée',playlist_id:playlistId}).expect(201);groupId=g.body.data.id;
 await agent.put(`/api/groups/${groupId}`).set(headers()).send({name:'Promotions',playlist_id:playlistId}).expect(200);
 const d=await request(application.app).post('/api/display/register').send({unique_identifier:crypto.randomUUID(),store_id:storeId,group_id:groupId}).expect(201);
 const auth={'Authorization':`Bearer ${d.body.data.token}`};
 const response=await request(application.app).get(`/api/display/${d.body.data.identifier}/playlist`).set(auth).expect(200);assert.equal(response.body.data.playlist.name,'Promotions');assert.equal(response.body.data.store.name,'Tunis Centre');
 await request(application.app).get(`/api/display/${d.body.data.identifier}/playlist`).expect(401);
 await request(application.app).post('/api/display/register').send({unique_identifier:d.body.data.identifier,store_id:storeId,group_id:groupId}).expect(403);
 await agent.delete(`/api/groups/${groupId}`).set(headers()).expect(409);
 await agent.delete(`/api/stores/${storeId}`).set(headers()).expect(409);
});
test('media signatures, streamed uploads, playlist order, range requests and delete safety',async()=>{
 const upload=await agent.post('/api/media').set(headers()).attach('files',path.resolve('IMG_LOGO.png')).expect(201);const m=upload.body.data[0];
 try {
  await agent.post('/api/media').set(headers()).attach('files',Buffer.from('<script>alert(1)</script>'),{filename:'bad.png',contentType:'image/png'}).expect(415);
  const items=[{media_id:m.id,image_duration_seconds:5},{media_id:m.id,image_duration_seconds:8}];
  await agent.put(`/api/playlists/${playlistId}`).set(headers()).send({name:'Promotions',items}).expect(200);
  const p=await agent.get(`/api/playlists/${playlistId}`).expect(200);assert.deepEqual(p.body.data.items.map(x=>x.image_duration_seconds),[5,8]);
  await request(application.app).get(m.url).set('Range','bytes=0-31').expect(206);
  await agent.delete(`/api/media/${m.id}`).set(headers()).expect(409);
  await agent.delete(`/api/media/${m.id}?force=true`).set(headers()).expect(200);
  const empty=await agent.get(`/api/playlists/${playlistId}`).expect(200);assert.equal(empty.body.data.items.length,0);
 } finally { if(db.prepare('SELECT id FROM media WHERE id=?').get(m.id))await agent.delete(`/api/media/${m.id}?force=true`).set(headers()); }
});
test('CRUD deletions preserve database consistency and initialization preserves data',async()=>{
 await agent.delete(`/api/groups/${groupId}?force=true`).set(headers()).expect(200);
 await agent.delete(`/api/stores/${storeId}`).set(headers()).expect(200);
 await agent.delete(`/api/playlists/${playlistId}`).set(headers()).expect(200);
 assert.equal(db.pragma('foreign_key_check').length,0);
 const second=openDatabase(path.join(tmp,'test.db'));assert.equal(second.prepare('SELECT COUNT(*) n FROM users').get().n,1);second.close();
});

test('static serving rejects traversal and keeps administration source and temporary uploads private',async()=>{
 await request(application.app).get('/admin/index.html').expect(302);await agent.get('/admin/index.html').expect(404);
 await request(application.app).get('/media/tmp/private.upload').expect(404);
 await request(application.app).get('/media/images/%2e%2e%2f%2e%2e%2f.env').expect(404);
 await request(application.app).get('/assets/../../.env').expect(404);
 await agent.post('/api/stores').set(headers()).set('Content-Type','application/json').send('{broken').expect(400);
});


test('HTML versions its entire module graph and JS/CSS require cache revalidation',async()=>{
 const html=await agent.get('/admin').expect(200);assert.equal(html.headers['cache-control'],'no-store');
 const entry=html.text.match(/src="(\/js\/v[a-f0-9]{16}\/admin-bootstrap\.js)"/)[1];
 const script=await request(application.app).get(entry).expect(200);assert.equal(script.headers['cache-control'],'no-cache');assert.match(script.text,/import\('\.\/admin\.js'\)/);
 const common=await request(application.app).get(entry.replace('admin-bootstrap.js','common.js')).expect(200);assert.match(common.text,/export function uuid/);
 const legacy=await request(application.app).get('/js/common.js').expect(200);assert.equal(legacy.headers['cache-control'],'no-cache');
 const css=await request(application.app).get('/css/app.css').expect(200);assert.equal(css.headers['cache-control'],'no-cache');
 const login=await request(application.app).get('/admin/login').expect(200);assert.equal(login.headers['cache-control'],'no-store');
 const tv=await request(application.app).get('/display').expect(200);assert.equal(tv.headers['cache-control'],'no-store');assert.match(tv.text,/src="\/js\/v[a-f0-9]{16}\/display\.js"/);
 await request(application.app).get('/js/v0123456789abcdef/../../.env').expect(404);
});
