import {isStaffRole} from '../public/js/permissions.js';
import {hashToken} from '../middleware/security.js';
import {config} from '../config/config.js';
import {log} from './logger.js';
export function setupRealtime(io,db,sessionMiddleware) {
 io.engine.use(sessionMiddleware);
 const seenOffline=new Set();
 const view=id=>db.prepare(`SELECT d.id,d.name,d.store_id,d.group_id,d.last_seen,d.current_media_id,s.name store_name,g.name group_name,m.title current_media FROM displays d JOIN stores s ON s.id=d.store_id JOIN display_groups g ON g.id=d.group_id LEFT JOIN media m ON m.id=d.current_media_id WHERE d.id=?`).get(id);
 io.use((socket,next)=>{
  if(socket.handshake.auth?.admin){
   const user=db.prepare('SELECT role FROM users WHERE id=?').get(socket.request.session?.userId||0);
   if(isStaffRole(user?.role)){socket.data.admin=true;socket.data.userId=socket.request.session.userId;return next();}
  } else {
   const {identifier,token}=socket.handshake.auth||{};
   if(typeof identifier==='string'&&typeof token==='string'&&token.length<200){
    const d=db.prepare('SELECT * FROM displays WHERE unique_identifier=?').get(identifier);
    if(d&&d.token_hash===hashToken(token)){socket.data.displayId=d.id;return next();}
   }
  }
  next(new Error('Unauthorized'));
 });
 const join=socket=>{
  const d=db.prepare('SELECT * FROM displays WHERE id=?').get(socket.data.displayId);
  if(!d){socket.emit('display:deleted');socket.disconnect(true);return;}
  for(const room of socket.rooms)if(room.startsWith('store:')||room.startsWith('group:'))socket.leave(room);
  socket.join(`store:${d.store_id}`);socket.join(`group:${d.group_id}`);socket.join(`display:${d.id}`);
 };
 io.on('connection',socket=>{
  if(socket.data.admin){socket.join('admin');return;}
  join(socket);const id=socket.data.displayId;
  log('display.connected',{displayId:id});
  const heartbeat=(payload={})=>{
   const mediaId=Number(payload.mediaId);
   db.prepare("UPDATE displays SET last_seen=datetime('now'),current_media_id=? WHERE id=?").run(Number.isInteger(mediaId)&&db.prepare('SELECT id FROM media WHERE id=?').get(mediaId)?mediaId:null,id);
   seenOffline.delete(id);io.to('admin').emit('display:online',view(id));
  };
  heartbeat();
  socket.on('display:register',()=>{join(socket);heartbeat();});
  let lastHeartbeat=0;
  socket.on('display:heartbeat',payload=>{if(Date.now()-lastHeartbeat<5000)return;lastHeartbeat=Date.now();heartbeat(payload);});
  socket.on('display:error',payload=>{if(typeof payload?.message==='string')log('display.media-error',{displayId:id,message:payload.message.slice(0,200)},'error');});
  socket.on('disconnect',()=>log('display.disconnected',{displayId:id}));
 });
 const timer=setInterval(()=>{
  const rows=db.prepare("SELECT id FROM displays WHERE last_seen IS NOT NULL AND last_seen < datetime('now', ?)").all(`-${config.offlineSeconds} seconds`);
  for(const row of rows)if(!seenOffline.has(row.id)){seenOffline.add(row.id);io.to('admin').emit('display:offline',view(row.id));}
 },15000);timer.unref();
 return {
  store(id){io.to(`store:${id}`).emit('store:schedule-updated');io.to('admin').emit('data:updated');},
  group(id){io.to(`group:${id}`).emit('group:updated');io.to('admin').emit('data:updated');},
  playlist(id){
   const groups=db.prepare('SELECT id FROM display_groups WHERE playlist_id=? UNION SELECT group_id AS id FROM store_group_overrides WHERE playlist_id=?').all(id,id);
   for(const g of groups)io.to(`group:${g.id}`).emit('playlist:updated');io.to('admin').emit('data:updated');
  },
  display(id,event='playlist:updated'){
   for(const socket of io.sockets.sockets.values())if(socket.data.displayId===id)join(socket);
   io.to(`display:${id}`).emit(event);io.to('admin').emit('data:updated');
  },
  revokeUser(id){for(const socket of io.sockets.sockets.values())if(socket.data.userId===id)socket.disconnect(true);},
  admin(){io.to('admin').emit('data:updated');}, close(){clearInterval(timer);}
 };
}
