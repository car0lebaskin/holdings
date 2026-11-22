import {useEffect,useRef,useState} from 'react';
type Side='top'|'bottom';
export function EdgeGlow(){
 const [pulse,setPulse]=useState<{side:Side;id:number}|null>(null);
 const touch=useRef<{y:number;time:number}|null>(null);
 const last=useRef({y:0,time:0});
 const cooldown=useRef(0);
 const reset=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  function fire(side:Side){
   const now=performance.now();
   if(now-cooldown.current<360||document.querySelector('[role="dialog"]'))return;
   cooldown.current=now;
   if(reset.current)clearTimeout(reset.current);
   setPulse({side,id:Math.round(now)});
   reset.current=setTimeout(()=>setPulse(null),550);
  }
  function atEdges(){
   const documentHeight=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
   return {top:window.scrollY<=5,bottom:documentHeight>window.innerHeight+12&&window.scrollY+window.innerHeight>=documentHeight-10};
  }
  const start=(e:TouchEvent)=>{if(e.touches.length!==1)return;touch.current={y:e.touches[0].clientY,time:performance.now()}};
  const move=(e:TouchEvent)=>{
   if(!touch.current||e.touches.length!==1)return;
   const dy=e.touches[0].clientY-touch.current.y;
   const edges=atEdges();
   if(dy>24&&edges.top)fire('top');
   if(dy< -24&&edges.bottom)fire('bottom');
  };
  const stop=()=>{touch.current=null};
  const scroll=()=>{
   const now=performance.now(),y=window.scrollY;
   const dy=y-last.current.y,dt=Math.max(now-last.current.time,16);
   last.current={y,time:now};
   if(Math.abs(dy)/dt<0.65)return;
   const edges=atEdges();
   if(dy<0&&edges.top)fire('top');
   if(dy>0&&edges.bottom)fire('bottom');
  };
  last.current={y:window.scrollY,time:performance.now()};
  window.addEventListener('touchstart',start,{passive:true});
  window.addEventListener('touchmove',move,{passive:true});
  window.addEventListener('touchend',stop,{passive:true});
  window.addEventListener('touchcancel',stop,{passive:true});
  window.addEventListener('scroll',scroll,{passive:true});
  return ()=>{
   window.removeEventListener('touchstart',start);
   window.removeEventListener('touchmove',move);
   window.removeEventListener('touchend',stop);
   window.removeEventListener('touchcancel',stop);
   window.removeEventListener('scroll',scroll);
   if(reset.current)clearTimeout(reset.current);
  };
 },[]);
 return pulse?<div key={pulse.id} aria-hidden="true" className={'edge-glow edge-glow-'+pulse.side}/>:null;
}
