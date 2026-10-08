import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import path from 'node:path';
import http from 'node:http';
import {Server} from 'socket.io';
import {ZodError} from 'zod';
import {config} from './config/config.js';
import {openDatabase} from './database/database.js';
import {SQLiteSessionStore} from './middleware/security.js';
import {authRoutes} from './routes/auth.js';
import {apiRoutes} from './routes/api.js';
import {adminRoutes} from './routes/admin.js';
import {displayRoutes} from './routes/display.js';
import {setupRealtime} from './services/displayService.js';
import {sameOrigin} from './config/proxy.js';
import {sendPage} from './services/frontendService.js';
import {log} from './services/logger.js';
export function createApplication(options={}) {
 const db=options.db||openDatabase(),app=express(),server=http.createServer(app);
 app.locals.db=db;app.disable('x-powered-by');app.set('trust proxy',config.trustProxy);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'blob:','data:'],mediaSrc:["'self'",'blob:'],connectSrc:["'self'"],fontSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'self'"],upgradeInsecureRequests:config.secureCookie?[]:null}},strictTransportSecurity:config.secureCookie?undefined:false}));
 app.use(express.json({limit:'2mb'}));
 const store=new SQLiteSessionStore(db);
 const sessionMiddleware=session({name:'ommi.sid',secret:config.secret,store,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:config.secureCookie,maxAge:8*60*60*1000}});
 app.use(sessionMiddleware);
 const io=new Server(server,{maxHttpBufferSize:16384,allowRequest:(req,cb)=>cb(null,sameOrigin(req,app.get('trust proxy fn')))});
 const live=setupRealtime(io,db,sessionMiddleware);
 app.get('/',(_req,res)=>sendPage(res,'index.html'));
 app.get('/health',(_req,res)=>res.json({success:true,data:{status:'ok'}}));
 app.use('/auth',authRoutes(db));app.use('/api',apiRoutes(db,live));app.use('/admin',adminRoutes(db));app.use('/display',displayRoutes());
 for(const folder of ['images','videos','thumbnails'])app.use(`/media/${folder}`,express.static(path.join(config.uploadPath,folder),{dotfiles:'deny',immutable:true,maxAge:'1y',index:false}));
 app.use(/^\/js\/v[a-f0-9]{16}(?=\/|$)/,express.static(path.join(config.root,'public/js'),{maxAge:0,setHeaders:res=>res.setHeader('Cache-Control','no-cache')}));
 // Explicit static roots keep protected administration HTML and upload temp files private.
 for(const folder of ['css','js','assets'])app.use(`/${folder}`,express.static(path.join(config.root,'public',folder),{maxAge:folder==='assets'?'1h':0,setHeaders:res=>{if(folder!=='assets')res.setHeader('Cache-Control','no-cache');}}));
 app.use((_req,res)=>res.status(404).json({success:false,error:{code:'NOT_FOUND',message:'Page introuvable.'}}));
 app.use((err,req,res,_next)=>{
  let status=err.status||500,code=err.code||'SERVER_ERROR',message=err.message;
  if(err.type==='entity.parse.failed'){status=400;code='INVALID_JSON';message='Le format de la requête est invalide.';}
  else if(err instanceof ZodError){status=400;code='VALIDATION';message=err.issues.map(x=>`${x.path.join('.')} : ${x.message}`).join(' · ');}
  else if(err.code==='SQLITE_CONSTRAINT_UNIQUE'){status=409;code='DUPLICATE';message='Ce code ou cet identifiant existe déjà.';}
  else if(err.code?.startsWith('SQLITE_CONSTRAINT')){status=409;code='CONSTRAINT';message='Cette action est incompatible avec les données associées.';}
  else if(err.code==='LIMIT_FILE_SIZE'){status=413;message=`Fichier trop volumineux. Maximum : ${config.maxUploadBytes/1048576} Mo.`;}
  else if(err.name==='MulterError'){status=400;message='Téléversement invalide (10 fichiers maximum).';}
  if(status>=500){log('server.error',{path:req.path,message:err.message,stack:err.stack},'error');message='Une erreur est survenue. Veuillez réessayer.';}
  if(res.headersSent)return res.end();res.status(status).json({success:false,error:{code,message,...(err.details?{details:err.details}:{})}});
 });
 return {app,server,io,db,live,close:async()=>{live.close();store.close();await new Promise(resolve=>io.close(resolve));if(server.listening)await new Promise(resolve=>server.close(resolve));if(!options.db)db.close();}};
}
