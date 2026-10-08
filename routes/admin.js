import {isStaffRole} from '../public/js/permissions.js';
import {Router} from 'express';
import {sendPage} from '../services/frontendService.js';
export function adminRoutes(db) {
 const r=Router();
 r.get('/login',(_req,res)=>sendPage(res,'admin/login.html'));
 r.use((req,res,next)=>{const u=db.prepare('SELECT role FROM users WHERE id=?').get(req.session.userId||0);if(!isStaffRole(u?.role))return res.redirect('/admin/login');if(u.role!=='admin'&&['/users','/settings'].includes(req.path.toLowerCase().replace(/\/$/,'')))return res.redirect('/admin');res.set('Cache-Control','no-store');next();});
 for(const route of ['/','/stores','/groups','/displays','/media','/playlists','/scheduling','/users','/settings'])r.get(route,(_req,res)=>sendPage(res,'admin/index.html'));
 return r;
}
