import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-linux-'));
after(()=>fs.rmSync(directory,{recursive:true,force:true}));
function fixture(name){
 const root=path.join(directory,name);fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
 for(const file of ['start.sh','stop.sh','toggle-autostart.sh','scripts/linux-common.sh','scripts/stop-app.js','scripts/systemd-service.js','scripts/linux-processes.js','scripts/app-running.js'])fs.copyFileSync(file,path.join(root,file));
 fs.writeFileSync(path.join(root,'package.json'),'{"type":"module"}');
 fs.writeFileSync(path.join(root,'server.js'),"import fs from 'node:fs';fs.writeFileSync('ready.pid',String(process.pid));process.on('SIGTERM',()=>{fs.writeFileSync('stopped','graceful');process.exit(0)});setInterval(()=>{},1000);");
 return root;
}
const onLinux={skip:process.platform!=='linux'};
test('systemd service generation accepts project paths with spaces, percent and dollar signs',onLinux,t=>{
 const root=fixture('unit spaces % $');const unit=path.join(root,'generated.service');
 const result=spawnSync(process.execPath,[path.join(root,'scripts/systemd-service.js'),'1000'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/User=1000/);assert.ok(result.stdout.includes('unit spaces %% $'));fs.writeFileSync(unit,result.stdout);
 const verified=spawnSync('systemd-analyze',['verify',unit],{encoding:'utf8'});if(verified.error?.code==='ENOENT'){t.skip('systemd-analyze unavailable');return;}assert.equal(verified.status,0,verified.stderr);
});
test('autostart status, toggle, on/off and ownership checks use an isolated mocked service manager',{skip:process.platform!=='linux'||!fs.existsSync('/run/systemd/system')},()=>{
 const root=fixture('auto start');const bin=path.join(root,'bin');fs.mkdirSync(bin);const stateFile=path.join(root,'state.json'),calls=path.join(root,'calls.jsonl');
 fs.writeFileSync(stateFile,JSON.stringify({loaded:false,enabled:false,root}));
 const fakeSystemctl=`#!/usr/bin/env node
import fs from 'node:fs';const args=process.argv.slice(2),file=process.env.SIGNAGE_TEST_STATE,state=JSON.parse(fs.readFileSync(file));fs.appendFileSync(process.env.SIGNAGE_TEST_CALLS,JSON.stringify(['systemctl',...args])+'\\n');
if(args.includes('--user'))process.exit(1);
if(args[0]==='show'){console.log(args.includes('--property=LoadState')?(state.loaded?'loaded':'not-found'):(state.loaded?state.root:''));}
else if(args[0]==='is-enabled'){console.log(state.enabled?'enabled':'disabled');process.exit(state.enabled?0:1);}
else if(args[0]==='enable'){state.enabled=true;fs.writeFileSync(file,JSON.stringify(state));}
else if(args[0]==='disable'){state.enabled=false;fs.writeFileSync(file,JSON.stringify(state));}
else if(args[0]==='is-active')process.exit(state.active?0:3);
else if(args[0]==='start'){state.active=true;fs.writeFileSync(file,JSON.stringify(state));}
else if(!['daemon-reload','stop'].includes(args[0]))process.exit(1);
`;
 const fakeInstall=`#!/usr/bin/env node
import fs from 'node:fs';const args=process.argv.slice(2),file=process.env.SIGNAGE_TEST_STATE,state=JSON.parse(fs.readFileSync(file));fs.copyFileSync(args.at(-2),process.env.SIGNAGE_TEST_UNIT);state.loaded=true;fs.writeFileSync(file,JSON.stringify(state));fs.appendFileSync(process.env.SIGNAGE_TEST_CALLS,JSON.stringify(['install',...args])+'\\n');
`;
 for(const [name,body]of [['systemctl',fakeSystemctl],['install',fakeInstall],['sudo','#!/usr/bin/env bash\nif [[ "$1" == -- ]]; then shift; fi\nexec "$@"\n']])fs.writeFileSync(path.join(bin,name),body,{mode:0o755});
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,SUDO_USER:process.getuid()===0?'nobody':os.userInfo().username,SIGNAGE_TEST_STATE:stateFile,SIGNAGE_TEST_CALLS:calls,SIGNAGE_TEST_UNIT:path.join(root,'installed.service')};
 const run=action=>spawnSync('bash',[path.join(root,'toggle-autostart.sh'),...(action?[action]:[])],{env,encoding:'utf8',timeout:10000});
 let result=run('status');assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/désactivé/);
 result=run();assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(stateFile)).enabled,true);assert.ok(fs.readFileSync(env.SIGNAGE_TEST_UNIT,'utf8').includes(root));
 result=run('status');assert.match(result.stdout,/activé/);result=run();assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(fs.readFileSync(stateFile)).enabled,false);
 result=run('on');assert.equal(result.status,0,result.stderr);result=run('off');assert.equal(result.status,0,result.stderr);
 const operations=fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse);assert.equal(operations.filter(call=>call[0]==='install').length,1);assert.ok(!operations.some(call=>call.includes('--now')||call.includes('start')||call.includes('stop')));
 result=run('on');assert.equal(result.status,0,result.stderr);const stop=spawnSync('bash',[path.join(root,'stop.sh')],{env:{...env,PM2_HOME:path.join(root,'no-pm2')},encoding:'utf8',timeout:10000});assert.equal(stop.status,0,stop.stderr);assert.equal(JSON.parse(fs.readFileSync(stateFile)).enabled,true);assert.ok(fs.readFileSync(calls,'utf8').includes('[\"systemctl\",\"stop\",\"ommi-sissi.service\"]'));
 const start=()=>spawnSync('bash',[path.join(root,'start.sh')],{env,encoding:'utf8',timeout:10000});let started=start();assert.equal(started.status,0,started.stderr);assert.match(started.stdout,/démarrée via systemd/);started=start();assert.equal(started.status,0,started.stderr);assert.match(started.stdout,/déjà actif/);assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse).filter(call=>call[0]==='systemctl'&&call[1]==='start').length,1);
 fs.writeFileSync(stateFile,JSON.stringify({loaded:true,enabled:true,root:'/some/other/project'}));result=run('off');assert.equal(result.status,1);assert.match(result.stderr,/autre installation/);assert.equal(JSON.parse(fs.readFileSync(stateFile)).enabled,true);
});
for(const watch of [false,true])test(`stop script gracefully stops ${watch?'watch mode':'foreground mode'} and leaves unrelated servers alive`,onLinux,async()=>{
 const root=fixture(watch?'watch app':'foreground app'),other=fixture(watch?'other watch':'other foreground');
 const env={...process.env,PM2_HOME:path.join(root,'no-pm2')};
 const app=spawn(process.execPath,[...(watch?['--watch']:[]),'server.js'],{cwd:root,env,stdio:'ignore'}),unrelated=spawn(process.execPath,['server.js'],{cwd:other,env,stdio:'ignore'});
 const cleanup=child=>{try{child.kill('SIGKILL');}catch{}};
 try{
  const deadline=Date.now()+5000;while((!fs.existsSync(path.join(root,'ready.pid'))||!fs.existsSync(path.join(other,'ready.pid')))&&Date.now()<deadline)await wait(50);
  assert.ok(fs.existsSync(path.join(root,'ready.pid')),'Fixture did not start');const result=spawnSync('bash',[path.join(root,'stop.sh')],{env,encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(path.join(root,'stopped'),'utf8'),'graceful');assert.doesNotThrow(()=>process.kill(unrelated.pid,0));
  const repeated=spawnSync('bash',[path.join(root,'stop.sh')],{env,encoding:'utf8',timeout:10000});assert.equal(repeated.status,0,repeated.stderr);assert.match(repeated.stdout,/Aucun serveur/);
 }finally{cleanup(app);cleanup(unrelated);const pidFile=path.join(root,'ready.pid');if(fs.existsSync(pidFile)){try{process.kill(Number(fs.readFileSync(pidFile)),'SIGKILL');}catch{}}}
});

test('stop script stops only PM2 entries belonging to this project',onLinux,()=>{
 const root=fixture('pm2 app'),other=fixture('another pm2 app'),bin=path.join(root,'bin'),home=path.join(root,'pm2-home'),calls=path.join(root,'pm2-calls.jsonl');fs.mkdirSync(bin);fs.mkdirSync(home);fs.writeFileSync(path.join(home,'pm2.pid'),String(process.pid));
 const apps=[{pm_id:7,pm2_env:{status:'online',pm_cwd:root,pm_exec_path:path.join(root,'server.js')}},{pm_id:8,pm2_env:{status:'online',pm_cwd:other,pm_exec_path:path.join(other,'server.js')}},{pm_id:9,pm2_env:{status:'online',pm_cwd:'/missing/app',pm_exec_path:'/missing/app/server.js'}}];
 fs.writeFileSync(path.join(bin,'pm2'),`#!/usr/bin/env node
import fs from 'node:fs';const args=process.argv.slice(2);fs.appendFileSync(process.env.SIGNAGE_PM2_CALLS,JSON.stringify(args)+'\\n');if(args[0]==='jlist')console.log(process.env.SIGNAGE_PM2_APPS);
`,{mode:0o755});
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,PM2_HOME:home,SIGNAGE_PM2_CALLS:calls,SIGNAGE_PM2_APPS:JSON.stringify(apps)};
 let result=spawnSync('bash',[path.join(root,'stop.sh')],{env,encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.deepEqual(fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse),[['jlist'],['stop','7']]);
 fs.writeFileSync(path.join(home,'pm2.pid'),'99999999');result=spawnSync('bash',[path.join(root,'stop.sh')],{env,encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').length,2);
});

test('start script launches from any directory, detects duplicates and can be stopped',onLinux,async()=>{
 const root=fixture('start script with spaces');const bin=path.join(root,'bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,'systemctl'),'#!/usr/bin/env bash\necho not-found\nexit 1\n',{mode:0o755});
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,PM2_HOME:path.join(root,'no-pm2')};const child=spawn('bash',[path.join(root,'start.sh')],{cwd:directory,env,stdio:'ignore'});
 try{
  const deadline=Date.now()+5000;while(!fs.existsSync(path.join(root,'ready.pid'))&&Date.now()<deadline)await wait(50);assert.ok(fs.existsSync(path.join(root,'ready.pid')),'start.sh did not launch the server');
  const pid=Number(fs.readFileSync(path.join(root,'ready.pid')));const second=spawnSync('bash',[path.join(root,'start.sh')],{cwd:directory,env,encoding:'utf8',timeout:5000});assert.equal(second.status,0,second.stderr);assert.match(second.stdout,/déjà en cours/);assert.equal(Number(fs.readFileSync(path.join(root,'ready.pid'))),pid);
  const stop=spawnSync('bash',[path.join(root,'stop.sh')],{env,encoding:'utf8',timeout:10000});assert.equal(stop.status,0,stop.stderr);assert.equal(fs.readFileSync(path.join(root,'stopped'),'utf8'),'graceful');
 }finally{try{child.kill('SIGKILL');}catch{}}
});
