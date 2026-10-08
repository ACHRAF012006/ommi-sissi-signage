import fs from 'node:fs';
import path from 'node:path';
export function identifyServer(root,pid){
 const script=path.join(root,'server.js');
 try{
  if(Number(pid)===process.pid)return null;
  const cwd=fs.readlinkSync(`/proc/${pid}/cwd`);
  if(cwd!==root)return null;
  const executable=path.basename(fs.readlinkSync(`/proc/${pid}/exe`));
  if(!/^node(?:js)?$/.test(executable))return null;
  const args=fs.readFileSync(`/proc/${pid}/cmdline`,'utf8').split('\0').filter(Boolean);
  if(!args.slice(1).some(argument=>!argument.startsWith('-')&&path.resolve(cwd,argument)===script))return null;
  // Start time prevents confusing a reused PID with the original process.
  const stat=fs.readFileSync(`/proc/${pid}/stat`,'utf8');
  return {pid:Number(pid),watch:args.some(argument=>argument==='--watch'||argument.startsWith('--watch=')),start:stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]};
 }catch{return null;}
}
export function projectServers(root){
 return fs.readdirSync('/proc').filter(entry=>/^\d+$/.test(entry)).map(pid=>identifyServer(root,pid)).filter(Boolean).sort((a,b)=>Number(b.watch)-Number(a.watch));
}
