import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {RotateCcw} from 'lucide-react';
export function SignaturePad({onChange,resetId}:{onChange:(blob:Blob|null)=>void;resetId:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 const drawing=useRef(false);
 const hasInk=useRef(false);
 const [signed,setSigned]=useState(false);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const width=Math.max(220,canvas.getBoundingClientRect().width);
  const ratio=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(154*ratio);
  const ctx=canvas.getContext('2d');if(ctx){ctx.setTransform(ratio,0,0,ratio,0,0);ctx.strokeStyle='#f5f7ff';ctx.fillStyle='#f5f7ff';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round'}
  drawing.current=false;hasInk.current=false;setSigned(false);
 },[resetId]);
 function point(e:PointerEvent<HTMLCanvasElement>){const rect=e.currentTarget.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top}}
 function down(e:PointerEvent<HTMLCanvasElement>){
  e.preventDefault();const c=ref.current,ctx=c?.getContext('2d');if(!c||!ctx)return;
  c.setPointerCapture(e.pointerId);drawing.current=true;
  if(hasInk.current){onChange(null);setSigned(false)}
  const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.02,p.y+.02);ctx.stroke();hasInk.current=true;
 }
 function move(e:PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;e.preventDefault();const ctx=ref.current?.getContext('2d');if(!ctx)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()}
 function up(e:PointerEvent<HTMLCanvasElement>){
  if(!drawing.current)return;e.preventDefault();drawing.current=false;
  const c=ref.current;if(!c)return;c.toBlob(blob=>{if(blob){setSigned(true);onChange(blob)}},'image/png');
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
 }
 function clear(){const c=ref.current;if(c){const ctx=c.getContext('2d');ctx?.clearRect(0,0,c.width,c.height)}drawing.current=false;hasInk.current=false;setSigned(false);onChange(null)}
 return <div className="sig-root"><div className="sig-frame"><canvas aria-label="Signature pad" ref={ref} className="sig-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} /><span className={'sig-hint '+(signed?'signed':'')}>{signed?'Signature captured':'Sign here with your finger'}</span></div><div className="sig-footer"><span>{signed?'Signed ✓':'Signature required'}</span><button type="button" onClick={clear}><RotateCcw size={15}/> Clear</button></div></div>;
}
