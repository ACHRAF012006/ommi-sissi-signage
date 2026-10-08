import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-swipe-'));
process.env.DATABASE_PATH=path.join(temporary,'test.db');process.env.UPLOAD_PATH=path.join(temporary,'uploads');process.env.NODE_ENV='test';
const {createApplication}=await import('../app.js');const application=createApplication();let browser;
try{
 await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${application.server.address().port}`;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(base+'/admin/login');await page.locator('#lock-icon svg').waitFor();
 await page.evaluate(async()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='/css/display.css';const loaded=new Promise((resolve,reject)=>{css.onload=resolve;css.onerror=reject;});document.head.append(css);await loaded;
  const {MediaRenderer}=await import('/js/mediaRenderer.js'),{PlaybackEngine}=await import('/js/playbackEngine.js');
  document.body.className='display-body';const stage=document.createElement('div');stage.className='media-stage';stage.id='transition-test';stage.style.width='960px';stage.style.height='540px';document.body.replaceChildren(stage);
  const image=(id,title,color)=>{const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const context=canvas.getContext('2d');context.fillStyle=color;context.fillRect(0,0,960,540);return {id,title,type:'image',fit:'cover',image_duration_seconds:1.5,url:canvas.toDataURL()};};
  const items=[image(1,'Image A','#168f95'),image(2,'Image B','#e93889')];window.testItems=items;
  window.startTestPlayer=()=>{window.testRenderer=new MediaRenderer(stage);window.testEngine=new PlaybackEngine({renderer:window.testRenderer,getItems:data=>data.items});window.testEngine.stage({items});};window.startTestPlayer();
 });
 await page.locator('.media-slot.visible img[alt="Image A"]').waitFor();assert.ok(Math.abs(await page.locator('.media-slot.visible').evaluate(slot=>new DOMMatrixReadOnly(getComputedStyle(slot).transform).m41))<1);
 await page.locator('.media-slot.visible img[alt="Image B"]').waitFor();await page.waitForTimeout(130);
 const geometry=()=>page.evaluate(()=>{const incoming=document.querySelector('.media-slot.visible'),outgoing=document.querySelector('.media-slot.departing'),width=document.querySelector('#transition-test').clientWidth;return {incoming:new DOMMatrixReadOnly(getComputedStyle(incoming).transform).m41,outgoing:outgoing?new DOMMatrixReadOnly(getComputedStyle(outgoing).transform).m41:null,width,layers:document.querySelectorAll('.media-slot').length,opacity:getComputedStyle(incoming).opacity};});
 const first=await geometry();assert.ok(first.incoming>0&&first.incoming<first.width,JSON.stringify(first));assert.ok(first.outgoing<0&&first.outgoing>-first.width,JSON.stringify(first));assert.ok(Math.abs(first.incoming-first.outgoing-first.width)<2,JSON.stringify(first));assert.equal(first.layers,2);assert.equal(first.opacity,'1');
 await page.waitForTimeout(100);const second=await geometry();assert.ok(second.incoming<first.incoming&&second.outgoing<first.outgoing,JSON.stringify({first,second}));
 await page.waitForFunction(()=>document.querySelectorAll('.media-slot').length===1&&document.querySelector('.media-slot.visible img')?.alt==='Image B',{},{timeout:1200});assert.ok(Math.abs((await geometry()).incoming)<1);
 await page.evaluate(()=>window.testEngine.destroy());assert.equal(await page.locator('.media-slot').count(),0);
 console.log('PASS: incoming media slides from the right, outgoing media moves left without a gap, then the outgoing layer is released.');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.startTestPlayer());await page.locator('.media-slot.visible img[alt="Image B"]').waitFor();assert.ok(Math.abs((await geometry()).incoming)<1);await page.waitForFunction(()=>document.querySelectorAll('.media-slot').length===1,{},{timeout:500});await page.evaluate(()=>window.testEngine.destroy());assert.equal(await page.locator('.media-slot').count(),0);
 console.log('PASS: reduced-motion preference disables swiping without changing playlist playback or leaking layers.');
 await page.evaluate(async()=>{
  const renderer=window.testRenderer;renderer.preload(window.testItems[0]);await renderer.preloaded.element.decode();window.staleReadyCalls=0;renderer.show(window.testItems[0],{ready:()=>window.staleReadyCalls++,failed:()=>{},ended:()=>{}});renderer.destroy();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });assert.equal(await page.evaluate(()=>window.staleReadyCalls),0);assert.equal(await page.locator('.media-slot').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: destroying the renderer cancels pending animation frames; no JavaScript or console errors.');
}finally{await browser?.close();await application.close();fs.rmSync(temporary,{recursive:true,force:true});}
