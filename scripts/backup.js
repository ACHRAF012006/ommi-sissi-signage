import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import archiver from 'archiver';
import Database from 'better-sqlite3';
import {config} from '../config/config.js';
import {openDatabase} from '../database/database.js';
export async function backup(){
 const lockPath=path.join(path.dirname(config.databasePath),'.backup-lock');
 const lock=await fsp.open(lockPath,'wx',0o600).catch(()=>{throw new Error('Une autre sauvegarde est en cours (.backup-lock).');});
 await lock.writeFile(JSON.stringify({pid:process.pid,started:new Date().toISOString()}));await lock.close();
 const db=openDatabase(),temporary=await fsp.mkdtemp(path.join(os.tmpdir(),'ommi-backup-'));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),destination=path.join(config.root,'backups',`ommi-sissi-backup-${stamp}.zip`);
 try{
  // Online SQLite backup captures WAL pages consistently; session cookies are excluded.
  const snapshot=path.join(temporary,'ommisissi.db');await db.backup(snapshot);const copy=new Database(snapshot);
  copy.exec('DELETE FROM sessions; VACUUM;');const media=copy.prepare('SELECT * FROM media').all();copy.close();
  const archive=archiver('zip',{zlib:{level:6}}),output=fs.createWriteStream(destination,{mode:0o600});
  const done=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);archive.on('error',reject);archive.on('warning',e=>{archive.abort();output.destroy(e);reject(e);});});
  archive.pipe(output);archive.file(snapshot,{name:'data/ommisissi.db'});
  for(const m of media){const folder=m.type==='image'?'images':'videos';archive.file(path.join(config.uploadPath,folder,m.stored_filename),{name:`uploads/${folder}/${m.stored_filename}`,store:true});if(m.thumbnail_filename)archive.file(path.join(config.uploadPath,'thumbnails',m.thumbnail_filename),{name:`uploads/thumbnails/${m.thumbnail_filename}`,store:true});}
  archive.file(path.join(config.root,'.env.example'),{name:'configuration/.env.example'});
  archive.append(JSON.stringify({host:config.host,port:config.port,timezone:config.timezone,maxUploadSizeMB:config.maxUploadBytes/1048576,registrationEnabled:config.registration,originalDatabasePath:process.env.DATABASE_PATH||'./data/ommisissi.db',originalUploadPath:process.env.UPLOAD_PATH||'./uploads'},null,2),{name:'configuration/settings.json'});
  archive.append('Sauvegarde OMMI SISSI. Restaurer application arrêtée. Base métier, comptes et hachages des jetons TV inclus. Sessions, .env et secrets exclus. Conserver .env séparément. Consulter README.md.\n',{name:'RESTORE.txt'});
  await Promise.all([archive.finalize(),done]);console.log(`Sauvegarde créée : ${destination}`);return destination;
 }catch(e){await fsp.unlink(destination).catch(()=>{});throw e;}finally{db.close();await fsp.rm(temporary,{recursive:true,force:true});await fsp.unlink(lockPath).catch(()=>{});}
}
backup().catch(e=>{console.error(`Sauvegarde impossible : ${e.message}`);process.exitCode=1;});
