import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ommi-landing-'));
process.env.DATABASE_PATH=path.join(temporary,'test.db');process.env.UPLOAD_PATH=path.join(temporary,'uploads');process.env.NODE_ENV='test';
const {createApplication}=await import('../app.js');const application=createApplication();let browser;
try{
 await new Promise(resolve=>application.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${application.server.address().port}`;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 fs.mkdirSync('docs/screenshots',{recursive:true});
 await page.goto(base+'/');await page.getByRole('heading',{name:'La magie, sur tous vos écrans.'}).waitFor();
 await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));assert.equal(await page.locator('#app-fullscreen').getAttribute('aria-pressed'),'true');
 await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);assert.equal(await page.locator('#app-fullscreen').getAttribute('aria-pressed'),'false');
 await page.screenshot({path:'docs/screenshots/landing-desktop.png'});
 await page.locator('#landing-admin').click();await page.waitForURL(base+'/admin/login');await page.locator('#login-form').waitFor();await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 await page.goto(base+'/');await page.locator('#landing-display').click();await page.waitForURL(base+'/display');await page.locator('#setup').waitFor();await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.locator('#app-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
 for(const [width,height]of [[390,844],[768,1024],[1920,1080]]){
  await page.setViewportSize({width,height});await page.goto(base+'/');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const button=await page.locator('#app-fullscreen').boundingBox();assert.ok(button.x+button.width<=width);await page.screenshot({path:`docs/screenshots/landing-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS: landing navigation, fullscreen entry/exit on landing/login/TV setup, responsive layouts and no console errors.');
}finally{await browser?.close();await application.close();fs.rmSync(temporary,{recursive:true,force:true});}
