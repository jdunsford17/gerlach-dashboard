const env=process.env;
import {calendarDb} from '../../../../db/calendar';
import {fleetChange} from '../../../../lib/monday-fleet';
const reply=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(r:Request){
 const secret=(env as any).MONDAY_FLEET_WEBHOOK_KEY,provided=new URL(r.url).searchParams.get('key');
 if(!secret||!provided||provided.length!==secret.length)return reply({error:'Not authorized'},401);
 const encoder=new TextEncoder(),a=await crypto.subtle.digest('SHA-256',encoder.encode(secret)),b=await crypto.subtle.digest('SHA-256',encoder.encode(provided));let diff=0;new Uint8Array(a).forEach((v,i)=>diff|=v^new Uint8Array(b)[i]);if(diff)return reply({error:'Not authorized'},401);
 let body:any;try{const raw=await r.text();if(raw.length>20000)return reply({error:'Payload too large'},413);body=JSON.parse(raw)}catch{return reply({error:'Invalid JSON'},400)}
 if(typeof body.challenge==='string'&&body.challenge.length<=1000)return reply({challenge:body.challenge});
 let change;try{change=fleetChange(body.event)}catch{return reply({error:'Invalid readiness event'},400)}if(!change)return reply({ignored:true});
 try{const db=calendarDb();for(let attempt=0;attempt<4;attempt++){
  const rows=await db.prepare("SELECT * FROM station_settings WHERE key LIKE 'vehicle:%'").all();
  const row:any=(rows.results as any[]).find(row=>JSON.parse(row.content).name?.toLowerCase().replace(/[^a-z0-9]/g,'')===change.item.name.toLowerCase().replace(/[^a-z0-9]/g,''))||(rows.results as any[]).find(row=>row.key==='vehicle:'+change.item.id);
  const key=row?.key||'vehicle:'+change.item.id,old=row?JSON.parse(row.content):{name:change.item.name,icon:'generic',status:'Unverified',note:''};
  if((old.mondayTimes?.[change.field]??0)>=change.time)return reply({received:true,duplicate:true});
  const data={...old,[change.field]:change.value,statusSource:'monday',mondayTimes:{...old.mondayTimes,[change.field]:change.time}};
  const updated=new Date(Math.max(change.time,...Object.values(data.mondayTimes).map(Number))).toISOString();
  const result=row?await db.prepare('UPDATE station_settings SET content=?,version=version+1,updated_at=?,updated_by=? WHERE key=? AND version=?').bind(JSON.stringify(data),updated,'monday-fleet',key,row.version).run():await db.prepare('INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES (?,?,1,?,?) ON CONFLICT(key) DO NOTHING').bind(key,JSON.stringify(data),updated,'monday-fleet').run();
  if(result.meta.changes)return reply({received:true});
 }return reply({error:'Concurrent update; retry'},503)}catch{return reply({error:'Update unavailable; retry'},503)}
}
