const env=process.env;
import {calendarDb} from '../../../../db/calendar';
import {importEliteCsv} from '../../../../lib/call-statistics';
import {statisticsSchema} from '../../../../lib/statistics-schema';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('')}
export async function POST(r:Request){
 const token=(env as any).ELITE_EMAIL_IMPORT_TOKEN;
 if(!token||await hash(r.headers.get('authorization')||'')!==await hash('Bearer '+token))return reply({error:'Import not authorized.'},401);
 if(!r.headers.get('content-type')?.includes('application/json'))return reply({error:'Send a CSV import as JSON.'},415);
 try{
  const text=await r.text();if(text.length>9_000_000)return reply({error:'Attachment is too large.'},413);
  const body=JSON.parse(text);if(typeof body.csv!=='string'||typeof body.messageId!=='string'||body.messageId.length>250||typeof body.receivedAt!=='string')return reply({error:'Invalid import request.'},400);
  const received=Date.parse(body.receivedAt);if(!Number.isFinite(received)||received>Date.now()+300000)return reply({error:'Invalid email timestamp.'},400);
  const digest=await hash(body.messageId+'\n'+body.csv),db=calendarDb();
  const row:any=await db.prepare("SELECT content,version FROM station_settings WHERE key='statistics'").first();
  const previous=row?JSON.parse(row.content).emailImport:null;
  if(previous?.digest===digest)return reply({saved:true,duplicate:true});
  if(previous&&received<=Date.parse(previous.receivedAt))return reply({saved:true,skipped:true});
  const snapshot=statisticsSchema.parse(importEliteCsv(body.csv));
  if(!snapshot.days.length)return reply({error:'No dated calls found; existing statistics retained.'},400);
  const now=new Date().toISOString(),content=JSON.stringify({...snapshot,emailImport:{digest,receivedAt:new Date(received).toISOString(),importedAt:now}});
  if(content.length>700000)return reply({error:'Aggregate is too large; existing statistics retained.'},413);
  const result=row?await db.prepare("UPDATE station_settings SET content=?,version=version+1,updated_at=?,updated_by='email-import' WHERE key='statistics' AND version=?").bind(content,now,row.version).run():await db.prepare("INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES ('statistics',?,1,?,'email-import') ON CONFLICT(key) DO NOTHING").bind(content,now).run();
  if(!result.meta.changes)return reply({error:'Statistics changed during import. Retry this email.'},409);
  return reply({saved:true,updatedAt:now,sourceRows:snapshot.sourceRows});
 }catch{return reply({error:'CSV was not accepted. Existing statistics retained. Check the report columns and export format.'},400)}
}
