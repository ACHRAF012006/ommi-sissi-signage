import {createApplication} from './app.js';
import {config} from './config/config.js';
import {log} from './services/logger.js';
const application=createApplication();
application.server.listen(config.port,config.host,()=>log('server.started',{host:config.host,port:config.port,url:`http://localhost:${config.port}`}));
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;log('server.stopping');await application.close();process.exit(0);});
process.on('uncaughtException',err=>{log('uncaught.error',{message:err.message,stack:err.stack},'error');process.exit(1);});
