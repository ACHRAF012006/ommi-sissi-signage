import fs from 'node:fs';
import {identifyServer,projectServers} from './linux-processes.js';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const script=path.join(root,'server.js');
if(process.platform!=='linux'){console.error('Cette commande nécessite Linux.');process.exit(1);}
if(process.argv.slice(2).some(argument=>argument!=='--force')){console.error('Usage : ./stop.sh [--force]');process.exit(2);}
let stopped=0;
try{
 const pm2Home=process.env.PM2_HOME||path.join(os.homedir(),'.pm2');
 // Do not start a PM2 daemon just to look for this application.
 let daemonRunning=false;
 try{const daemonPid=Number(fs.readFileSync(path.join(pm2Home,'pm2.pid'),'utf8').trim());if(Number.isInteger(daemonPid)&&daemonPid>0){process.kill(daemonPid,0);daemonRunning=true;}}catch{}
 if(daemonRunning){
  const apps=JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8',maxBuffer:2*1024*1024}));
  for(const app of apps){
   const environment=app.pm2_env;
   let directory;try{if(environment?.pm_cwd)directory=fs.realpathSync(environment.pm_cwd);}catch{}
   if(Number.isInteger(app.pm_id)&&app.pm_id>=0&&environment?.status!=='stopped'&&directory===root&&typeof environment.pm_exec_path==='string'&&path.resolve(environment.pm_exec_path)===script){
    execFileSync('pm2',['stop',String(app.pm_id)],{stdio:'inherit'});stopped++;
   }
  }
 }
}catch(error){console.error(`Impossible d’arrêter PM2 : ${error.message}`);process.exit(1);}
const processes=projectServers(root);
const sameProcess=entry=>identifyServer(root,entry.pid)?.start===entry.start;
try{
 for(const entry of processes){if(!sameProcess(entry))continue;try{process.kill(entry.pid,'SIGTERM');stopped++;}catch(error){if(error.code!=='ESRCH')throw error;}}
 const deadline=Date.now()+30000;
 let remaining=processes.filter(sameProcess);
 while(remaining.length&&Date.now()<deadline){await wait(150);remaining=remaining.filter(sameProcess);}
 if(remaining.length){
  if(!process.argv.includes('--force'))throw new Error('Arrêt incomplet après 30 secondes. Réessayez avec ./stop.sh --force pour forcer l’arrêt.');
  for(const entry of remaining)if(sameProcess(entry))process.kill(entry.pid,'SIGKILL');
 }
 console.log(stopped?'Application arrêtée.':'Aucun serveur de cette installation ne tourne.');
}catch(error){console.error(`Impossible d’arrêter l’application : ${error.message}`);process.exitCode=1;}
