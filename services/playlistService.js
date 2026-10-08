import {itemActive,storeStatus} from './scheduleService.js';
export const mediaUrl=m=>`/media/${m.type==='video'?'videos':'images'}/${m.stored_filename}`;
export const mediaView=m=>({...m,url:mediaUrl(m),thumbnail_url:m.thumbnail_filename?`/media/thumbnails/${m.thumbnail_filename}`:m.type==='image'?mediaUrl(m):null});
export function playlistItems(db,playlistId) {
 return db.prepare(`SELECT pi.*, m.type,m.title,m.stored_filename,m.mime_type,m.width,m.height,m.video_duration,m.thumbnail_filename FROM playlist_items pi JOIN media m ON m.id=pi.media_id WHERE pi.playlist_id=? ORDER BY pi.sort_order,pi.id`).all(playlistId).map(mediaView);
}
export function displaySnapshot(db,display,now=new Date()) {
 const store=db.prepare('SELECT * FROM stores WHERE id=?').get(display.store_id);
 const group=db.prepare('SELECT * FROM display_groups WHERE id=?').get(display.group_id);
 if(!store||!group) return {disabled:true,items:[],serverTime:now.toISOString()};
 const override=db.prepare('SELECT playlist_id FROM store_group_overrides WHERE store_id=? AND group_id=?').get(store.id,group.id);
 const playlist=db.prepare('SELECT * FROM playlists WHERE id=?').get(override?.playlist_id||group.playlist_id||0);
 const hours=db.prepare('SELECT * FROM store_hours WHERE store_id=? ORDER BY day_of_week').all(store.id);
 const exceptions=db.prepare('SELECT * FROM store_exceptions WHERE store_id=?').all(store.id);
 return {display:{id:display.id,name:display.name,unique_identifier:display.unique_identifier},store,group,playlist:playlist||null,
   disabled:!display.enabled||!store.enabled||!group.enabled,catalog:playlist?.enabled?playlistItems(db,playlist.id):[],items:playlist?.enabled?playlistItems(db,playlist.id).filter(x=>itemActive(x,now,store.timezone)):[],
   schedule:storeStatus(store,hours,exceptions,now),hours,exceptions,serverTime:now.toISOString()};
}
