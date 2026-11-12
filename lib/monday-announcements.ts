export const ANNOUNCEMENT_BOARD='18436521703';
export const ANNOUNCEMENT_COLUMNS:Record<string,string>={boolean719cy1cb:'enabled',short_textofdpg2hw:'title',long_texttxbsbi3x:'text',dates946rmys:'endDate',color_mm8d1wm6:'status'};
export function announcementChanges(event:any){
 if(String(event?.boardId)!==ANNOUNCEMENT_BOARD)return null;
 const id=String(event.pulseId||event.itemId||'');if(!/^\d{1,25}$/.test(id))throw Error('Invalid item');
 const time=Number(event.changedAt)*1000||Date.parse(event.triggerTime);if(!Number.isFinite(time)||time>Date.now()+300000)throw Error('Invalid time');
 const changes:Record<string,unknown>={};
 function decode(value:any):any{if(typeof value==='string'){try{return JSON.parse(value)}catch{return {text:value}}}if(value&&typeof value==='object'&&'value' in value)return decode(value.value);return value}
 function field(column:string,raw:any){const name=ANNOUNCEMENT_COLUMNS[column];if(!name)return;const value=decode(raw);let result:any;
  if(name==='enabled')result=value?.checked===true||value?.checked==='true';
  else if(name==='status')result=value?.label?.text??value?.label??value?.text??'';
  else if(name==='endDate')result=value?.date??'';
  else result=value?.text??'';
  if(name!=='enabled'&&(typeof result!=='string'||result.length>10000))throw Error('Invalid field');
  changes[name]=name==='title'?result.slice(0,200):name==='text'?result.slice(0,5000):result;
 }
 const type=event.type;
 if(type==='delete_pulse'||type==='archive_pulse'||type==='item_deleted'||type==='item_archived')changes.removed=true;
 else if(type==='create_pulse'||type==='create_item'){for(const [column,value] of Object.entries(event.columnValues||{}))field(column,value);changes.removed=false;}
 else field(event.columnId,event.value);
 return Object.keys(changes).length?{id,time,changes}:null;
}
export function activeAnnouncements(rows:any[],now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return rows.filter(a=>a.enabled&&!a.removed&&a.status!=='Expired'&&a.text?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(a.endDate||'')&&Number.isFinite(Date.parse(a.endDate+'T12:00:00Z'))&&new Date(a.endDate+'T12:00:00Z').toISOString().slice(0,10)===a.endDate&&a.endDate>=today).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(a=>({id:a.id,title:a.title||'Station announcement',text:a.text,endDate:a.endDate}));
}
