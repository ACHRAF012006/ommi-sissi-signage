import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {config} from '../config/config.js';

export function frontendVersion() {
 const hash=crypto.createHash('sha256');
 for(const folder of ['js','css']) {
  const directory=path.join(config.root,'public',folder);
  for(const file of fs.readdirSync(directory).sort()) {
   if(!/\.(js|css)$/.test(file))continue;
   hash.update(`${folder}/${file}\0`).update(fs.readFileSync(path.join(directory,file)));
  }
 }
 return `v${hash.digest('hex').slice(0,16)}`;
}

export function sendPage(res,page) {
 const version=frontendVersion();
 const html=fs.readFileSync(path.join(config.root,'public',page),'utf8')
  // Version the whole module directory so relative imports inherit the version.
  .replace(/src="\/js\//g,`src="/js/${version}/`)
  .replace(/href="(\/css\/[^"?]+)"/g,(_match,url)=>`href="${url}?${version}"`);
 res.set('Cache-Control','no-store').type('html').send(html);
}
