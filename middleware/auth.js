import {HttpError,hashToken} from './security.js';
import {isStaffRole} from '../public/js/permissions.js';
export const requireStaff = (req,res,next)=>{
 const user=req.app.locals.db.prepare('SELECT id,username,role FROM users WHERE id=?').get(req.session.userId||0);
 if (!user || !isStaffRole(user.role)) return next(new HttpError(401,'UNAUTHORIZED','Veuillez vous connecter.'));
 req.user=user;next();
};
export const requireAdmin=(req,res,next)=>requireStaff(req,res,error=>{
 if(error)return next(error);
 if(req.user.role!=='admin')return next(new HttpError(403,'FORBIDDEN','Cette action est réservée à l’administrateur.'));
 next();
});
export function requireDisplay(req,res,next) {
 const token=req.get('authorization')?.replace(/^Bearer /,'');
 const display=req.app.locals.db.prepare('SELECT * FROM displays WHERE unique_identifier=?').get(req.params.displayId);
 if (!display || !token || hashToken(token)!==display.token_hash) return next(new HttpError(401,'DISPLAY_AUTH','Cet écran doit être configuré à nouveau.'));
 req.display=display;next();
}
