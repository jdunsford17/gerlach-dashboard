'use client';
import FitContent from './fit-content';
import {useEffect,useState} from 'react';
import {CloudSun,Sun,Moon,Cloud,CloudRain,CloudSnow,CloudLightning,Wind,Droplets,Thermometer,Eye,TriangleAlert,X} from 'lucide-react';
const tz='America/Los_Angeles';
function icon(text:string,day=true){const s=text.toLowerCase();return /thunder/.test(s)?CloudLightning:/snow|sleet|ice/.test(s)?CloudSnow:/rain|shower|drizzle/.test(s)?CloudRain:/fog|cloud|overcast/.test(s)?Cloud:/wind/.test(s)?Wind:day?Sun:Moon}
const percent=(v:any)=>typeof v==='number'?Math.round(v)+'%':'—';
const f=(v:any)=>typeof v==='number'?Math.round(v*9/5+32):null;
const mph=(q:any)=>typeof q?.value==='number'?Math.round(q.value*(q.unitCode?.endsWith('km_h-1')?0.621371:2.236936)):null;
function date(s:string,options:Intl.DateTimeFormatOptions){return new Date(s).toLocaleString('en-US',{timeZone:tz,...options})}
export default function WeatherPanel({weather,error,busy,refresh,now}:{weather:any;error:string;busy:boolean;refresh:()=>void;now:Date|null}){
 const [view,setView]=useState<'daily'|'hourly'>('daily');const [alertsOpen,setAlertsOpen]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>setView(v=>v==='daily'?'hourly':'daily'),20000);return()=>clearInterval(timer)},[]);
 const periods=weather?.periods||[],first=periods[0];
 const hourly=weather?.hourly?.filter((p:any)=>!now||Date.parse(p.endTime)>now.getTime())||[];
 const o=weather?.observation,age=o&&now?(now.getTime()-Date.parse(o.timestamp))/60000:Infinity;
 const fresh=!!o&&age<=90&&age>=-10;
 const visibilityAvailable=fresh&&o.visibility?.value!=null;
 const temperature=fresh?f(o.temperature?.value):first?.temperature;
 const text=(value:unknown)=>typeof value==='string'?value.trim():'';
 const observedCondition=fresh?text(o.textDescription):'';
 const hourlyCondition=text(hourly[0]?.shortForecast);
 const forecastCondition=hourlyCondition||text(first?.shortForecast);
 const condition=observedCondition||forecastCondition;
 const Icon=condition?icon(condition,hourly[0]?.isDaytime??first?.isDaytime):CloudSun;
 const wind=fresh&&mph(o.windSpeed)!=null?mph(o.windSpeed)+' mph':(hourly[0]?.windSpeed||first?.windSpeed||'—');
 const direction=fresh&&o.windDirection?.value!=null?['N','NE','E','SE','S','SW','W','NW'][Math.round(o.windDirection.value/45)%8]:(hourly[0]?.windDirection||first?.windDirection||'');
 const gust=fresh?mph(o.windGust):null;
 const humidity=fresh?o.relativeHumidity?.value:hourly[0]?.relativeHumidity?.value;
 const feels=fresh?f(o.windChill?.value??o.heatIndex?.value??o.temperature?.value):null;
 const stale=!!weather&&!!now&&now.getTime()-Date.parse(weather.fetchedAt)>900000;
 const days:Array<any>=[];periods.forEach((p:any)=>{const key=date(p.startTime,{year:'numeric',month:'2-digit',day:'2-digit'});let d=days.find(x=>x.key===key);if(!d){d={key,start:p.startTime};days.push(d)}if(p.isDaytime)d.day=p;else d.night=p;});
 return <section className="panel weather weatherRich"><div className="sectionHead"><h2><CloudSun size={20}/> Weather</h2><div className={'weatherAlert weatherHeaderAlerts '+(weather?.alerts?.length?'hasAlerts':'')}><TriangleAlert size={15}/><span>{!weather?'Loading NWS alerts…':weather.alerts==null?'NWS alerts unavailable':weather.alerts.length?weather.alerts.map((a:any)=>a.event).join(' · '):'No active NWS alerts for Gerlach'}</span>{weather?.alerts?.length>0&&<button onClick={()=>setAlertsOpen(true)}>Read alerts</button>}</div></div><div className="weatherContent"><FitContent>
 {!first?<div className="weatherEmpty"><CloudSun size={42}/><h3>{error||'Loading local weather…'}</h3><p>Forecast, hourly outlook, and regional observations</p></div>:<>
 <div className="weatherHero"><div className="weatherReading"><Icon size={52} strokeWidth={1.3}/><strong>{temperature??'—'}<span>°{fresh?'F':first.temperatureUnit}</span></strong></div><div className="weatherSummary"><div className="weatherSource">{fresh?'OBSERVED CONDITIONS':first.name.toUpperCase()+' · FORECAST'}</div><h3>{condition||(fresh?'Observation received':'Forecast available')}</h3>{!condition&&<small className="conditionSource">Conditions description not reported</small>}{!fresh&&<p>{first.detailedForecast}</p>}{fresh&&<small>Observed {date(o.timestamp,{hour:'numeric',minute:'2-digit'})} PT</small>}</div></div>
 <div className="weatherDetails"><div><Wind size={17}/><span>Wind {direction}<strong>{wind}{gust!=null&&<small> · gust {gust}</small>}</strong></span></div><div><Droplets size={17}/><span>Rain chance · next hour<strong>{percent(hourly[0]?.probabilityOfPrecipitation?.value)}</strong></span></div><div><Thermometer size={17}/><span>{fresh?'Feels like':'Humidity · forecast'}<strong>{fresh?(feels??'—')+'°F':percent(humidity)}</strong></span></div><div><Eye size={17}/><span>{fresh?(visibilityAvailable?'Visibility':'Humidity'):'Dew point'}<strong>{fresh?(visibilityAvailable?(o.visibility.value/1609.344).toFixed(1)+' mi':percent(humidity)):(f(hourly[0]?.dewpoint?.value)??'—')+'°F'}</strong></span></div></div>
 <div className="weatherViewTabs" role="group" aria-label="Forecast view"><button className={view==='daily'?'selected':''} onClick={()=>setView('daily')}>5-day forecast</button><button className={view==='hourly'?'selected':''} onClick={()=>setView('hourly')}>Next 8 hours</button><span>{view==='daily'?'High / low':'Temperature / rain chance'}</span></div>
 <div className="forecastViews"><div className="forecastView" style={{visibility:view==='hourly'?'visible':'hidden'}} inert={view!=='hourly'} aria-hidden={view!=='hourly'}>{weather.hourly===null||weather.hourly===undefined?<div className="weatherPartial">Hourly forecast unavailable</div>:<div className="hourlyForecast">{hourly.slice(0,8).map((p:any)=>{const I=icon(p.shortForecast,p.isDaytime);return <div key={p.number} title={p.shortForecast+' · wind '+p.windSpeed+' '+p.windDirection}><div className="hourHeading"><span>{date(p.startTime,{hour:'numeric'})}</span><I size={20}/></div><div className="hourReadings"><small className="hourRain" title="Rain chance">{percent(p.probabilityOfPrecipitation?.value)}</small><strong>{p.temperature}°</strong><small className="hourWind" title="Wind forecast"><span>{p.windDirection}</span>{p.windSpeed||'—'}</small></div></div>})}</div>}</div><div className="forecastView" style={{visibility:view==='daily'?'visible':'hidden'}} inert={view!=='daily'} aria-hidden={view!=='daily'}><div className="dailyForecast">{days.slice(0,5).map(d=>{const p=d.day||d.night,I=icon(p.shortForecast,p.isDaytime);return <div key={d.key} title={p.detailedForecast}><span>{date(d.start,{weekday:'short'})}</span><I size={20}/><strong>{d.day?d.day.temperature+'°':'—'} <small>/ {d.night?d.night.temperature+'°':'—'}</small></strong><small>{p.shortForecast}</small></div>})}</div></div></div>

 </>}
 </FitContent></div>{(error||stale)&&<p className="weatherConnectionError" role="status">{error||'Forecast may be stale'}{weather?' · previous data retained':''}</p>}{alertsOpen&&<div className="overlay calendarOverlay" onClick={()=>setAlertsOpen(false)}><div className="calendarDialog" onClick={e=>e.stopPropagation()}><div className="drawerHead"><h2>NWS alerts</h2><button aria-label="Close weather alerts" onClick={()=>setAlertsOpen(false)}><X size={20}/></button></div>{weather?.alerts?.map((a:any)=><div className="alertDetail" key={a.id||a.headline}><strong>{a.headline}</strong><p>{a.description}</p>{a.instruction&&<p>{a.instruction}</p>}</div>)}</div></div>}</section>
}
