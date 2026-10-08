import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-frame-'));
process.env.DATABASE_PATH=path.join(temporary,'test.db');process.env.UPLOAD_PATH=path.join(temporary,'uploads');process.env.NODE_ENV='test';
const {createApplication}=await import('../app.js');const {default:bcrypt}=await import('bcryptjs');
const application=createApplication();application.db.prepare('INSERT INTO users(username,password_hash,role) VALUES (?,?,\'admin\')').run('frame-test',bcrypt.hashSync('Temporary-frame-test!',12));
await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${application.server.address().port}`;
let browser;
try{
 const videoPath=path.join(temporary,'video.mp4');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=0x168f95:s=640x360:r=12','-t','6','-c:v','libx264','-pix_fmt','yuv420p','-y',videoPath],{timeout:30000});
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const admin=await browser.newContext();
 const auth=await(await admin.request.get(base+'/auth/session')).json();const login=await(await admin.request.post(base+'/auth/login',{headers:{'X-CSRF-Token':auth.data.csrfToken},data:{username:'frame-test',password:'Temporary-frame-test!'}})).json();
 assert.equal(login.success,true);const headers={'X-CSRF-Token':login.data.csrfToken};
 const api=async(url,method='GET',data)=>{const res=await admin.request.fetch(base+url,{method,headers,data});const result=await res.json();assert.equal(result.success,true,JSON.stringify(result));return result.data;};
 const hours=Array.from({length:7},(_,day_of_week)=>({day_of_week,is_closed:0,opening_time:'00:00',closing_time:'23:59'}));
 const store=await api('/api/stores','POST',{name:'Tunis',code:'FRAME-TUN',timezone:'Africa/Tunis',hours,closed_screen_enabled:1});
 const imageUpload=await admin.request.post(base+'/api/media',{headers,multipart:{files:{name:'Vélos — À vous l’aventure.png',mimeType:'image/png',buffer:fs.readFileSync('IMG_LOGO.png')}}});const image=(await imageUpload.json()).data[0];
 const videoUpload=await admin.request.post(base+'/api/media',{headers,multipart:{files:{name:'video.mp4',mimeType:'video/mp4',buffer:fs.readFileSync(videoPath)}}});const video=(await videoUpload.json()).data[0];
 const playlist=await api('/api/playlists','POST',{name:'Découvertes du moment',items:[{media_id:image.id,image_duration_seconds:2},{media_id:video.id}]});
 const group=await api('/api/groups','POST',{name:'Promotions',playlist_id:playlist.id});
 const context=await browser.newContext({viewport:{width:1920,height:1080}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.videoEnds=[];document.addEventListener('ended',e=>{if(e.target.tagName==='VIDEO')window.videoEnds.push({duration:e.target.duration,time:e.target.currentTime});},true);});
 await page.goto(base+'/display/setup');await page.locator('#store').selectOption(String(store.id));await page.locator('#group').selectOption(String(group.id));await page.locator('#start-display').click();await page.locator('.media-slot.visible img').waitFor();
 assert.equal(await page.locator('#frame-store').innerText(),'Tunis');assert.equal(await page.locator('#frame-hours-value').innerText(),'23h59');assert.match(await page.locator('#frame-clock').innerText(),/^\d{2}:\d{2}$/);
 const imageStarted=Date.now();await page.locator('.media-slot.visible video').waitFor({timeout:5000});assert.ok(Date.now()-imageStarted>=1500);
 await page.waitForTimeout(2500);assert.equal(await page.locator('.media-slot.visible video').count(),1);assert.ok(await page.locator('.media-slot.visible video').evaluate(v=>v.currentTime>2&&!v.paused));
 await page.waitForFunction(()=>window.videoEnds.length===1,{},{timeout:6000});const end=await page.evaluate(()=>window.videoEnds[0]);assert.equal(end.duration,6);assert.equal(end.time,6);await page.locator('.media-slot.visible img').waitFor();
 await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 console.log('PASS: framed player advances images, plays video to its actual ended event and enters/exits fullscreen.');
 // Keep one image while measuring the frame at several TV resolutions.
 await api(`/api/playlists/${playlist.id}`,'PUT',{name:playlist.name,items:[{media_id:image.id,image_duration_seconds:60}]});await page.waitForTimeout(2100);
 fs.mkdirSync('docs/screenshots',{recursive:true});
 for(const [width,height]of [[1280,720],[1920,1080],[2560,1440],[3840,2160],[720,1280],[390,844],[3440,1440],[800,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(150);
  const geometry=await page.evaluate(()=>{
   const rect=selector=>{const {x,y,width,height,right,bottom}=document.querySelector(selector).getBoundingClientRect();return {x,y,width,height,right,bottom};};
   return {stage:rect('#media-stage'),frame:rect('.tv-content'),available:rect('.tv-viewport'),header:rect('.tv-header'),footer:rect('.tv-footer'),logo:rect('.tv-brand img'),hours:rect('#frame-hours'),viewport:{width:innerWidth,height:innerHeight},scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}};
  });
  assert.ok(geometry.scroll.width<=width&&geometry.scroll.height<=height,JSON.stringify(geometry));assert.ok(geometry.stage.y>=geometry.header.bottom,JSON.stringify(geometry));assert.ok(geometry.stage.bottom<=geometry.footer.y,JSON.stringify(geometry));assert.ok(geometry.logo.bottom<=geometry.stage.y);assert.ok(geometry.hours.right<=width);
  assert.ok(Math.abs(geometry.stage.width/geometry.stage.height-16/9)<.001,JSON.stringify(geometry));assert.ok(geometry.stage.width<=geometry.available.width&&geometry.stage.height<=geometry.available.height);assert.ok(Math.abs(geometry.frame.width-geometry.available.width)<1||Math.abs(geometry.frame.height-geometry.available.height)<1,JSON.stringify(geometry));
  await page.screenshot({path:`docs/screenshots/tv-player-${width}.png`});
 }
 console.log('PASS: exact 16:9 media at 720p, 1080p, 1440p, 4K, portrait, mobile, square and ultrawide without scrollbars or overlap.');
 await page.setViewportSize({width:1920,height:1080});
 const currentStore=(await api('/api/stores'))[0];const exceptionDate=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tunis',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 await api(`/api/stores/${store.id}`,'PUT',{...currentStore,exceptions:[{date:exceptionDate,is_closed:0,opening_time:'00:00',closing_time:'23:45',label:'Horaires exceptionnels'}]});await page.waitForFunction(()=>document.querySelector('#frame-hours-value').textContent==='23h45',{},{timeout:10000});
 await api(`/api/stores/${store.id}`,'PUT',{...currentStore,exceptions:[{date:exceptionDate,is_closed:1,label:'Fermeture exceptionnelle'}]});await page.getByText('Nous sommes actuellement fermés.',{exact:true}).waitFor();assert.equal(await page.locator('#frame-hours-label').innerText(),'Prochaine ouverture');assert.equal(await page.locator('.tv-brand img').isVisible(),true);await page.screenshot({path:'docs/screenshots/tv-player-closed.png'});
 for(const [width,height]of [[390,844],[720,1280],[1920,1080]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const fits=await page.locator('.brand-screen-inner').evaluate(element=>{const parent=element.parentElement.getBoundingClientRect(),child=element.getBoundingClientRect();return child.top>=parent.top&&child.bottom<=parent.bottom;});assert.ok(fits,`Closed content overflows at ${width}×${height}`);}
 await api(`/api/stores/${store.id}`,'PUT',currentStore);await page.locator('.media-slot.visible img').waitFor();assert.equal(await page.locator('#frame-hours-value').innerText(),'23h59');assert.deepEqual(errors,[]);
 console.log('PASS: live exception hours, next opening, closed screen, automatic resume and no console errors.');
}finally{await browser?.close();await application.close();fs.rmSync(temporary,{recursive:true,force:true});}
