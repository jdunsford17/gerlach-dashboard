const env=process.env;
import {canManageStation,sameStationOrigin} from '../../../lib/station-auth';
import {calendarDb} from '../../../db/calendar';
import {cookieName,cookie,seal,unseal,login,graphql,recentQuery,DispatchError,type Session} from '../../../lib/dispatch';
const response=(body:object,status=200,setCookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(setCookie?{'Set-Cookie':setCookie}:{})}});
const secret=()=>((env as unknown as Record<string,string>).DISPATCH_SESSION_KEY||'');
function writable(r:Request){return canManageStation(r)&&sameStationOrigin(r)}
function error(e:unknown){return e instanceof DispatchError&&e.kind==='auth'?response({connected:false,needsPin:true,error:'eDispatches did not accept the connection. Enter the current screen PIN.'},401):response({connected:false,error:'Cannot reach the eDispatches CAD feed. Please retry.'},503)}
async function saveSession(session:Session,version?:number){const encrypted=await seal(session,secret());if(version!==undefined){await calendarDb().prepare("UPDATE station_settings SET content=?,version=version+1,updated_at=? WHERE key='dispatch-session' AND version=?").bind(JSON.stringify({encrypted}),new Date().toISOString(),version).run();return}await calendarDb().prepare("INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES ('dispatch-session',?,1,?,'dispatch') ON CONFLICT(key) DO UPDATE SET content=excluded.content,version=station_settings.version+1,updated_at=excluded.updated_at").bind(JSON.stringify({encrypted}),new Date().toISOString()).run()}
export async function POST(r:Request){if(!sameStationOrigin(r)||!r.headers.get('content-type')?.includes('application/json'))return response({error:'Connect the CAD feed from the station board.'},403);try{const data:any=await r.json();if(typeof data.pin!=='string'||!/^\d{6}$/.test(data.pin))return response({error:'Enter the six-digit screen PIN.'},400);if(!secret()||!process.env.EDISPATCHES_BOARD_GUID)return response({error:'Secure dispatch connection is not configured.'},503);const token=await login(data.pin),board=await graphql(recentQuery,{},token);if(!board.stationBoard)throw new DispatchError('auth');await saveSession({pin:data.pin,token,expires:Date.now()+31536000000,owner:(canManageStation(r)?'station-admin':null)||'public-pin'});return response({connected:true},200,cookie('',0))}catch(e){return error(e)}}
export async function GET(r:Request){
 try{
 const row:any=await calendarDb().prepare("SELECT content,version FROM station_settings WHERE key='dispatch-session'").first();
 let session=row?await unseal(JSON.parse(row.content).encrypted,secret()):null,migrated=false;
 // An existing owner's cookie can seed the new shared connection. Anonymous cookies are never imported.
 if(!session&&!row&&canManageStation(r)){const encrypted=r.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(encrypted){const old=await unseal(encrypted,secret());if(old?.owner===(canManageStation(r)?'station-admin':null)){session=old;migrated=true}}}
 if(!session)return response({connected:false,needsPin:true},401);
 let board:any,renewed=false;try{board=await graphql(recentQuery,{},session.token)}catch(e){if(!(e instanceof DispatchError)||e.kind!=='auth')throw e;session.token=await login(session.pin);board=await graphql(recentQuery,{},session.token);renewed=true}
 if(!board.stationBoard||!Array.isArray(board.stationBoard.cadAlerts))throw new DispatchError('unavailable');
 if(migrated||renewed)await saveSession(session,row?.version);
 const alerts=board.stationBoard.cadAlerts.slice().sort((a:any,b:any)=>Number(b.callTime)-Number(a.callTime)).slice(0,10).map((a:any)=>({id:a.id,time:a.callTime,address:[a.streetAddress||a.intersection,a.city,a.state].filter(Boolean).join(', '),nature:a.emergencyNature,organization:a.organization?.textLabel,timezone:a.organization?.tzId}));
 return response({connected:true,alerts,account:board.stationBoard.subaccount?.name||board.stationBoard.subscriber?.name,fetchedAt:new Date().toISOString()},200,migrated?cookie('',0):undefined);
 }catch(e){return error(e)}
}
export async function DELETE(r:Request){if(!writable(r))return response({error:'Request not permitted.'},403);try{await calendarDb().prepare("DELETE FROM station_settings WHERE key='dispatch-session'").run();return response({connected:false},200,cookie('',0))}catch{return response({error:'The shared connection was not removed. Retry.'},503)}}
