import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const digest=(value:string)=>createHash('sha256').update(value).digest();
const equal=(a:string,b:string)=>timingSafeEqual(digest(a),digest(b));
export const adminCookie='station_admin';
const duration=8*60*60;
export const sessionSeconds=duration;
const password=()=>process.env.STATION_ADMIN_PASSWORD || '';
const configured=()=>password().length>=24;
const sign=(expiry:string)=>createHmac('sha256',password()).update('station-admin:'+expiry).digest('hex');

export function stationSession(){
 const expiry=String(Math.floor(Date.now()/1000)+duration);
 return expiry+'.'+sign(expiry);
}
export function stationBasic(headers:Headers){
 const auth=headers.get('authorization')||'';
 if(!configured()||!auth.startsWith('Basic ')||auth.length>4096)return false;
 return equal(Buffer.from(auth.slice(6),'base64').toString('utf8'),'admin:'+password());
}
export function stationAuthorized(headers:Headers){
 if(!configured())return false;
 if(stationBasic(headers))return true;
 const cookie=headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(adminCookie+'='))?.slice(adminCookie.length+1)||'';
 const match=/^(\d{10})\.([0-9a-f]{64})$/.exec(cookie);
 return !!match&&Number(match[1])>Date.now()/1000&&equal(match[2],sign(match[1]));
}
export function canManageStation(r:Request){return stationAuthorized(r.headers)}
export function sameStationOrigin(r:Request){
 return r.headers.get('origin')===(process.env.STATION_ORIGIN||new URL(r.url).origin);
}
