import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-install-git-'));
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const onLinux={skip:process.platform!=='linux'};
function fixture(name){
 const root=path.join(temporary,name),bin=path.join(root,'bin'),calls=path.join(root,'calls.jsonl');fs.mkdirSync(bin,{recursive:true});
 for(const file of ['install-git.sh','install.sh'])fs.copyFileSync(file,path.join(root,file));
 for(const command of ['uname','dirname'])fs.symlinkSync(`/usr/bin/${command}`,path.join(bin,command));
 fs.symlinkSync('/bin/bash',path.join(bin,'bash'));
 fs.writeFileSync(path.join(bin,'sudo'),'#!/bin/bash\nexec "$@"\n',{mode:0o755});
 const manager=`#!${process.execPath}
import fs from 'node:fs';import path from 'node:path';const args=process.argv.slice(2),manager=path.basename(process.argv[1]);
fs.appendFileSync(process.env.SIGNAGE_GIT_CALLS,JSON.stringify([manager,...args])+'\\n');
if(process.env.SIGNAGE_GIT_FAIL==='1')process.exit(37);
if(args.includes('git'))fs.writeFileSync(path.join(process.env.PATH,'git'),'#!/bin/bash\\necho git-test\\n',{mode:0o755});
`;
 for(const name of ['pacman','apt-get'])fs.writeFileSync(path.join(bin,name),manager,{mode:0o755});
 const env={...process.env,PATH:bin,SIGNAGE_GIT_CALLS:calls};
 const run=(file='install-git.sh',args=[],extra={})=>spawnSync('/bin/bash',[path.join(root,file),...args],{cwd:temporary,env:{...env,...extra},input:'n\n',encoding:'utf8',timeout:10000});
 return {root,bin,calls,run};
}

test('standalone Git installer installs missing Git with the distro manager and skips an existing installation',onLinux,()=>{
 const {bin,calls,run}=fixture('fresh installation');
 const result=run();assert.equal(result.status,0,result.stderr);assert.ok(fs.existsSync(path.join(bin,'git')));
 const operations=fs.readFileSync(calls,'utf8').trim().split('\n').map(JSON.parse);
 if(operations[0][0]==='pacman')assert.deepEqual(operations,[['pacman','-Syu','--needed','git']]);
 else assert.deepEqual(operations,[['apt-get','update'],['apt-get','install','-y','git']]);
 const before=fs.readFileSync(calls,'utf8');const repeated=run();assert.equal(repeated.status,0,repeated.stderr);assert.match(repeated.stdout,/déjà installé/);assert.equal(fs.readFileSync(calls,'utf8'),before);
});

test('Git installer propagates package failures and validates arguments before making changes',onLinux,()=>{
 const {bin,calls,run}=fixture('failed installation');
 for(const args of [['--help'],['--invalid'],['--help','extra']]){
  const result=run('install-git.sh',args);assert.equal(result.status,args.length===1&&args[0]==='--help'?0:2);assert.ok(!fs.existsSync(calls));
 }
 const failed=run('install-git.sh',[],{SIGNAGE_GIT_FAIL:'1'});assert.equal(failed.status,37);assert.ok(!fs.existsSync(path.join(bin,'git')));assert.ok(!failed.stdout.includes('Git est prêt'));
});

test('application installer installs Git before checking Node.js or downloading application dependencies',onLinux,()=>{
 const {root,bin,calls,run}=fixture('application installation');
 const result=run('install.sh',['--no-autostart']);assert.equal(result.status,1,result.stderr);
 assert.ok(fs.existsSync(path.join(bin,'git')));assert.ok(fs.existsSync(calls));assert.match(result.stdout,/Node.js >= 22.12/);assert.ok(!fs.existsSync(path.join(root,'data')));
});
