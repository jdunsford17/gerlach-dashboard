import {activeAnnouncements} from '../../../lib/monday-announcements';
import {canManageStation,sameStationOrigin} from '../../../lib/station-auth';
import {orderVehicles} from '../../../lib/vehicle-order';
import {VEHICLE_ICONS} from '../../../lib/vehicle-types';
import {calendarDb} from '../../../db/calendar';
import {z} from 'zod';
const response=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const vehicle=z.object({icon:z.enum(VEHICLE_ICONS).optional(),name:z.string().trim().min(1).max(60).optional(),status:z.enum(['Unverified','Available','Assigned','Limited service','Out of service']),note:z.string().max(250)});
const newVehicle=vehicle.extend({name:z.string().trim().min(1).max(60)});
const note=z.object({text:z.string().max(1000)});
export async function GET(r:Request){
 try{const rows=await calendarDb().prepare("SELECT * FROM station_settings WHERE key IN ('notes','vehicle-order') OR key LIKE 'vehicle:%' OR key LIKE 'announcement:monday:%'").all();const settings:Record<string,any>={};for(const row of rows.results as any[])settings[row.key]={...JSON.parse(row.content),version:row.version,updatedAt:row.updated_at};
 const base=['83','183'].map(id=>({id,name:'Medic '+id,icon:'generic',status:'Unverified',note:'Readiness check needed',version:0,updatedAt:null,...settings['vehicle:'+id]}));
 const extra=Object.entries(settings).filter(([key])=>key.startsWith('vehicle:custom-')).map(([key,value])=>({id:key.slice(8),icon:'generic',...value})).sort((a,b)=>a.name.localeCompare(b.name));
 const order=settings['vehicle-order']||{ids:[],version:0};const preferred=orderVehicles([...base,...extra],order.ids,false).map(u=>u.id);
 const announcements=activeAnnouncements(Object.entries(settings).filter(([key])=>key.startsWith('announcement:monday:')).map(([,value])=>value));
 return response({announcements,units:orderVehicles([...base,...extra],preferred),vehicleOrder:{ids:preferred,version:order.version},notes:{text:'',version:0,updatedAt:null,...settings.notes},fetchedAt:new Date().toISOString()})
 }catch{return response({error:'Station information unavailable. Retry shortly.'},503)}
}
export async function POST(r:Request){
 const user='station-admin';if(!canManageStation(r)||!sameStationOrigin(r)||!r.headers.get('content-type')?.includes('application/json'))return response({error:'Request not permitted.'},403);
 let key:string,content:string,version:number,adding=false;
 try{const body:any=await r.json();if(body.action==='reorderVehicles')return saveVehicleOrder(body,user!);if(body.action==='addVehicle'){
 const data=newVehicle.parse(body.data);const slug=data.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!slug)throw new Error();if(['medic83','medic183'].includes(slug.replaceAll('-','')))return response({error:'That vehicle already exists. Update its readiness card below.'},409);
 key='vehicle:custom-'+slug;version=0;content=JSON.stringify(data);adding=true;
 }else{if((body.key!=='notes'&&!/^vehicle:(83|183|custom-[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(body.key||''))||!Number.isInteger(body.version)||body.version<0)throw new Error();key=body.key;version=body.version;const data=key==='notes'?note.parse(body.data):vehicle.parse(body.data);if(key.startsWith('vehicle:custom-')&&(!(data as any).name||version===0))throw new Error();content=JSON.stringify(data)}
 }catch{return response({error:'Enter a vehicle name (up to 60 characters), a valid status, and a note up to 250 characters.'},400)}
 try{const db=calendarDb(),now=new Date().toISOString();if(key.startsWith('vehicle:')){const data=JSON.parse(content);{const old:any=await db.prepare('SELECT content FROM station_settings WHERE key=?').bind(key).first();const previous=old?JSON.parse(old.content):{};data.icon=data.icon||previous.icon||'generic';if(previous.statusSource==='monday'){data.status=previous.status;data.note=previous.note;data.statusSource='monday';data.mondayTimes=previous.mondayTimes}content=JSON.stringify(data)}}const result=version===0?await db.prepare('INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES (?,?,1,?,?) ON CONFLICT(key) DO NOTHING').bind(key,content,now,user).run():await db.prepare('UPDATE station_settings SET content=?,version=version+1,updated_at=?,updated_by=? WHERE key=? AND version=?').bind(content,now,user,key,version).run();if(!result.meta.changes)return response({error:adding?'That vehicle already exists. Reload to see its readiness card.':'This information changed on another device. Reload the latest values before saving.'},409);return response({saved:true,id:key.slice(8),version:version+1,updatedAt:now})}catch{return response({error:'Changes were not saved. Please retry.'},503)}
}

async function saveVehicleOrder(body:any,user:string){
 const parsed=z.object({ids:z.array(z.string().regex(/^(83|183|custom-[a-z0-9]+(?:-[a-z0-9]+)*)$/)).min(2).max(250),version:z.number().int().min(0)}).safeParse(body);
 if(!parsed.success||new Set(parsed.data.ids).size!==parsed.data.ids.length)return response({error:'Invalid vehicle order.'},400);
 try{
  const db=calendarDb(),rows=await db.prepare("SELECT key FROM station_settings WHERE key LIKE 'vehicle:custom-%'").all();
  const known=['83','183',...(rows.results as any[]).map(row=>row.key.slice(8))];
  if(known.length!==parsed.data.ids.length||known.some(id=>!parsed.data.ids.includes(id)))return response({error:'The vehicle list changed. Reload before reordering.'},409);
  const content=JSON.stringify({ids:parsed.data.ids}),now=new Date().toISOString(),version=parsed.data.version;
  const result=version===0?await db.prepare("INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES ('vehicle-order',?,1,?,?) ON CONFLICT(key) DO NOTHING").bind(content,now,user).run():await db.prepare("UPDATE station_settings SET content=?,version=version+1,updated_at=?,updated_by=? WHERE key='vehicle-order' AND version=?").bind(content,now,user,version).run();
  if(!result.meta.changes)return response({error:'Vehicle order changed on another device. Reload before reordering.'},409);
  return response({saved:true,version:version+1});
 }catch{return response({error:'Vehicle order was not saved. Please retry.'},503)}
}
