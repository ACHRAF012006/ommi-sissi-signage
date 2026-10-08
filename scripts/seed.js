import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {config} from '../config/config.js';
import {openDatabase} from '../database/database.js';
import {inspectUpload,removeMediaFiles} from '../middleware/upload.js';
if(config.production){console.error('Les données de démonstration sont réservées au développement.');process.exit(1);}
const db=openDatabase();const files=[];
try{
 if(db.prepare("SELECT id FROM stores WHERE code='DEMO-TUN'").get()){console.log('Démonstration déjà installée.');db.close();process.exit();}
 const examples=[['17-906.png','Vélos · En route pour l’aventure','image/png'],['56280EU.jpeg','Piscines · Le bonheur en plein air','image/jpeg'],['17-12.png','Les petits explorateurs','image/png'],['17-903.jpg','Jouets · Place à l’imagination','image/jpeg'],['152-199.jpeg','Un été plein de découvertes','image/jpeg']];
 for(const [filename,title,mimetype] of examples){const source=path.join(config.root,'img',filename);try{await fs.access(source);}catch{continue;}const dest=path.join(config.uploadPath,'tmp',crypto.randomUUID()+'.upload');await fs.copyFile(source,dest);const m=await inspectUpload({path:dest,originalname:filename,mimetype,size:(await fs.stat(dest)).size});m.title=title;files.push(m);}
 db.transaction(()=>{
 const store=Number(db.prepare("INSERT INTO stores(name,code,address,closed_screen_enabled) VALUES ('Tunis','DEMO-TUN','Magasin de démonstration',0)").run().lastInsertRowid);
 for(let day=0;day<7;day++)db.prepare('INSERT INTO store_hours(store_id,day_of_week,is_closed,opening_time,closing_time) VALUES (?,?,?,?,?)').run(store,day,day===0?1:0,'09:00','20:00');
 const playlist=Number(db.prepare("INSERT INTO playlists(name,description) VALUES ('Promotions générales','Une sélection pour donner vie à vos écrans')").run().lastInsertRowid);
 for(const name of ['Promotions','Piscines','Vélos'])db.prepare('INSERT INTO display_groups(name,playlist_id) VALUES (?,?)').run(name,playlist);
 files.forEach((m,index)=>{const keys=Object.keys(m);const media=Number(db.prepare(`INSERT INTO media (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(m)).lastInsertRowid);db.prepare('INSERT INTO playlist_items(playlist_id,media_id,sort_order,image_duration_seconds) VALUES (?,?,?,8)').run(playlist,media,index);});
 })();console.log('Démonstration créée : Tunis, 3 groupes, une playlist et les images produit disponibles. Aucun compte administrateur créé.');
}catch(e){for(const m of files)await removeMediaFiles(m);console.error(e.message);process.exitCode=1;}finally{if(db.open)db.close();}
