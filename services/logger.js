import fs from 'node:fs';
import path from 'node:path';
import {config} from '../config/config.js';
export function log(event, details = {}, level = 'info') {
 const entry = JSON.stringify({time: new Date().toISOString(),level,event,...details});
 if (process.env.NODE_ENV !== 'test') console[level === 'error' ? 'error' : 'log'](entry);
 fs.appendFile(path.join(config.root,'logs',`${new Date().toISOString().slice(0,10)}.log`),entry+'\n', {mode:0o600},()=>{});
}
