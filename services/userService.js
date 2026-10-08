import bcrypt from 'bcryptjs';
import {userSchema} from './validation.js';
export function administratorTarget(db,username,{rename=false}={}) {
 const administrator=db.prepare("SELECT id,username FROM users WHERE role='admin'").get();
 const target=db.prepare('SELECT id,role FROM users WHERE username=?').get(username);
 if(rename){
  if(target&&target.id!==administrator?.id)throw new Error(`L’identifiant « ${username} » appartient déjà à un autre utilisateur. Aucun compte n’a été modifié.`);
  if(administrator)return administrator;
 }
 if(administrator&&target?.id!==administrator.id)throw new Error(`Un seul administrateur est autorisé : « ${administrator.username} ». Utilisez cet identifiant pour réinitialiser son mot de passe. Créez les utilisateurs depuis l’administration.`);
 return target;
}
export async function saveAdministrator(db,username,password,options={}) {
 const value=userSchema.parse({username,password,role:'admin'});
 administratorTarget(db,value.username,options);
 const hash=await bcrypt.hash(value.password,12);
 return db.transaction(()=>{
  const target=administratorTarget(db,value.username,options);
  if(target){
   if(options.rename)db.prepare("UPDATE users SET username=?,password_hash=?,role='admin',updated_at=datetime('now') WHERE id=?").run(value.username,hash,target.id);
   else db.prepare("UPDATE users SET password_hash=?,role='admin',updated_at=datetime('now') WHERE id=?").run(hash,target.id);
   db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.userId')=?").run(target.id);
   return target.id;
  }
  return Number(db.prepare("INSERT INTO users(username,password_hash,role) VALUES (?,?,'admin')").run(value.username,hash).lastInsertRowid);
 })();
}
