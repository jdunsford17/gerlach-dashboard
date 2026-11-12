export const CREWS=['Teves/Dunsford','Rembisz/Sill','Vaughn/Zino'];
const TZ='America/Los_Angeles';
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function parts(d:Date){const p:Object=Object.fromEntries(formatter.formatToParts(d).map(x=>[x.type,x.value]));return p as Record<string,string>}
export function pacificDay(d:Date){const p=parts(d);return `${p.year}-${p.month}-${p.day}`}
function addDay(s:string,n:number){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function crewWeek(d:Date){const p=parts(d),day=pacificDay(d);let start=addDay(day,-((new Date(day+'T12:00:00Z').getUTCDay()+4)%7));if(day===start&&Number(p.hour)<10)start=addDay(start,-7);const weeks=Math.round((Date.parse(start+'T12:00:00Z')-Date.parse('2026-09-30T12:00:00Z'))/604800000);return {start,crew:CREWS[((weeks%3)+3)%3]}}
export function parseEliteDate(value:string):Date|null{
 const s=value.trim();if(!s)return null;
 if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)){const d=new Date(s);return Number.isFinite(+d)?d:null}
 const m=s.match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?$/i);if(!m)return null;
 const y=Number(m[1]||m[6]),mo=Number(m[2]||m[4]),day=Number(m[3]||m[5]);let h=Number(m[7]);if(m[10]){if(h<1||h>12)return null;h=h%12+(m[10].toUpperCase()==='PM'?12:0)}
 const min=Number(m[8]),sec=Number(m[9]||0);if(h>23||min>59||sec>59)return null;
 const wall=Date.UTC(y,mo-1,day,h,min,sec),matches=[7,8].map(offset=>new Date(wall+offset*3600000)).filter(d=>{const p=parts(d);return Number(p.year)===y&&Number(p.month)===mo&&Number(p.day)===day&&Number(p.hour)===h&&Number(p.minute)===min&&Number(p.second)===sec});return matches.length===1?matches[0]:null;
}
export type DayStats={date:string;calls:number;transports:number;chute:number[];response:number[]};
export type WeekStats={start:string;crew:string;calls:number;fastestChute:number|null;fastestCrew:string};
export type DispositionBucket={date:string;week:string;counts:Record<string,number>};
export type StatsSnapshot={dispositions?:DispositionBucket[];days:DayStats[];weeks:WeekStats[];sourceRows:number;filteredRows:number;invalidRows:number;duplicateRows:number;timingExcluded:number;undatedCalls:number;fallbackDates:number;importedAt:string};
function csvRows(text:string){const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else if(!quoted&&cell)throw new Error('CSV quoting is invalid. Export CSV directly from Elite.');else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw new Error('The CSV ends inside a quoted field.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows}
function normalize(s:string){return s.replace(/^\uFEFF/,'').replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase()}
export function importEliteCsv(text:string,now=new Date()):StatsSnapshot{
 if(text.length>8_000_000)throw new Error('Use an export smaller than 8 MB.');const rows=csvRows(text);const header=rows.findIndex(r=>r.some(x=>normalize(x)==='responseemsunitcallsign'));if(header<0)throw new Error('Missing Response EMS Unit Call Sign. Use the Gerlach EMS Operations and Crew Records report.');const names=rows[header].map(normalize);
 const column=(label:string,required=true)=>{const i=names.indexOf(normalize(label));if(required&&i<0)throw new Error('Missing column: '+label);return i};
 const unit=column('Response EMS Unit Call Sign'),number=column('Response Incident Number'),id=column('Incident ID'),dispatch=column('Incident Unit Notified By Dispatch Date Time'),enroute=column('Incident Unit En Route Date Time'),arrived=column('Incident Unit Arrived On Scene Date Time'),crewColumn=column('Incident Crew Member Full Name List'),incidentDate=column('Incident Date Time'),transport=column('Transport Disposition'),disposition=column('Disposition Incident Patient Disposition',false);
 const dispositions=new Map<string,DispositionBucket>(),dispositionRecords=new Set<string>();
 const days=new Map<string,DayStats>(),weeks=new Map<string,WeekStats>();const calls=new Map<string,{date:string;week:string;transport:boolean}>(),responses=new Set<string>();let filteredRows=0,invalidRows=0,duplicateRows=0,timingExcluded=0,undatedCalls=0,fallbackDates=0;const undated=new Set<string>();const data=rows.slice(header+1);if(data.length>25000)throw new Error('Limit this export to 25,000 rows.');
 for(const row of data){const u=normalize(row[unit]||'');if(!['medic83','ems83','medic183'].includes(u)){filteredRows++;continue}const notified=parseEliteDate(row[dispatch]||''),occurred=notified||parseEliteDate(row[incidentDate]||'');const recordId=(row[id]||'').trim()||[row[number],row[unit],row[dispatch],row[incidentDate]].join('|');if(recordId&&!dispositionRecords.has(recordId)&&(!occurred||+occurred<=+now+300000)){dispositionRecords.add(recordId);const date=occurred?pacificDay(occurred):'',week=occurred?crewWeek(occurred).start:'',bucketKey=date+':'+week;const bucket=dispositions.get(bucketKey)||{date,week,counts:{}};const label=disposition>=0?(row[disposition]||'').trim()||'Not recorded':'Not recorded';bucket.counts[label]=(bucket.counts[label]||0)+1;dispositions.set(bucketKey,bucket)}if(!occurred){const raw=(row[number]||'').trim(),key=/\d/.test(raw)&&!/#/.test(raw)?raw:(row[id]||'').trim();if(key&&!undated.has(key)){undated.add(key);undatedCalls++}else invalidRows++;continue}if(+occurred>+now+300000){invalidRows++;continue}if(!notified)fallbackDates++;const date=pacificDay(occurred),week=crewWeek(occurred);const entered=(row[number]||'').trim(),incident=/\d/.test(entered)&&!/[#]/.test(entered)?entered.replace(/^[()]|[()]$/g,''):'',fallback=(row[id]||'').trim();if(!incident&&!fallback){invalidRows++;continue}const callKey=incident?date.slice(0,4)+':'+incident:'id:'+fallback;const responseKey=callKey+':'+u+':'+occurred.toISOString();if(responses.has(responseKey)){duplicateRows++;continue}responses.add(responseKey);
 if(!days.has(date))days.set(date,{date,calls:0,transports:0,chute:[],response:[]});if(!weeks.has(week.start))weeks.set(week.start,{...week,calls:0,fastestChute:null,fastestCrew:''});const d=days.get(date)!,w=weeks.get(week.start)!;
 const td=(row[transport]||'').trim(),pd=disposition>=0?(row[disposition]||'').trim():'';const transported=/^Transport by This EMS Unit(?:\b|$)/i.test(td)||/^Patient Treated, Transported by this EMS Unit$/i.test(pd);
 const old=calls.get(callKey);if(!old){calls.set(callKey,{date,week:week.start,transport:transported});d.calls++;w.calls++;if(transported)d.transports++}else if(transported&&!old.transport){days.get(old.date)!.transports++;old.transport=true}
 const en=parseEliteDate(row[enroute]||''),scene=parseEliteDate(row[arrived]||'');const chute=en&&notified?(+en-+notified)/1000:NaN,response=scene&&notified?(+scene-+notified)/1000:NaN;
 if(Number.isFinite(chute)&&chute>0&&chute<=86400){d.chute.push(chute);if(w.fastestChute===null||chute<w.fastestChute){w.fastestChute=chute;w.fastestCrew=(row[crewColumn]||'').trim()||'Crew not recorded'}}else timingExcluded++;
 if(Number.isFinite(response)&&response>0&&response<=86400&&(!en||+scene!>=+en))d.response.push(response);
 }
 if(!calls.size&&!undatedCalls)throw new Error('No usable Gerlach calls found. Check the unit names, incident numbers, and Pacific dispatch timestamps.');return {dispositions:[...dispositions.values()],days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),weeks:[...weeks.values()].sort((a,b)=>a.start.localeCompare(b.start)),sourceRows:data.length,filteredRows,invalidRows,duplicateRows,timingExcluded,undatedCalls,fallbackDates,importedAt:now.toISOString()};
}
export function duration(seconds:number|null){if(seconds===null)return '—';const n=Math.round(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
export function summarizeStats(s:StatsSnapshot,now=new Date()){
 const today=pacificDay(now),current=crewWeek(now);const month=today.slice(0,7),year=today.slice(0,4);const monthly=s.days.filter(d=>d.date.startsWith(month));const timings=(type:'chute'|'response')=>{const values=monthly.flatMap(d=>d[type]).sort((a,b)=>a-b);return {samples:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,median:values.length?(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2:null}};
 const complete=s.weeks.filter(w=>w.start<current.start),record=complete.reduce<WeekStats|null>((a,w)=>!a||w.calls>a.calls?w:a,null);const fastest=s.weeks.filter(w=>w.fastestChute!==null).reduce<WeekStats|null>((a,w)=>!a||w.fastestChute!<a.fastestChute!?w:a,null);
 return {crew:current.crew,weekStart:current.start,weekCalls:s.weeks.find(w=>w.start===current.start)?.calls||0,monthCalls:monthly.reduce((a,d)=>a+d.calls,0),yearCalls:s.days.filter(d=>d.date.startsWith(year)).reduce((a,d)=>a+d.calls,0),transports:monthly.reduce((a,d)=>a+d.transports,0),chute:timings('chute'),response:timings('response'),busiest:record,fastest,range:[s.days[0]?.date,s.days.at(-1)?.date]};
}

export const DISPOSITION_LABELS=['Transported','Transferred to Other Agency','Treat & Release','Refusal','Canceled','N/A'] as const;
export function dispositionGroup(label:string){
 const s=label.trim().toLowerCase();
 if(/cancel/.test(s))return 'Canceled';
 if(/treated.*released.*(?:\bama\b|against medical advice)/.test(s))return 'Treat & Release';
 if(/refus|\bama\b|against medical advice/.test(s))return 'Refusal';
 if(/(?:transfer|transport).*(?:another|other).*?(?:unit|agency)|transferred care/.test(s))return 'Transferred to Other Agency';
 if(/transported by this|transport by this/.test(s))return 'Transported';
 if(/released.*protocol|treated.*released|evaluated.*no treatment|treat.*release/.test(s))return 'Treat & Release';
 return 'N/A';
}
export function dispositionBreakdown(s:StatsSnapshot,period:string,now=new Date()){
 const today=pacificDay(now),week=crewWeek(now).start,counts:Record<string,number>=Object.fromEntries(DISPOSITION_LABELS.map(label=>[label,0]));
 for(const b of s.dispositions||[]){if(period==='week'&&b.week!==week||period==='month'&&!b.date.startsWith(today.slice(0,7))||period==='year'&&!b.date.startsWith(today.slice(0,4)))continue;for(const [label,n] of Object.entries(b.counts)){const group=dispositionGroup(label);counts[group]+=n}}
 const total=Object.values(counts).reduce((a,n)=>a+n,0);return {total,rows:DISPOSITION_LABELS.map(label=>({label,count:counts[label],percent:total?counts[label]/total*100:0}))};
}
