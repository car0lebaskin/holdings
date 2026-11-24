import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {RotateCcw} from 'lucide-react';

export function SignaturePad({onChange,resetId}:{onChange:(blob:Blob|null)=>void;resetId:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 const drawing=useRef(false);
 const ink=useRef(false);
 const revision=useRef(0);
 const [hasInk,setHasInk]=useState(false);
 const [ready,setReady]=useState(false);

 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const ratio=Math.min(window.devicePixelRatio||1,3);
  const width=Math.max(220,canvas.getBoundingClientRect().width);
  canvas.width=Math.round(width*ratio);
  canvas.height=Math.round(154*ratio);
  const ctx=canvas.getContext('2d');
  if(ctx){
   ctx.setTransform(ratio,0,0,ratio,0,0);
   ctx.strokeStyle='#f5f7ff';ctx.lineWidth=2.4;
   ctx.lineCap='round';ctx.lineJoin='round';
  }
  revision.current++;
  drawing.current=false;ink.current=false;
  setHasInk(false);setReady(false);
 },[resetId]);

 function point(e:PointerEvent<HTMLCanvasElement>){
  const rect=e.currentTarget.getBoundingClientRect();
  return {x:e.clientX-rect.left,y:e.clientY-rect.top};
 }
 function down(e:PointerEvent<HTMLCanvasElement>){
  e.preventDefault();
  const canvas=ref.current,ctx=canvas?.getContext('2d');
  if(!canvas||!ctx)return;
  if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);
  revision.current++;
  drawing.current=true;
  setReady(false);
  onChange(null);
  // The prompt disappears at the FIRST touch, not after asynchronous PNG encoding.
  if(!ink.current){ink.current=true;setHasInk(true)}
  const p=point(e);
  ctx.beginPath();ctx.moveTo(p.x,p.y);
  ctx.lineTo(p.x+0.04,p.y+0.04);ctx.stroke();
 }
 function move(e:PointerEvent<HTMLCanvasElement>){
  if(!drawing.current)return;
  e.preventDefault();
  const ctx=ref.current?.getContext('2d');
  if(!ctx)return;
  const p=point(e);
  ctx.lineTo(p.x,p.y);ctx.stroke();
 }
 function up(e:PointerEvent<HTMLCanvasElement>){
  if(!drawing.current)return;
  e.preventDefault();drawing.current=false;
  const canvas=ref.current;if(!canvas)return;
  const capturedRevision=revision.current;
  canvas.toBlob(blob=>{
   if(revision.current!==capturedRevision)return;
   if(blob){setReady(true);onChange(blob)}
  },'image/png');
  if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
 }
 function clear(){
  revision.current++;
  const canvas=ref.current;
  if(canvas){const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height)}
  drawing.current=false;ink.current=false;
  setHasInk(false);setReady(false);
  onChange(null);
 }
 return <div className="sig-root">
  <div className="sig-frame">
   <canvas aria-label="Sign to acknowledge the amount" ref={ref} className="sig-canvas"
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}/>
   {!hasInk&&<span className="sig-hint">Sign here with your finger</span>}
  </div>
  <div className="sig-footer">
   <span aria-live="polite">{ready?'Signature captured':hasInk?'Finishing signature…':'Signature required'}</span>
   <button type="button" onClick={clear}><RotateCcw size={15}/> Clear</button>
  </div>
 </div>;
}
