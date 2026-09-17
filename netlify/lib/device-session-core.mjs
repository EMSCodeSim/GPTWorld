import {createHash,randomBytes} from 'node:crypto';

export const DEVICE_COOKIE='__Host-gptworld_device';
export const cleanDeviceValue=(value,max=160)=>String(value||'').trim().slice(0,max);
export const cleanTravelerName=value=>String(value||'Traveler').replace(/[<>]/g,'').trim().replace(/\s+/g,' ').slice(0,20)||'Traveler';
export const hashSecret=value=>createHash('sha256').update(String(value||'')).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export function newRecoveryCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=randomBytes(16),parts=[];
  for(let part=0;part<4;part++){let value='';for(let i=0;i<4;i++)value+=alphabet[bytes[part*4+i]%alphabet.length];parts.push(value);}
  return`GW-${parts.join('-')}`;
}
export const normalizeRecoveryCode=value=>cleanDeviceValue(value,40).toUpperCase().replace(/[^A-Z0-9]/g,'');
export function cookieValue(header,name=DEVICE_COOKIE){
  for(const pair of String(header||'').split(';')){const index=pair.indexOf('=');if(index<0)continue;if(pair.slice(0,index).trim()===name)return decodeURIComponent(pair.slice(index+1).trim());}
  return'';
}
export const deviceCookie=token=>`${DEVICE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
