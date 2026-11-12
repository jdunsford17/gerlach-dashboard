import {canManageStation,sameStationOrigin} from '../../../../lib/station-auth';
import {after} from 'next/server';
const env=process.env;
import {calendarDb} from '../../../../db/calendar';
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(r:Request){
 if(!canManageStation(r))return reply({error:'Sign in required.'},401);
 try{const db=calendarDb();const setup:any=await db.prepare("SELECT content FROM station_settings WHERE key='email-import-setup'").first();const connection=setup?JSON.parse(setup.content):null;const row:any=await db.prepare("SELECT content,updated_at FROM station_settings WHERE key='statistics'").first();const email=row?JSON.parse(row.content).emailImport:null;return reply({connection,ready:!!(env as any).ELITE_EMAIL_IMPORT_TOKEN,lastImport:email?.importedAt||null})}catch{return reply({error:'Import status unavailable.'},503)}
}
export async function POST(r:Request){
 if(!canManageStation(r)||!sameStationOrigin(r)||!r.headers.get('content-type')?.includes('application/json'))return reply({error:'Request not permitted.'},403);
 try{
  const text=await r.text();if(text.length>3000)return reply({error:'Setup request too large.'},413);
  const {url,code}=JSON.parse(text);
  if(typeof url!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)||typeof code!=='string'||code.length<20||code.length>200)return reply({error:'Enter the deployed Apps Script web app URL and setup code.'},400);
  const bindings=env as any;if(!bindings.ELITE_EMAIL_IMPORT_TOKEN)return reply({error:'Email import is not configured yet.'},503);
  const job=crypto.randomUUID(),db=calendarDb(),now=new Date().toISOString();
  await db.prepare("INSERT INTO station_settings (key,content,version,updated_at,updated_by) VALUES ('email-import-setup',?,1,?,'email-setup') ON CONFLICT(key) DO UPDATE SET content=excluded.content,version=station_settings.version+1,updated_at=excluded.updated_at").bind(JSON.stringify({job,state:'connecting',updatedAt:now}),now).run();
  const endpoint=new URL('/api/statistics/email',process.env.STATION_ORIGIN||r.url).href;
  after(async()=>{
   let state='connected',error='';
   try{
    const signal=AbortSignal.timeout(25000);
    let result=await fetch(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify({setupCode:code,endpoint,importToken:bindings.ELITE_EMAIL_IMPORT_TOKEN}),signal});
    for(let i=0;i<3&&[301,302,303,307,308].includes(result.status);i++){
     const location=result.headers.get('location');if(!location)throw Error('Google returned a redirect without a destination.');
     const next=new URL(location,result.url||url);
     if(next.protocol!=='https:'||!['script.googleusercontent.com','script.google.com'].includes(next.hostname))throw Error('Google requires sign-in. Set the web app deployment access to Anyone, then redeploy.');
     // ContentService redirects lead to a read-only result URL. Never forward setup secrets.
     result=await fetch(next.href,{method:'GET',redirect:'manual',signal});
    }
    const text=await result.text();let data:any;
    try{data=JSON.parse(text)}catch{throw Error('Google returned a web page instead of the script result. Check Execute as: Me, access: Anyone, and that the deployment uses the latest script version.')}
    if(!result.ok||data.configured!==true)throw Error('Setup code was rejected. Run install again, copy the new SETUP_CODE, and reconnect.');
   }catch(e){state='failed';error=e instanceof Error&&e.name==='TimeoutError'?'Google took too long to respond. Check your Apps Script execution history, then retry with a new setup code.':e instanceof Error?e.message:'Connection failed.'}
   const updatedAt=new Date().toISOString();
   await db.prepare("UPDATE station_settings SET content=?,updated_at=? WHERE key='email-import-setup' AND json_extract(content,'$.job')=?").bind(JSON.stringify({job,state,error,updatedAt}),updatedAt,job).run();
  });
  return reply({connecting:true,job},202);
 }catch{return reply({error:'Could not connect. Check the web app deployment and try again.'},502)}
}
