import crypto from 'node:crypto';
import {sameOrigin} from '../config/proxy.js';
import session from 'express-session';
export class HttpError extends Error { constructor(status,code,message,details) { super(message); Object.assign(this,{status,code,details}); } }
export const ok = (res,data,status=200)=>res.status(status).json({success:true,data});
export const fail = (status,code,message,details)=>{throw new HttpError(status,code,message,details);};
export const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
export class SQLiteSessionStore extends session.Store {
 constructor(db){ super(); this.db=db; this.timer=setInterval(()=>db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()),600000); this.timer.unref(); }
 get(sid,cb){ try{const row=this.db.prepare('SELECT * FROM sessions WHERE sid=? AND expires>?').get(sid,Date.now());cb(null,row?JSON.parse(row.data):null);}catch(e){cb(e);} }
 set(sid,data,cb=()=>{}){ try{this.db.prepare('INSERT INTO sessions VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET expires=excluded.expires,data=excluded.data').run(sid,Date.now()+(data.cookie?.originalMaxAge||28800000),JSON.stringify(data));cb();}catch(e){cb(e);} }
 destroy(sid,cb=()=>{}){try{this.db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb();}catch(e){cb(e);} }
 touch(sid,data,cb=()=>{}){try{this.db.prepare('UPDATE sessions SET expires=? WHERE sid=?').run(Date.now()+(data.cookie?.originalMaxAge||28800000),sid);cb();}catch(e){cb(e);} }
 close(){clearInterval(this.timer);}
}
export function csrf(req,res,next) {
 if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
 const supplied=req.get('x-csrf-token'), expected=req.session.csrf;
 if (!supplied || !expected || supplied.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return next(new HttpError(403,'CSRF','Session expirée. Rechargez la page.'));
 // Reject cross-origin writes even when a token is supplied.
 if (!sameOrigin(req,req.app.get('trust proxy fn'))) return next(new HttpError(403,'ORIGIN','Origine de la requête non autorisée.'));
 next();
}
