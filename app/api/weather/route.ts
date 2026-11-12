const lat=40.6517,lon=-119.3558;
const distance=(a:number,b:number)=>{const rad=(v:number)=>v*Math.PI/180;const x=Math.sin(rad(a-lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(a))*Math.sin(rad(b-lon)/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))};
export async function GET() {
 const headers={'User-Agent':'GerlachEMSStationBoard (station dashboard)','Accept':'application/geo+json'};
 try {
  const get=async(url:string):Promise<any>=>{const r=await fetch(url,{headers,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Weather service unavailable');return r.json()};
  const point=await get(`https://api.weather.gov/points/${lat},${lon}`);
  const regionalObservation=async()=>{const stations=await get(point.properties.observationStations);const nearby=stations.features.map((s:any)=>({...s,distanceKm:distance(s.geometry.coordinates[1],s.geometry.coordinates[0])})).filter((s:any)=>s.distanceKm<=75).sort((a:any,b:any)=>a.distanceKm-b.distanceKm).slice(0,3);const results=await Promise.allSettled(nearby.map(async(s:any)=>{const d=await get(s.id+'/observations/latest');return {station:s.properties.name,distanceKm:Math.round(s.distanceKm),...d.properties}}));return results.flatMap((r:any)=>r.status==='fulfilled'&&r.value.timestamp&&r.value.temperature?.value!=null?[r.value]:[]).sort((a:any,b:any)=>Date.parse(b.timestamp)-Date.parse(a.timestamp))[0]||null};
  const observation=async()=>{
   const [local,regional]=await Promise.allSettled([
    get('https://api.weather.gov/stations/F0371/observations/latest').then(d=>({...d.properties,station:'FW0371 Gerlach',stationId:'F0371',distanceKm:0.2})),
    regionalObservation()
   ]);
   const report=local.status==='fulfilled'?local.value:null;
   const age=report?.timestamp?(Date.now()-Date.parse(report.timestamp))/60000:Infinity;
   if(report?.temperature?.value!=null&&age>=-10&&age<=90)return {report,fallback:false};
   return {report:regional.status==='fulfilled'?regional.value:null,fallback:true};
  };
  const results=await Promise.allSettled([get(point.properties.forecast),get('https://api.weather.gov/alerts/active?point='+lat+','+lon),get(point.properties.forecastHourly),observation()]);
  if(results[0].status==='rejected')throw new Error('Forecast unavailable');
  const value=(i:number)=>results[i].status==='fulfilled'?(results[i] as PromiseFulfilledResult<any>).value:null;
  return Response.json({periods:value(0).properties.periods,issued:value(0).properties.updated,hourly:value(2)?.properties.periods||null,observation:value(3)?.report||null,observationFallback:value(3)?.fallback??true,preferredStation:'FW0371 Gerlach',alerts:value(1)?.features.map((x:any)=>({id:x.id,event:x.properties.event,headline:x.properties.headline,severity:x.properties.severity,expires:x.properties.expires,description:x.properties.description,instruction:x.properties.instruction}))??null,fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'private, max-age=300'}});
 }catch {return Response.json({error:'NWS forecast unavailable. Retry shortly.'},{status:503})}
}
