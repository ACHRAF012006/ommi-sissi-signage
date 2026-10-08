import {Router} from 'express';
import {sendPage} from '../services/frontendService.js';
export function displayRoutes() {
 const r=Router();
 for(const route of ['/','/setup','/player'])r.get(route,(_req,res)=>sendPage(res,'display/index.html'));
 return r;
}
