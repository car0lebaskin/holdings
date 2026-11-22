import {useEffect,useState} from 'react';
import {greetingForHour} from '../lib/timeCopy.mjs';
export function Greeting(){
 const [hour,setHour]=useState(()=>new Date().getHours());
 useEffect(()=>{
  const update=()=>setHour(new Date().getHours());
  const timer=window.setInterval(update,60_000);
  document.addEventListener('visibilitychange',update);
  window.addEventListener('focus',update);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update)};
 },[]);
 return <>{greetingForHour(hour)}.</>;
}
