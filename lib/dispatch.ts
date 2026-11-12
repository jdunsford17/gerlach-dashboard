const dispatchGuid=()=>process.env.EDISPATCHES_BOARD_GUID||'';
const endpoint='https://gqlapi.edispatches.com/graphql';
export class DispatchError extends Error { constructor(public kind:'auth'|'unavailable'){super(kind)} }
export async function graphql(query:string,variables:Record<string,string>={},token?:string){
 let response:Response;try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});}catch{throw new DispatchError('unavailable')}
 let body:any;try{body=await response.json()}catch{throw new DispatchError('unavailable')}
 if(body.errors?.length){if(body.errors.some((e:any)=>e.extensions?.code==='UNAUTHENTICATED'||e.code==='UNAUTHENTICATED'||/unauthenticated|invalid authentication|token expired/i.test(e.message||'')))throw new DispatchError('auth');throw new DispatchError('unavailable')}
 if(!response.ok||!body.data)throw new DispatchError('unavailable');return body.data;
}
export async function login(pin:string){const data=await graphql('mutation Login($guid:String!,$pin:String!){authByGuidStationBoard(input:{guid:$guid,pin:$pin}){authStationBoard{token}}}',{guid:dispatchGuid(),pin});const token=data.authByGuidStationBoard?.authStationBoard?.token;if(!token)throw new DispatchError('auth');return token as string;}
export const recentQuery=`query RecentCAD { stationBoard { subscriber {name} subaccount {name} cadAlerts { id callTime streetAddress intersection city state emergencyNature organization {textLabel tzId} } } }`;
export type Session={pin:string;token:string;expires:number;owner:string};
export function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export function decode(value:string){return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}
async function key(secret:string){if(!/^[a-f0-9]{64}$/.test(secret))throw new Error('Session encryption unavailable');return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,x=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function seal(session:Session,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),new TextEncoder().encode(JSON.stringify(session)));return encode(iv)+'.'+encode(new Uint8Array(ciphertext))}
export async function unseal(value:string,secret:string):Promise<Session|null>{try{const [iv,cipher]=value.split('.');const text=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await key(secret),decode(cipher));const data=JSON.parse(new TextDecoder().decode(text));if(typeof data.pin!=='string'||typeof data.token!=='string'||data.expires<Date.now()||typeof data.owner!=='string')return null;return data;}catch{return null}}
export const cookieName='__Host-gerlach-dispatch';
export function cookie(value:string,maxAge=31536000){return `${cookieName}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`}
