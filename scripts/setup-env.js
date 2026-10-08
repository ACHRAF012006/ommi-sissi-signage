import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),file=path.join(root,'.env');
if(!fs.existsSync(file)){const env=fs.readFileSync(path.join(root,'.env.example'),'utf8').replace('SESSION_SECRET=CHANGE_ME',`SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}`);fs.writeFileSync(file,env,{mode:0o600});console.log('.env créé avec un secret de session aléatoire.');}
else console.log('.env existant conservé.');
