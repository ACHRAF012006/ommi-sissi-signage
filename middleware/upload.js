import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {fileTypeFromFile} from 'file-type';
import sharp from 'sharp';
import {spawn} from 'node:child_process';
import {config} from '../config/config.js';
import {HttpError} from './security.js';
const mimeTypes={'image/jpeg':['image','jpg'],'image/png':['image','png'],'image/webp':['image','webp'],'image/gif':['image','gif'],'video/mp4':['video','mp4'],'video/webm':['video','webm']};
const storage=multer.diskStorage({destination:path.join(config.uploadPath,'tmp'),filename:(_req,_file,cb)=>cb(null,crypto.randomUUID()+'.upload')});
const uploader=multer({storage,limits:{fileSize:config.maxUploadBytes,files:10,fields:4},fileFilter:(_req,file,cb)=>cb(mimeTypes[file.mimetype]?null:new HttpError(415,'MEDIA_TYPE','Formats acceptés : JPG, PNG, WEBP, GIF, MP4 et WebM.'),Boolean(mimeTypes[file.mimetype]))}).array('files',10);
export const upload=(req,res,next)=>uploader(req,res,async e=>{
 if(e){for(const f of req.files||[]) await fs.unlink(f.path).catch(()=>{});return next(e);}next();
});
function run(command,args,timeout=15000) {
 return new Promise((resolve,reject)=>{
 const child=spawn(command,args,{windowsHide:true});let out='',err='';
 const timer=setTimeout(()=>{child.kill();reject(new Error('Metadata timeout'));},timeout);
 child.stdout.on('data',d=>{if(out.length<1024*1024)out+=d;});child.stderr.on('data',d=>{if(err.length<4000)err+=d;});
 child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error(err||'Metadata error'));});
 });
}
export async function inspectUpload(file) {
 const detected=await fileTypeFromFile(file.path), spec=mimeTypes[detected?.mime];
 if(!spec||detected.mime!==file.mimetype) throw new HttpError(415,'MEDIA_SIGNATURE','Le contenu du fichier ne correspond pas à un format autorisé.');
 const [type,extension]=spec, filename=crypto.randomUUID()+'.'+extension;
 const destination=path.join(config.uploadPath,type==='image'?'images':'videos',filename);
 let width=null,height=null,duration=null,thumb=null;
 try{
  if(type==='image') {
   const metadata=await sharp(file.path,{limitInputPixels:100000000}).metadata();
   width=metadata.width;height=metadata.height;
   thumb=filename+'.webp';await sharp(file.path,{limitInputPixels:100000000}).rotate().resize(480,320,{fit:'inside',withoutEnlargement:true}).webp({quality:80}).toFile(path.join(config.uploadPath,'thumbnails',thumb));
  } else {
   // FFmpeg is optional; only local files and built-in protocols may be used.
   try{
    const result=JSON.parse(await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file.path]));
    const stream=result.streams?.find(s=>s.codec_type==='video');
    if(!stream) throw new HttpError(415,'VIDEO_INVALID','Ce fichier ne contient pas de piste vidéo.');
    width=stream.width||null;height=stream.height||null;duration=Number(result.format?.duration)||null;
    thumb=filename+'.jpg';
    await run('ffmpeg',['-v','error','-protocol_whitelist','file,pipe','-ss','0','-i',file.path,'-frames:v','1','-vf','scale=480:-2','-y',path.join(config.uploadPath,'thumbnails',thumb)],30000);
   } catch(e) {if(e instanceof HttpError)throw e; if(thumb)await fs.unlink(path.join(config.uploadPath,'thumbnails',thumb)).catch(()=>{});thumb=null;}
  }
  await fs.rename(file.path,destination);
  return {original_filename:path.basename(file.originalname).slice(0,250),stored_filename:filename,type,mime_type:detected.mime,size:file.size,width,height,video_duration:duration,thumbnail_filename:thumb,title:path.basename(file.originalname).slice(0,250),description:''};
 }catch(e){if(thumb)await fs.unlink(path.join(config.uploadPath,'thumbnails',thumb)).catch(()=>{});throw e;}
}
export async function removeMediaFiles(media) {
 await fs.unlink(path.join(config.uploadPath,media.type==='image'?'images':'videos',media.stored_filename)).catch(()=>{});
 if(media.thumbnail_filename)await fs.unlink(path.join(config.uploadPath,'thumbnails',media.thumbnail_filename)).catch(()=>{});
}
