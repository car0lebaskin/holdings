import {useEffect,useRef,useState} from 'react';

type Side='top'|'bottom';
type Glow={side:Side;mode:'held'|'release'|'impact';id:number};

/* A held overscroll is a sustained state. Momentum scrolling uses a single
   impact when the edge is reached; neither path continuously retriggers. */
export function EdgeGlow(){
 const [glow,setGlow]=useState<Glow|null>(null);
 const current=useRef<Glow|null>(null);
 const started=useRef<{y:number}|null>(null);
 const heldSide=useRef<Side|null>(null);
 const lastScroll=useRef({y:0,at:0});
 const armed=useRef({top:true,bottom:true});
 const timeout=useRef<ReturnType<typeof setTimeout>|null>(null);
 const seq=useRef(0);

 useEffect(()=>{
  function clearTimer(){if(timeout.current){clearTimeout(timeout.current);timeout.current=null}}
  function show(value:Glow|null){current.current=value;setGlow(value)}
  function edges(){
   const full=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
   const bottomGap=full-(window.scrollY+window.innerHeight);
   return {top:window.scrollY<=6,bottom:full>window.innerHeight+12&&bottomGap<=12,bottomGap};
  }
  function blocked(){return !!document.querySelector('[role="dialog"]')}
  function hold(side:Side){
   if(heldSide.current===side)return;
   clearTimer();
   heldSide.current=side;
   // Disarm the kinetic impact until the user moves away from this edge.
   armed.current[side]=false;
   show({side,mode:'held',id:++seq.current});
  }
  function release(){
   const side=heldSide.current;
   if(!side)return;
   heldSide.current=null;
   clearTimer();
   const id=current.current?.id||++seq.current;
   show({side,mode:'release',id});
   timeout.current=setTimeout(()=>{if(current.current?.id===id&&current.current.mode==='release')show(null)},360);
  }
  function impact(side:Side){
   if(heldSide.current||!armed.current[side]||blocked())return;
   clearTimer();
   armed.current[side]=false;
   const id=++seq.current;
   show({side,mode:'impact',id});
   timeout.current=setTimeout(()=>{if(current.current?.id===id&&current.current.mode==='impact')show(null)},550);
  }
  function touchStart(e:TouchEvent){
   if(e.touches.length!==1||blocked())return;
   started.current={y:e.touches[0].clientY};
  }
  function touchMove(e:TouchEvent){
   if(e.touches.length!==1||!started.current)return;
   const dy=e.touches[0].clientY-started.current.y;
   const edge=edges();
   const side:Side|null=dy>25&&edge.top?'top':dy< -25&&edge.bottom?'bottom':null;
   if(side)hold(side);
   else if(heldSide.current)release();
  }
  function touchStop(){started.current=null;release()}
  function scroll(){
   const now=performance.now(),y=window.scrollY;
   const delta=y-lastScroll.current.y;
   const elapsed=Math.max(16,now-lastScroll.current.at);
   lastScroll.current={y,at:now};
   const e=edges();
   if(!e.top&&y>35)armed.current.top=true;
   if(!e.bottom&&e.bottomGap>35)armed.current.bottom=true;
   if(heldSide.current||started.current)return;
   if(Math.abs(delta)/elapsed<.65)return;
   if(delta<0&&e.top)impact('top');
   else if(delta>0&&e.bottom)impact('bottom');
  }
  lastScroll.current={y:window.scrollY,at:performance.now()};
  window.addEventListener('touchstart',touchStart,{passive:true});
  window.addEventListener('touchmove',touchMove,{passive:true});
  window.addEventListener('touchend',touchStop,{passive:true});
  window.addEventListener('touchcancel',touchStop,{passive:true});
  window.addEventListener('scroll',scroll,{passive:true});
  return ()=>{
   window.removeEventListener('touchstart',touchStart);
   window.removeEventListener('touchmove',touchMove);
   window.removeEventListener('touchend',touchStop);
   window.removeEventListener('touchcancel',touchStop);
   window.removeEventListener('scroll',scroll);
   clearTimer();
  };
 },[]);

 return glow?<div aria-hidden="true" className={'edge-glow edge-glow-'+glow.side+' edge-glow-'+glow.mode}/>:null;
}
