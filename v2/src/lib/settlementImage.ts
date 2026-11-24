export type SummaryGame={title:string;currency:string;stakes:string;started_at:string;status:string};
export type SummaryResult={players:{name:string;buyin:number;cashout:number|null;net:number|null}[];transfers:{from:string;to:string;amount:number}[];totalBuyin:number;totalCashout:number;discrepancy:number;ready:boolean};
const fmt=(v:number,currency:string)=>currency+' '+(Math.abs(v)/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const truncate=(ctx:CanvasRenderingContext2D,text:string,max:number)=>{
 if(ctx.measureText(text).width<=max)return text;
 let out=text;while(out.length>1&&ctx.measureText(out+'…').width>max)out=out.slice(0,-1);return out+'…';
};
export async function makeSettlementImage(game:SummaryGame,summary:SummaryResult):Promise<Blob>{
 if(!summary.ready||game.status!=='closed')throw new Error('Only closed, reconciled games can be shared as final settlement');
 const players=summary.players.filter(p=>p.buyin>0).sort((a,b)=>(b.net??0)-(a.net??0));
 const transfers=summary.transfers;
 const W=440;const H=388+players.length*56+Math.max(1,transfers.length)*43+76;
 const scale=2;
 const canvas=document.createElement('canvas');canvas.width=W*scale;canvas.height=H*scale;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas export not available');
 ctx.scale(scale,scale);
 ctx.fillStyle='#0B0D13';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#20243A';ctx.fillRect(0,0,W,8);
 ctx.fillStyle='#759CFF';ctx.fillRect(0,0,75,8);
 const text=(s:string,x:number,y:number,font:string,color:string,align:CanvasTextAlign='left')=>{
  ctx.textAlign=align;ctx.font=font;ctx.fillStyle=color;ctx.fillText(s,x,y);ctx.textAlign='left';
 };
 text('HOLDINGS',25,41,'800 14px Arial','#83A9FF');
 text('FINAL SETTLEMENT',W-25,41,'700 10px Arial','#A4AABC','right');
 text(truncate(ctx,game.title,390),25,89,'800 28px Arial','#F6F7FB');
 text(new Date(game.started_at).toLocaleDateString()+'  •  '+(game.stakes||'Cash game'),25,115,'14px Arial','#A0A8BD');
 ctx.fillStyle='#181E30';ctx.beginPath();ctx.roundRect(22,137,W-44,119,20);ctx.fill();
 text('BANK RECONCILED',40,167,'700 11px Arial','#A3B9F6');
 text(fmt(summary.totalBuyin,game.currency),40,209,'800 31px Arial','#F7F8FF');
 text('Total buy-ins',40,236,'13px Arial','#A8AEC2');
 text('Difference '+fmt(summary.discrepancy,game.currency),W-40,236,'12px Arial','#51D5A2','right');
 let y=293;
 text('PLAYER RESULTS',25,y,'800 12px Arial','#95A7DB');y+=27;
 for(const p of players){
  const net=p.net??0;
  text(truncate(ctx,p.name,190),25,y,'600 16px Arial','#EDF0F8');
  text(net===0?'Even':(net>0?'+':'−')+fmt(net,game.currency),W-25,y,'700 15px Arial',net>0?'#62D9A7':net<0?'#FF988C':'#D1D6E5','right');
  text(truncate(ctx,'In '+fmt(p.buyin,game.currency)+'   •   Out '+fmt(p.cashout??0,game.currency),390),25,y+20,'12px Arial','#A3AFC7');
  y+=56;
 }
 y+=10;
 ctx.strokeStyle='#313748';ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(W-25,y);ctx.stroke();
 y+=29;
 text('WHO PAYS WHOM',25,y,'800 12px Arial','#95A7DB');y+=29;
 if(!transfers.length){text('No transfers required',25,y,'15px Arial','#BBC3D5');y+=43}
 for(const t of transfers){
  text(truncate(ctx,t.from+'  →  '+t.to,232),25,y,'600 14px Arial','#F0F3FB');
  text(fmt(t.amount,game.currency),W-25,y,'700 14px Arial','#DCE6FF','right');
  y+=43;
 }
 const footY=H-36;
 ctx.strokeStyle='#303749';ctx.beginPath();ctx.moveTo(25,footY-24);ctx.lineTo(W-25,footY-24);ctx.stroke();
 text('CLOSED • VERIFIED LEDGER TOTALS',25,footY,'700 10px Arial','#A2ADCA');
 text('Holdings',W-25,footY,'700 11px Arial','#82A1F9','right');
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to render settlement image')),'image/png'));
}
