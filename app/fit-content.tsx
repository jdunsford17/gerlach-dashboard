'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
export default function FitContent({children,enabled=true}:{children:ReactNode;enabled?:boolean}){
 const host=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(1);
 useEffect(()=>{if(!enabled)return;let queued=0;const measure=()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{if(!host.current||!content.current)return;const framed=!!host.current.closest('.framedBoard');const height=host.current.clientHeight,natural=content.current.scrollHeight;setScale(framed&&height>0&&natural>0?Math.min(1,height/natural):1)})};const observer=new ResizeObserver(measure);if(host.current)observer.observe(host.current);if(content.current)observer.observe(content.current);window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();cancelAnimationFrame(queued);window.removeEventListener('resize',measure)}},[enabled]);
 if(!enabled)return <>{children}</>;
 return <div className="fitContainer" ref={host}><div className="fitContent" ref={content} style={{transform:scale<1?`scale(${scale})`:undefined,left:scale<1?`${(1-scale)*50}%`:undefined}}>{children}</div></div>
}
