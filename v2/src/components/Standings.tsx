import {TrendingUp} from 'lucide-react';
import {calculateSettlement} from '../lib/settlement.mjs';

type Game={id:string;status:string;started_at:string;currency:string};
type Seat={id:string;game_id:string;profile_id:string;display_name_snapshot:string};
type Txn={game_id:string;seat_id:string;kind:string;amount_cents:number;voided_at?:string|null};
type Standing={key:string;name:string;currency:string;net:number;games:number;wins:number};
const COLORS=['#75A1FF','#3FD98B','#F7BD56','#B18BFF','#FF8C94'];
const money=(c:number,cur:string)=>cur+' '+(Math.abs(c)/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
export function Standings({games,seats,transactions,loading=false}:{games:Game[];seats:Seat[];transactions:Txn[];loading?:boolean}){
 const closed=[...games].filter(g=>g.status==='closed').sort((a,b)=>a.started_at.localeCompare(b.started_at));
 const byCurrency=new Map<string,{game:Game;items:{key:string;name:string;net:number}[]}[]>();
 for(const game of closed){
  const local=seats.filter(s=>s.game_id===game.id);
  const tx=transactions.filter(t=>t.game_id===game.id);
  const result=calculateSettlement(local,tx);
  const items=result.players.filter((p:{buyin:number;net:number|null})=>p.buyin>0&&p.net!==null).map((p:{id:string;name:string;net:number})=>{
   const s=local.find(s=>s.id===p.id);return {key:s?.profile_id||p.id,name:p.name,net:p.net};
  });
  const current=byCurrency.get(game.currency)||[];current.push({game,items});byCurrency.set(game.currency,current);
 }
 if(loading)return <div className="empty-frame"><TrendingUp size={29}/><p>Loading lifetime standings…</p></div>;
 if(!closed.length)return <div className="empty-frame"><TrendingUp size={29}/><h3>No standings yet</h3><p>Close a reconciled game to add player profits and losses here.</p></div>;
 return <div className="standings-page">
  {[...byCurrency.entries()].map(([currency,nights])=>{
   const totals=new Map<string,Standing>();
   for(const n of nights)for(const p of n.items){
    const prev=totals.get(p.key)||{key:p.key,name:p.name,currency,net:0,games:0,wins:0};
    prev.net+=p.net;prev.games++;if(p.net>0)prev.wins++;totals.set(p.key,prev);
   }
   const sorted=[...totals.values()].sort((a,b)=>b.net-a.net);
   const chartNames=sorted.slice(0,5);
   const series=chartNames.map((p,i)=>{
    let cum=0;const values=nights.map(n=>{cum+=(n.items.find(row=>row.key===p.key)?.net||0);return cum});
    return {name:p.name,color:COLORS[i%COLORS.length],values,net:p.net};
   });
   const all=series.flatMap(s=>s.values).concat([0]);
   const low=Math.min(...all),high=Math.max(...all),pad=Math.max(1000,(high-low)*.15);
   const min=low-pad,max=high+pad;
   const W=520,H=180;
   const px=(i:number)=>14+(W-28)*(nights.length===1?.5:i/(nights.length-1));
   const py=(v:number)=>14+(H-28)*(1-(v-min)/(max-min));
   return <section key={currency}>
     <div className="section-head"><h2>{currency} standings</h2><span className="stats-count">{nights.length} closed games</span></div>
     {nights.length>=2&&<div className="standings-chart">
      <div className="eyebrow blue-label">CUMULATIVE PROFIT</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Player profit and loss across finished games" preserveAspectRatio="xMidYMid meet">
       <line x1="14" x2={W-14} y1={py(0)} y2={py(0)} stroke="#646674" strokeDasharray="4 6" strokeWidth="1"/>
       {series.map(s=><g key={s.name}><path d={s.values.map((v,i)=>(i?'L':'M')+px(i).toFixed(1)+' '+py(v).toFixed(1)).join(' ')} stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx={px(s.values.length-1)} cy={py(s.values.at(-1)||0)} r="4.5" fill={s.color}/></g>)}
      </svg>
      <div className="stats-legend">{series.map(s=><span key={s.name}><i style={{backgroundColor:s.color}}/>{s.name}</span>)}</div>
     </div>}
     <div className="standings-list">{sorted.map((p,i)=><div className="standing-row" key={p.key}>
      <span className="standing-rank">{i+1}</span>
      <div><strong>{p.name}</strong><small>{p.games} game{p.games!==1?'s':''} · {p.wins} win{p.wins!==1?'s':''}</small></div>
      <strong className={p.net>0?'amount-positive':p.net<0?'amount-negative':''}>{p.net===0?'Even':(p.net>0?'+':'−')+money(p.net,currency)}</strong>
     </div>)}</div>
   </section>;
  })}
 </div>;
}
