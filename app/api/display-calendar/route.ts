import {GET as calendar} from '../calendar/route';
import {dayAfter,occurrences} from '../../../lib/calendar-events';
export async function GET(request:Request){
 const result=await calendar(request);if(!result.ok)return result;
 const data=await result.json() as any;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const value=(name:string)=>parts.find(p=>p.type===name)!.value;
 const today=`${value('year')}-${value('month')}-${value('day')}`;
 const weekday=new Date(today+'T12:00:00Z').getUTCDay();
 const start=dayAfter(today,-((weekday+4)%7));
 return Response.json({today,days:Array.from({length:7},(_,i)=>dayAfter(start,i)),events:occurrences(data.events,start,7),fetchedAt:data.fetchedAt},{headers:{'Cache-Control':'no-store'}});
}
