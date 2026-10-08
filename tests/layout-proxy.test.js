import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {io as connect} from 'socket.io-client';
import {parseTrustProxy,sameOrigin,requestOrigin} from '../config/proxy.js';
import {fitMedia} from '../public/js/playerLayout.js';
import {openDatabase} from '../database/database.js';
import {createApplication} from '../app.js';

test('16:9 media fits landscape, portrait and ultrawide spaces including frame borders',()=>{
 for(const [width,height]of [[1920,850],[3840,1900],[360,640],[3440,1100],[800,800],[0,0]]){
  const size=fitMedia(width,height,8,8);
  assert.ok(size.width+8<=Math.max(width,8));assert.ok(size.height+8<=Math.max(height,8));
  if(size.width)assert.ok(Math.abs(size.width/size.height-16/9)<1e-12);
 }
});
test('proxy configuration accepts explicit addresses/CIDRs and rejects invalid values',()=>{
 assert.deepEqual(parseTrustProxy('10.2.2.2'),['10.2.2.2']);assert.deepEqual(parseTrustProxy('10.2.2.2, ::1/128'),['10.2.2.2','::1/128']);
 assert.equal(parseTrustProxy('false'),false);assert.equal(parseTrustProxy('true'),1);
 for(const value of ['any','10.2.2.2/33','::1/129','10.2.2.2/','10.2.2.2,'])assert.throws(()=>parseTrustProxy(value));
});
test('forwarded host, port and HTTPS apply only to the trusted immediate proxy',()=>{
 const req={socket:{remoteAddress:'10.2.2.2'},headers:{host:'internal:3000','x-forwarded-host':'signage.example:8443, discarded.example','x-forwarded-proto':'https, http',origin:'https://signage.example:8443'}};
 const trust=ip=>ip==='10.2.2.2';assert.equal(requestOrigin(req,trust),'https://signage.example:8443');assert.equal(sameOrigin(req,trust),true);
 req.socket.remoteAddress='192.168.1.80';assert.equal(requestOrigin(req,trust),'http://internal:3000');assert.equal(sameOrigin(req,trust),false);
 req.headers.origin='http://internal:3000';assert.equal(sameOrigin(req,trust),true);
 req.headers.origin='https://evil.example';assert.equal(sameOrigin(req,trust),false);
});
test('landing page, proxy login CSRF and Socket.IO origin validation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-proxy-'));const db=openDatabase(path.join(dir,'test.db'));const application=createApplication({db});let socket;
 try{
  db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,\'admin\')').run('proxy-test',bcrypt.hashSync('Proxy-test-password!',12));
  const landing=await request(application.app).get('/').expect(200);assert.match(landing.text,/id="landing-admin" href="\/admin\/login"/);assert.match(landing.text,/id="landing-display" href="\/display"/);assert.match(landing.text,/app-fullscreen/);
  // Loopback simulates the trusted proxy in this temporary application only.
  application.app.set('trust proxy',['loopback']);
  const agent=request.agent(application.app);const session=await agent.get('/auth/session').expect(200);
  const forwarded={'X-CSRF-Token':session.body.data.csrfToken,'X-Forwarded-Proto':'https','X-Forwarded-Host':'signage.example:8443',Origin:'https://signage.example:8443',Host:'internal:3000'};
  const login=await agent.post('/auth/login').set(forwarded).send({username:'proxy-test',password:'Proxy-test-password!'}).expect(200);
  await agent.get('/admin').expect(200);
  application.app.set('trust proxy',['10.2.2.2']);
  await agent.post('/auth/logout').set({...forwarded,'X-CSRF-Token':login.body.data.csrfToken}).expect(403);
  await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));
  const socketURL=`http://127.0.0.1:${application.server.address().port}/socket.io/?EIO=4&transport=polling`;
  const denied=await fetch(socketURL,{headers:{Origin:forwarded.Origin,'X-Forwarded-Host':forwarded['X-Forwarded-Host'],'X-Forwarded-Proto':'https'}});assert.equal(denied.status,403);
  application.app.set('trust proxy',['loopback']);
  const accepted=await fetch(socketURL,{headers:{Origin:forwarded.Origin,'X-Forwarded-Host':forwarded['X-Forwarded-Host'],'X-Forwarded-Proto':'https'}});assert.equal(accepted.status,200);assert.match(await accepted.text(),/^0\{/);
  const storeId=db.prepare('INSERT INTO stores(name,code) VALUES (?,?)').run('Proxy','PROXY').lastInsertRowid;
  const groupId=db.prepare('INSERT INTO display_groups(name) VALUES (?)').run('Proxy').lastInsertRowid;
  const display=await request(application.app).post('/api/display/register').send({unique_identifier:crypto.randomUUID(),store_id:Number(storeId),group_id:Number(groupId)}).expect(201);
  socket=connect(`http://127.0.0.1:${application.server.address().port}`,{transports:['websocket'],extraHeaders:{Origin:forwarded.Origin,'X-Forwarded-Host':forwarded['X-Forwarded-Host'],'X-Forwarded-Proto':'https'},auth:{identifier:display.body.data.identifier,token:display.body.data.token},reconnection:false});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Proxy websocket timed out')),5000);socket.once('connect',()=>{clearTimeout(timeout);resolve();});socket.once('connect_error',e=>{clearTimeout(timeout);reject(e);});});assert.equal(socket.connected,true);
 }finally{socket?.disconnect();await application.close();db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
