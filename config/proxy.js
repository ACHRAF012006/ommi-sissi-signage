import {isIP} from 'node:net';
export function parseTrustProxy(value='false') {
 if(value==='false'||!value.trim())return false;
 if(value==='true')return 1; // Backward compatibility: one trusted proxy hop.
 const addresses=value.split(',').map(address=>address.trim());
 for(const address of addresses){
  const [ip,prefix,...extra]=address.split('/');const family=isIP(ip);
  if(!family||extra.length||(prefix!==undefined&&(!/^\d+$/.test(prefix)||Number(prefix)>(family===4?32:128))))throw new Error('TRUST_PROXY doit contenir des adresses IP ou des réseaux CIDR valides.');
 }
 return addresses;
}
// Forwarded headers are accepted only from the immediate trusted proxy.
export function requestOrigin(req,trust) {
 const trusted=trust(req.socket.remoteAddress,0);
 const first=value=>typeof value==='string'?value.split(',')[0].trim():undefined;
 const host=(trusted&&first(req.headers['x-forwarded-host']))||req.headers.host;
 const protocol=(trusted&&first(req.headers['x-forwarded-proto']))||(req.socket.encrypted?'https':'http');
 if(!host||!['http','https'].includes(protocol))return null;
 try{return new URL(`${protocol}://${host}`).origin;}catch{return null;}
}
export function sameOrigin(req,trust) {
 const origin=req.headers.origin;if(!origin)return true;
 try{return new URL(origin).origin===origin&&origin===requestOrigin(req,trust);}catch{return false;}
}
