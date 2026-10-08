import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import {z} from 'zod';
import {csrf,ok,fail} from '../middleware/security.js';
import {isStaffRole} from '../public/js/permissions.js';
import {requireStaff} from '../middleware/auth.js';
import {log} from '../services/logger.js';
export function authRoutes(db) {
 const r=Router();
 r.get('/session',(req,res)=>{
   req.session.csrf ||= crypto.randomBytes(32).toString('hex');
   const user=db.prepare('SELECT id,username,role FROM users WHERE id=?').get(req.session.userId||0);
   res.set('Cache-Control','no-store');ok(res,{csrfToken:req.session.csrf,user:user||null,hasAdmin:Boolean(db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get())});
 });
 const limiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,handler:(_req,res)=>res.status(429).json({success:false,error:{code:'RATE_LIMIT',message:'Trop de tentatives. Réessayez dans 15 minutes.'}})});
 const dummyHash=bcrypt.hashSync(crypto.randomBytes(32).toString('hex'),12);
 r.post('/login',limiter,csrf,async(req,res)=>{
   const {username,password}=z.object({username:z.string().trim().min(1).max(40),password:z.string().min(1).max(128)}).parse(req.body);
   const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
   const valid=await bcrypt.compare(password,user?.password_hash||dummyHash);
   if(!user||!valid||!isStaffRole(user.role)) fail(401,'LOGIN','Identifiant ou mot de passe incorrect.');
   await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
   req.session.userId=user.id;req.session.csrf=crypto.randomBytes(32).toString('hex');
   await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
   log('staff.login',{userId:user.id,role:user.role});ok(res,{username:user.username,role:user.role,csrfToken:req.session.csrf});
 });
 r.post('/logout',requireStaff,csrf,(req,res,next)=>req.session.destroy(e=>{if(e)return next(e);res.clearCookie('ommi.sid');ok(res,null);}));
 return r;
}
