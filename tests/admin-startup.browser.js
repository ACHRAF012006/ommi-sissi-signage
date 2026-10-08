import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-admin-startup-'));
process.env.DATABASE_PATH=path.join(tmp,'db.sqlite');process.env.UPLOAD_PATH=path.join(tmp,'uploads');process.env.NODE_ENV='test';
const {createApplication}=await import('../app.js');
const {default:bcrypt}=await import('bcryptjs');
const application=createApplication();
application.db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,\'admin\')').run('cache-test',bcrypt.hashSync('Temporary-cache-test!',12));
await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));
const legacyCommon=fs.readFileSync('public/js/common.js','utf8').split('// randomUUID is unavailable')[0];
let legacy=true,oldRequests=0;
// Serve the pre-update login assets, then switch to the application without clearing cache.
const proxy=http.createServer((req,res)=>{
 if(legacy&&req.url==='/admin/login') {
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(fs.readFileSync('public/admin/login.html'));return;
 }
 if(legacy&&req.url==='/js/common.js') {
  oldRequests++;res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public,max-age=3600'});res.end(legacyCommon);return;
 }
 const upstream=http.request({host:'127.0.0.1',port:application.server.address().port,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 const context=await browser.newContext();const page=await context.newPage();const errors=[],requests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>requests.push(req.url()));
 const base=`http://127.0.0.1:${proxy.address().port}`;
 await page.goto(base+'/admin/login');await page.locator('#lock-icon svg').waitFor();assert.equal(oldRequests,1);
 await page.getByLabel('Identifiant',{exact:true}).fill('cache-test');await page.getByLabel('Mot de passe',{exact:true}).fill('Temporary-cache-test!');
 legacy=false;
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.waitForURL(base+'/admin');await page.locator('.stat-card').first().waitFor();
 assert.equal(await page.locator('.stat-card').count(),6);assert.equal(await page.locator('#navigation a').count(),9);assert.deepEqual(errors,[]);
 assert.ok(requests.some(url=>/\/js\/v[a-f0-9]{16}\/common\.js$/.test(url)));
 await page.reload();await page.locator('.stat-card').first().waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: login and reload render the empty dashboard despite a cached pre-update common.js.');
 for(const route of ['stores','groups','displays','media','playlists','scheduling','users','settings']) {
  await page.goto(base+'/admin/'+route);await page.locator('.page-heading').waitFor();
 }
 assert.deepEqual(errors,[]);console.log('PASS: all admin routes load the matching module version.');
 await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 for(const [width,height]of [[390,844],[1440,1000]]){
  await page.setViewportSize({width,height});const account=await page.locator('.account').boundingBox(),button=await page.locator('#app-fullscreen').boundingBox();assert.ok(account.x+account.width<=button.x,'Fullscreen overlaps the account');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 console.log('PASS: admin fullscreen and responsive account/button placement.');
 const failing=await context.newPage();const startupErrors=[];failing.on('pageerror',e=>startupErrors.push(e.message));
 await failing.route(/\/js\/v[a-f0-9]{16}\/admin\.js$/,route=>route.fulfill({contentType:'text/javascript',body:"throw new Error('Simulated module startup failure');"}));
 await failing.goto(base+'/admin');await failing.getByRole('button',{name:'Recharger la page',exact:true}).waitFor();
 assert.equal(await failing.getByRole('alert').count(),1);assert.equal(await failing.locator('#content').getAttribute('aria-busy'),'false');assert.deepEqual(startupErrors,[]);
 console.log('PASS: a failed admin module displays a recovery message instead of an empty dashboard.');
 const tv=await context.newPage();tv.on('pageerror',e=>errors.push(e.message));await tv.goto(base+'/display/setup');await tv.getByText('Créez d’abord un magasin et un groupe dans l’administration.',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: TV setup imports also resolve through the versioned module directory.');
}finally{
 await browser.close();await new Promise(resolve=>proxy.close(resolve));await application.close();fs.rmSync(tmp,{recursive:true,force:true});
}
