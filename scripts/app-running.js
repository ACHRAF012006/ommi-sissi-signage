import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectServers} from './linux-processes.js';
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
if(process.platform!=='linux')process.exit(1);
try{process.exit(projectServers(root).length?0:1);}catch(error){console.error(`Impossible de vérifier le serveur : ${error.message}`);process.exit(2);}
