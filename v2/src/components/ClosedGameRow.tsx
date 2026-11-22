import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {ChevronRight,Minus} from 'lucide-react';
type ClosedGame={id:string;title:string;currency:string;stakes:string;started_at:string;status:'live'|'closed'};
export function ClosedGameRow({game,editing,onEdit,onRemove,onOpen}:{
 game:ClosedGame;editing:boolean;onEdit:()=>void;onRemove:()=>void;onOpen:()=>void;
}){
 const hold=useRef<ReturnType<typeof setTimeout>|null>(null);
 const origin=useRef<{x:number;y:number}|null>(null);
 const preventClick=useRef(false);
 const [holding,setHolding]=useState(false);
 function stop(){
  if(hold.current){clearTimeout(hold.current);hold.current=null}
  setHolding(false);origin.current=null;
 }
 useEffect(()=>()=>{if(hold.current)clearTimeout(hold.current)},[]);
 function down(e:PointerEvent<HTMLDivElement>){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  if(editing)return;
  origin.current={x:e.clientX,y:e.clientY};
  setHolding(true);
  hold.current=setTimeout(()=>{
   preventClick.current=true;setHolding(false);hold.current=null;
   if('vibrate'in navigator)navigator.vibrate?.(12);
   onEdit();
  },580);
 }
 function move(e:PointerEvent<HTMLDivElement>){
  if(!origin.current)return;
  if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>12)stop();
 }
 function click(e:React.MouseEvent){
  if(preventClick.current){e.preventDefault();preventClick.current=false;return}
  if(editing){e.preventDefault();return}
  onOpen();
 }
 return <div className={'history-item'+(editing?' wobble-edit':'')+(holding?' holding':'')}
   onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
   onContextMenu={e=>{e.preventDefault();stop();onEdit()}}>
   {editing&&<button type="button" className="history-remove" onClick={e=>{e.stopPropagation();onRemove()}} aria-label={'Remove '+game.title} title="Remove this completed game"><Minus size={15}/></button>}
   <button className="game-row" onClick={click} type="button" aria-label={editing?'Editing '+game.title:'Open '+game.title}>
    <div className="game-icon">♠</div>
    <div className="player-main"><strong>{game.title}</strong><span>{new Date(game.started_at).toLocaleDateString()} · {game.currency} · {game.stakes||'Cash game'}</span></div>
    <span className="live-pill muted"><i/>Closed</span>
    <ChevronRight size={19} color="#787887"/>
   </button>
 </div>;
}
