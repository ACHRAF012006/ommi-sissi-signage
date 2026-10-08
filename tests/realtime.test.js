import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {io as client} from 'socket.io-client';
import {openDatabase} from '../database/database.js';
import {createApplication} from '../app.js';
import {hashToken} from '../middleware/security.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('Socket.IO authenticates screens, routes group updates selectively, heartbeats track current media',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-socket-')),db=openDatabase(path.join(tmp,'test.db')),a=createApplication({db});const sockets=[];
 try{
  db.prepare("INSERT INTO stores(name,code) VALUES ('Tunis','TUN')").run();db.prepare("INSERT INTO display_groups(name) VALUES ('A'),('B')").run();
  const make=(group,token)=>{const identifier=crypto.randomUUID();db.prepare('INSERT INTO displays(name,store_id,group_id,unique_identifier,token_hash) VALUES (?,1,?,?,?)').run('TV',group,identifier,hashToken(token));return identifier;};
  const one=make(1,'token-1'),two=make(2,'token-2');
  await new Promise(r=>a.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${a.server.address().port}`;
  const connect=async(identifier,token)=>{const s=client(url,{auth:{identifier,token}});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  const s1=await connect(one,'token-1'),s2=await connect(two,'token-2');let unrelated=0;s2.on('group:updated',()=>unrelated++);
  const updated=new Promise(r=>s1.once('group:updated',r));a.live.group(1);await updated;await sleep(50);assert.equal(unrelated,0);
  s1.emit('display:heartbeat',{mediaId:null});await sleep(50);assert.ok(db.prepare('SELECT last_seen FROM displays WHERE unique_identifier=?').get(one).last_seen);
  const invalid=client(url,{auth:{identifier:one,token:'invalid'},reconnection:false});sockets.push(invalid);await new Promise(r=>invalid.once('connect_error',r));assert.equal(invalid.connected,false);
 }finally{sockets.forEach(s=>s.disconnect());await a.close();db.close();fs.rmSync(tmp,{recursive:true,force:true});}
});
