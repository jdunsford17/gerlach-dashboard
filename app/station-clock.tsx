'use client';
import {useEffect,useState} from 'react';
const tz='America/Los_Angeles';
export default function StationClock(){
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer)},[]);
 return <div className="clock stationClock"><span>{now?now.toLocaleDateString('en-US',{timeZone:tz,weekday:'long',month:'short',day:'numeric',year:'numeric'}):'Pacific time'}</span><strong>{now?now.toLocaleTimeString('en-US',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):'—:—:—'}</strong></div>
}
