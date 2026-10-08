import {Router} from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {config} from '../config/config.js';
import {ok,fail,csrf,hashToken} from '../middleware/security.js';
import {requireAdmin,requireStaff,requireDisplay} from '../middleware/auth.js';
import {id,storeSchema,groupSchema,displaySchema,playlistSchema,userSchema} from '../services/validation.js';
import {displaySnapshot,playlistItems,mediaView} from '../services/playlistService.js';
import {upload,inspectUpload,removeMediaFiles} from '../middleware/upload.js';
import {log} from '../services/logger.js';
export function apiRoutes(db,live) {
 const r=Router(), getId=req=>id.parse(req.params.id);
 const existing=(table,key)=>{const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(key);if(!row)fail(404,'NOT_FOUND','Élément introuvable.');return row;};
 const reference=(table,key)=>{if(key)existing(table,key);};
 const insert=(table,data)=>{const keys=Object.keys(data);return Number(db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(data)).lastInsertRowid);};
 const update=(table,key,data)=>db.prepare(`UPDATE ${table} SET ${Object.keys(data).map(k=>`${k}=?`).join(',')},updated_at=datetime('now') WHERE id=?`).run(...Object.values(data),key);
 const displays=()=>db.prepare(`SELECT d.id,d.name,d.store_id,d.group_id,d.unique_identifier,d.enabled,d.last_seen,d.browser_info,d.ip_address,d.created_at,s.name store_name,g.name group_name,m.title current_media,CASE WHEN d.last_seen >= datetime('now',?) THEN 1 ELSE 0 END online FROM displays d JOIN stores s ON s.id=d.store_id JOIN display_groups g ON g.id=d.group_id LEFT JOIN media m ON m.id=d.current_media_id ORDER BY d.name`).all(`-${config.offlineSeconds} seconds`);
 r.get('/display/setup',(req,res)=>{res.set('Cache-Control','no-store');ok(res,{registrationEnabled:config.registration,stores:db.prepare('SELECT id,name,code FROM stores WHERE enabled=1 ORDER BY name').all(),groups:db.prepare('SELECT id,name FROM display_groups WHERE enabled=1 ORDER BY name').all()});});
 r.post('/display/register',rateLimit({windowMs:60000,limit:30,legacyHeaders:false,standardHeaders:'draft-8',handler:(_req,res)=>res.status(429).json({success:false,error:{code:'RATE_LIMIT',message:'Trop d’inscriptions. Réessayez dans une minute.'}})}),(req,res)=>{
  if(!config.registration)fail(403,'REGISTRATION_CLOSED','L’inscription des écrans est désactivée. Contactez votre administrateur.');
  const v=z.object({unique_identifier:z.string().uuid(),store_id:id,group_id:id,token:z.string().max(150).optional()}).parse(req.body);
  const store=existing('stores',v.store_id),group=existing('display_groups',v.group_id);
  if(!store.enabled||!group.enabled)fail(400,'DISABLED','Magasin ou groupe désactivé.');
  const found=db.prepare('SELECT * FROM displays WHERE unique_identifier=?').get(v.unique_identifier);
  if(found&&(!v.token||hashToken(v.token)!==found.token_hash))fail(403,'DISPLAY_TOKEN','Identité de l’écran non valide.');
  const token=v.token||crypto.randomBytes(32).toString('hex');
  const values={store_id:v.store_id,group_id:v.group_id,unique_identifier:v.unique_identifier,token_hash:hashToken(token),browser_info:(req.get('user-agent')||'').slice(0,500),ip_address:req.ip||''};
  let key;
  if(found){key=found.id;update('displays',key,values);}else key=insert('displays',{...values,name:`${store.name} · Écran ${v.unique_identifier.slice(0,5)}`});
  live.display(key);ok(res,{identifier:v.unique_identifier,token,id:key},found?200:201);
 });
 r.get('/display/:displayId/playlist',requireDisplay,(req,res)=>{res.set('Cache-Control','no-store');ok(res,displaySnapshot(db,req.display));});
 r.post('/display/:displayId/heartbeat',requireDisplay,(req,res)=>{
  const mediaId=z.coerce.number().int().positive().nullish().parse(req.body.mediaId);
  db.prepare("UPDATE displays SET last_seen=datetime('now'),current_media_id=? WHERE id=?").run(mediaId&&db.prepare('SELECT id FROM media WHERE id=?').get(mediaId)?mediaId:null,req.display.id);ok(res,null);
 });
 r.use(requireStaff,csrf,(req,_res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&existsSync(path.join(path.dirname(config.databasePath),'.backup-lock')))return fail(503,'BACKUP_RUNNING','Une sauvegarde est en cours. Réessayez dans quelques instants.');next();});
 r.get('/dashboard',(_req,res)=>{
  const list=displays();const counts={stores:db.prepare('SELECT COUNT(*) n FROM stores').get().n,groups:db.prepare('SELECT COUNT(*) n FROM display_groups').get().n,media:db.prepare('SELECT COUNT(*) n FROM media').get().n,playlists:db.prepare('SELECT COUNT(*) n FROM playlists').get().n,online:list.filter(x=>x.online).length,offline:list.filter(x=>!x.online).length};
  ok(res,{counts,displays:list,media:db.prepare('SELECT * FROM media ORDER BY id DESC LIMIT 4').all().map(mediaView)});
 });
 r.get('/stores',(_req,res)=>ok(res,db.prepare('SELECT s.*,(SELECT COUNT(*) FROM displays d WHERE d.store_id=s.id) display_count FROM stores s ORDER BY name').all().map(s=>({...s,hours:db.prepare('SELECT * FROM store_hours WHERE store_id=? ORDER BY day_of_week').all(s.id),exceptions:db.prepare('SELECT * FROM store_exceptions WHERE store_id=? ORDER BY date').all(s.id)}))));
 const saveStore=db.transaction((key,v)=>{
  const {hours,exceptions,...base}=v;
  if(key)update('stores',key,base);else key=insert('stores',base);
  db.prepare('DELETE FROM store_hours WHERE store_id=?').run(key);
  for(const h of hours)insert('store_hours',{store_id:key,...h});
  db.prepare('DELETE FROM store_exceptions WHERE store_id=?').run(key);
  for(const e of exceptions)insert('store_exceptions',{store_id:key,...e});return key;
 });
 r.post('/stores',requireAdmin,(req,res)=>{const key=saveStore(null,storeSchema.parse(req.body));live.admin();ok(res,existing('stores',key),201);});
 r.put('/stores/:id',(req,res)=>{const key=getId(req);existing('stores',key);saveStore(key,storeSchema.parse(req.body));live.store(key);ok(res,existing('stores',key));});
 r.delete('/stores/:id',(req,res)=>{
  const key=getId(req);existing('stores',key);const count=db.prepare('SELECT COUNT(*) n FROM displays WHERE store_id=?').get(key).n;
  if(count&&req.query.force!=='true')fail(409,'IN_USE',`Ce magasin contient ${count} écran(s). Leurs inscriptions seront supprimées.`,{count});
  const ids=db.prepare('SELECT id FROM displays WHERE store_id=?').all(key);db.prepare('DELETE FROM stores WHERE id=?').run(key);
  ids.forEach(d=>live.display(d.id,'display:deleted'));live.admin();ok(res,null);
 });
 r.get('/groups',(_req,res)=>ok(res,db.prepare('SELECT g.*,p.name playlist_name,(SELECT COUNT(*) FROM displays d WHERE d.group_id=g.id) display_count FROM display_groups g LEFT JOIN playlists p ON p.id=g.playlist_id ORDER BY g.name').all()));
 r.post('/groups',(req,res)=>{const v=groupSchema.parse(req.body);reference('playlists',v.playlist_id);const key=insert('display_groups',v);live.admin();ok(res,existing('display_groups',key),201);});
 r.put('/groups/:id',(req,res)=>{const key=getId(req);existing('display_groups',key);const v=groupSchema.parse(req.body);reference('playlists',v.playlist_id);update('display_groups',key,v);live.group(key);ok(res,existing('display_groups',key));});
 r.delete('/groups/:id',(req,res)=>{
  const key=getId(req);existing('display_groups',key);const ids=db.prepare('SELECT id FROM displays WHERE group_id=?').all(key);
  if(ids.length&&req.query.force!=='true')fail(409,'IN_USE',`Ce groupe contient ${ids.length} écran(s). Leurs inscriptions seront supprimées.`,{count:ids.length});
  db.prepare('DELETE FROM display_groups WHERE id=?').run(key);ids.forEach(d=>live.display(d.id,'display:deleted'));live.admin();ok(res,null);
 });
 r.get('/overrides',(_req,res)=>ok(res,db.prepare('SELECT * FROM store_group_overrides').all()));
 r.put('/overrides',(req,res)=>{
  const v=z.object({store_id:id,group_id:id,playlist_id:id.nullable()}).parse(req.body);
  reference('stores',v.store_id);reference('display_groups',v.group_id);reference('playlists',v.playlist_id);
  if(v.playlist_id)db.prepare('INSERT INTO store_group_overrides VALUES (?,?,?) ON CONFLICT(store_id,group_id) DO UPDATE SET playlist_id=excluded.playlist_id').run(v.store_id,v.group_id,v.playlist_id);
  else db.prepare('DELETE FROM store_group_overrides WHERE store_id=? AND group_id=?').run(v.store_id,v.group_id);
  live.store(v.store_id);ok(res,null);
 });
 r.get('/displays',(_req,res)=>ok(res,displays()));
 r.put('/displays/:id',(req,res)=>{const key=getId(req);existing('displays',key);const v=displaySchema.parse(req.body);reference('stores',v.store_id);reference('display_groups',v.group_id);update('displays',key,v);live.display(key);ok(res,displays().find(d=>d.id===key));});
 r.delete('/displays/:id',(req,res)=>{const key=getId(req);existing('displays',key);db.prepare('DELETE FROM displays WHERE id=?').run(key);live.display(key,'display:deleted');ok(res,null);});
 r.post('/displays/:id/:command',(req,res)=>{const key=getId(req);existing('displays',key);const command=z.enum(['reload','refresh']).parse(req.params.command);live.display(key,command==='reload'?'display:reload':'playlist:updated');ok(res,null);});
 r.get('/media',(_req,res)=>ok(res,db.prepare('SELECT m.*,(SELECT COUNT(DISTINCT playlist_id) FROM playlist_items WHERE media_id=m.id) playlist_count FROM media m ORDER BY id DESC').all().map(mediaView)));
 r.post('/media',upload,async(req,res)=>{
  if(!req.files?.length)fail(400,'NO_FILE','Sélectionnez au moins un fichier.');
  const inspected=[];
  try{
   for(const file of req.files)inspected.push(await inspectUpload(file));
   const rows=db.transaction(()=>inspected.map(m=>mediaView(existing('media',insert('media',m)))))();
   live.admin();log('media.uploaded',{count:rows.length});ok(res,rows,201);
  }catch(e){for(const m of inspected)await removeMediaFiles(m);throw e;}
  finally{for(const f of req.files)await fs.unlink(f.path).catch(()=>{});}
 });
 r.put('/media/:id',(req,res)=>{const key=getId(req);existing('media',key);const v=z.object({title:z.string().trim().min(1).max(250),description:z.string().max(4000).default('')}).parse(req.body);update('media',key,v);const p=db.prepare('SELECT DISTINCT playlist_id FROM playlist_items WHERE media_id=?').all(key);p.forEach(x=>live.playlist(x.playlist_id));live.admin();ok(res,mediaView(existing('media',key)));});
 r.delete('/media/:id',async(req,res)=>{
  const key=getId(req),m=existing('media',key),uses=db.prepare('SELECT DISTINCT p.id,p.name FROM playlists p JOIN playlist_items pi ON pi.playlist_id=p.id WHERE pi.media_id=?').all(key);
  if(uses.length&&req.query.force!=='true')fail(409,'IN_USE',`Ce média est utilisé dans ${uses.length} playlist(s).`,{playlists:uses});
  db.transaction(()=>{db.prepare('DELETE FROM playlist_items WHERE media_id=?').run(key);db.prepare('DELETE FROM media WHERE id=?').run(key);})();
  await removeMediaFiles(m);uses.forEach(x=>live.playlist(x.id));live.admin();ok(res,null);
 });
 r.get('/playlists',(_req,res)=>ok(res,db.prepare('SELECT p.*,(SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id=p.id) item_count,(SELECT COUNT(*) FROM display_groups g WHERE g.playlist_id=p.id) group_count FROM playlists p ORDER BY name').all()));
 r.get('/playlists/:id',(req,res)=>{const key=getId(req);ok(res,{...existing('playlists',key),items:playlistItems(db,key)});});
 r.get('/playlists/:id/preview',(req,res)=>{
  const key=getId(req),playlist=existing('playlists',key);
  // Preview keeps the complete playlist; the player still honors item schedules.
  ok(res,{playlist,catalog:playlistItems(db,key),items:playlistItems(db,key),store:{name:'Aperçu',timezone:config.timezone},disabled:!playlist.enabled,serverTime:new Date().toISOString(),schedule:{open:true,closedScreenEnabled:false}});
 });
 const savePlaylist=db.transaction((key,v)=>{
  const {items,...base}=v;for(const item of items)reference('media',item.media_id);
  if(key)update('playlists',key,base);else key=insert('playlists',base);
  db.prepare('DELETE FROM playlist_items WHERE playlist_id=?').run(key);
  items.forEach((item,i)=>insert('playlist_items',{playlist_id:key,...item,sort_order:i}));return key;
 });
 r.post('/playlists',(req,res)=>{const key=savePlaylist(null,playlistSchema.parse(req.body));live.admin();ok(res,existing('playlists',key),201);});
 r.put('/playlists/:id',(req,res)=>{const key=getId(req);existing('playlists',key);savePlaylist(key,playlistSchema.parse(req.body));live.playlist(key);log('playlist.changed',{playlistId:key,userId:req.user.id});ok(res,existing('playlists',key));});
 r.delete('/playlists/:id',(req,res)=>{
  const key=getId(req);existing('playlists',key);const groups=db.prepare('SELECT id FROM display_groups WHERE playlist_id=? UNION SELECT group_id AS id FROM store_group_overrides WHERE playlist_id=?').all(key,key);
  if(groups.length&&req.query.force!=='true')fail(409,'IN_USE',`Cette playlist est utilisée par ${groups.length} groupe(s).`,{count:groups.length});
  db.prepare('DELETE FROM playlists WHERE id=?').run(key);groups.forEach(g=>live.group(g.id));live.admin();ok(res,null);
 });
 r.use(['/users','/settings'],requireAdmin);
 r.get('/users',(_req,res)=>ok(res,db.prepare('SELECT id,username,role,created_at FROM users ORDER BY username').all()));
 r.post('/users',async(req,res)=>{const v=userSchema.parse(req.body);if(v.role!=='user')fail(409,'SINGLE_ADMIN','Un seul administrateur est autorisé. Les nouveaux comptes sont des utilisateurs.');const key=insert('users',{username:v.username,password_hash:await bcrypt.hash(v.password,12),role:v.role});ok(res,{id:key,username:v.username,role:v.role},201);});
 r.put('/users/:id',async(req,res)=>{
  const key=getId(req),target=existing('users',key);const v=userSchema.parse({...req.body,role:req.body.role??target.role});if(v.role!==target.role)fail(400,'ROLE_LOCKED','Le rôle de ce compte ne peut pas être modifié.');update('users',key,{username:v.username,password_hash:await bcrypt.hash(v.password,12),role:v.role});
  db.prepare('DELETE FROM sessions WHERE json_extract(data,\'$.userId\')=?').run(key);live.revokeUser(key);ok(res,null);
 });
 r.delete('/users/:id',(req,res)=>{
  const key=getId(req),target=existing('users',key);if(key===req.user.id)fail(400,'SELF_DELETE','Vous ne pouvez pas supprimer votre propre compte.');
  if(target.role==='admin')fail(400,'LAST_ADMIN','Conservez au moins un administrateur.');
  db.prepare('DELETE FROM users WHERE id=?').run(key);db.prepare('DELETE FROM sessions WHERE json_extract(data,\'$.userId\')=?').run(key);live.revokeUser(key);ok(res,null);
 });
 r.get('/settings',async(_req,res)=>{
  const sizeOf=async file=>(await fs.stat(file).catch(()=>({size:0}))).size;
  const treeSize=async dir=>{let n=0;for(const ent of await fs.readdir(dir,{withFileTypes:true}))if(ent.isDirectory())n+=await treeSize(path.join(dir,ent.name));else if(ent.isFile())n+=await sizeOf(path.join(dir,ent.name));return n;};
  ok(res,{company_name:db.prepare("SELECT value FROM settings WHERE key='company_name'").get().value,database_size:await sizeOf(config.databasePath)+await sizeOf(config.databasePath+'-wal'),upload_size:await treeSize(config.uploadPath),counts:db.prepare("SELECT COUNT(*) total,COALESCE(SUM(type='image'),0) images,COALESCE(SUM(type='video'),0) videos FROM media").get(),max_upload_mb:config.maxUploadBytes/1048576,timezone:config.timezone,registration_enabled:config.registration,version:'1.0.0'});
 });
 r.put('/settings',(req,res)=>{const v=z.object({company_name:z.string().trim().min(1).max(120)}).parse(req.body);db.prepare("UPDATE settings SET value=? WHERE key='company_name'").run(v.company_name);ok(res,v);});
 return r;
}
