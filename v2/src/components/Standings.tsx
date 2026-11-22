import {TrendingUp} from 'lucide-react';
import {calculateSettlement} from '../lib/settlement.mjs';
import {PlayerBreakdown} from './PlayerBreakdown';

type Game={id:string;title?:string;status:string;started_at:string;currency:string};
type Seat={id:string;game_id:string;profile_id:string;display_name_snapshot:string};
type Txn={game_id:string;seat_id:string;kind:string;amount_cents:number;voided_at?:string|null;created_at?:string};
type Standing={key:string;name:string;net:number;games:number;wins:number};
type GraphSeries={name:string;color:string;values:number[]};
const COLORS=['#75A1FF','#3FD98B','#F7BD56','#B18BFF','#FF8C94'];
const money=(c:number,cur:string)=>cur+' '+(Math.abs(c)/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});

function PerformanceGraph({series,currency,ariaLabel,caption}:{series:GraphSeries[];currency:string;ariaLabel:string;caption:string}){
 const W=520,H=212,L=26,R=18,T=14,B=30;
 const values=[0,...series.flatMap(s=>s.values)];
 const low=Math.min(...values),high=Math.max(...values);
 const buffer=Math.max(1000,(high-low)*0.14);
 const min=low-buffer,max=high+buffer;
 const span=Math.max(1,...series.map(s=>s.values.length-1));
 const x=(i:number)=>L+(W-L-R)*i/span;
 const y=(v:number)=>T+(H-T-B)*(1-(v-min)/(max-min));
 return <div className="standings-chart">
  <div className="chart-label-row"><span className="eyebrow blue-label">{ariaLabel}</span><span className="chart-caption">{caption}</span></div>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel+' in '+currency} preserveAspectRatio="xMidYMid meet">
   {[0,0.5,1].map(t=>{
    const yy=T+(H-T-B)*t;
    return <line key={t} x1={L} x2={W-R} y1={yy} y2={yy} stroke="#3c4255" strokeWidth="1" strokeDasharray="3 7"/>;
   })}
   <line x1={L} x2={W-R} y1={y(0)} y2={y(0)} stroke="#9299ae" strokeWidth="1.2" strokeDasharray="5 6"/>
   <text x={L} y={H-8} fill="#949bad" fontSize="11">Start</text>
   <text x={W-R} y={H-8} fill="#949bad" textAnchor="end" fontSize="11">{span} {span===1?'entry':'entries'}</text>
   {series.map(s=><g key={s.name}>
    <path d={s.values.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ')}
     stroke={s.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {s.values.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r={i===s.values.length-1?5:2.7}
      fill={s.color} stroke="#171921" strokeWidth="1.5"><title>{s.name} · {money(v,currency)} · step {i}</title></circle>)}
   </g>)}
  </svg>
  <div className="stats-legend">{series.map(s=><span key={s.name}><i style={{backgroundColor:s.color}}/>{s.name}<strong>{s.values.at(-1)===0?'Even':(s.values.at(-1)??0)>0?'+':'−'}{(s.values.at(-1)??0)===0?'':money(s.values.at(-1)||0,currency)}</strong></span>)}</div>
 </div>;
}

export function Standings({games,seats,transactions,loading=false}:{games:Game[];seats:Seat[];transactions:Txn[];loading?:boolean}){
 const closed=[...games].filter(g=>g.status==='closed').sort((a,b)=>a.started_at.localeCompare(b.started_at));
 const live=[...games].filter(g=>g.status==='live').sort((a,b)=>b.started_at.localeCompare(a.started_at));
 if(loading)return <div className="empty-frame"><TrendingUp size={29}/><p>Loading player performance…</p></div>;
 if(!games.length)return <div className="empty-frame"><TrendingUp size={29}/><h3>No games recorded</h3><p>Graphs and lifetime P&L will appear as your tables accumulate results.</p></div>;

 const byCurrency=new Map<string,{game:Game;items:{key:string;name:string;net:number;buyin:number}[]}[]>();
 for(const game of closed){
  const local=seats.filter(s=>s.game_id===game.id);
  const tx=transactions.filter(t=>t.game_id===game.id);
  const result=calculateSettlement(local,tx);
  const items=result.players.filter((p:{buyin:number;net:number|null})=>p.buyin>0&&p.net!==null).map((p:{id:string;name:string;net:number;buyin:number})=>{
   const seat=local.find(s=>s.id===p.id);
   return {key:seat?.profile_id||p.id,name:p.name,net:p.net,buyin:p.buyin};
  });
  const current=byCurrency.get(game.currency)||[];
  current.push({game,items});byCurrency.set(game.currency,current);
 }
 return <div className="standings-page">
  <div className="stats-overview">
   <div><span>Completed</span><strong>{closed.length}</strong></div>
   <div><span>Active</span><strong>{live.length}</strong></div>
   <div><span>Players</span><strong>{new Set(seats.map(s=>s.profile_id)).size}</strong></div>
  </div>

  {[...byCurrency.entries()].map(([currency,nights])=>{
   const totals=new Map<string,Standing>();
   for(const night of nights)for(const p of night.items){
    const prev=totals.get(p.key)||{key:p.key,name:p.name,net:0,games:0,wins:0};
    prev.net+=p.net;prev.games++;if(p.net>0)prev.wins++;totals.set(p.key,prev);
   }
   const sorted=[...totals.values()].sort((a,b)=>b.net-a.net);
   const series:GraphSeries[]=sorted.slice(0,5).map((p,i)=>{
    let cumulative=0;
    const values=[0,...nights.map(n=>{
     cumulative+=n.items.find(row=>row.key===p.key)?.net||0;
     return cumulative;
    })];
    return {name:p.name,color:COLORS[i%COLORS.length],values};
   });
   return <section key={currency}>
    <div className="section-head"><h2>{currency} lifetime P&L</h2><span className="stats-count">{nights.length} completed</span></div>
    {series.length>0?<PerformanceGraph series={series} currency={currency} ariaLabel="CUMULATIVE PROFIT" caption={nights.length===1?'First result':'Completed games'}/>:
     <p className="subtle-copy">The completed sessions contain no cash-out results yet.</p>}
    <div className="standings-list">{sorted.map((p,i)=><div className="standing-row" key={p.key}>
     <span className="standing-rank">{i+1}</span>
     <div><strong>{p.name}</strong><small>{p.games} game{p.games!==1?'s':''} · {p.wins} win{p.wins!==1?'s':''}</small></div>
     <strong className={p.net>0?'amount-positive':p.net<0?'amount-negative':''}>
      {p.net===0?'Even':(p.net>0?'+':'−')+money(p.net,currency)}
     </strong>
    </div>)}</div>
    {sorted.length>0&&<PlayerBreakdown currency={currency} nights={nights} players={sorted.map(p=>({key:p.key,name:p.name}))}/>}
   </section>;
  })}

  {live.map(game=>{
   const local=seats.filter(s=>s.game_id===game.id);
   const tx=transactions.filter(t=>t.game_id===game.id&&!t.voided_at)
     .sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
   let buyins=0,cashouts=0;
   const bought=[0],paid=[0];
   for(const t of tx){
    if(t.kind==='buyin')buyins+=Number(t.amount_cents);
    if(t.kind==='cashout')cashouts+=Number(t.amount_cents);
    bought.push(buyins);paid.push(cashouts);
   }
   const result=calculateSettlement(local,tx);
   const paidPlayers=result.players.filter((p:{buyin:number;cashedOut:boolean})=>p.buyin>0&&p.cashedOut);
   return <section key={'live-'+game.id}>
    <div className="section-head"><h2>{game.title||'Live table'}</h2><span className="stats-count">Live · provisional</span></div>
    <PerformanceGraph series={[
     {name:'Total buy-ins',color:COLORS[0],values:bought.length>1?bought:[0,0]},
     {name:'Cash-outs paid',color:COLORS[1],values:paid.length>1?paid:[0,0]}
    ]} currency={game.currency} ariaLabel="LIVE TABLE CASH FLOW" caption="Unsettled · not P&L"/>
    <div className="summary-card">
     <div><span>Buy-ins recorded</span><strong>{money(buyins,game.currency)}</strong></div>
     <div><span>Paid out</span><strong>{money(cashouts,game.currency)}</strong></div>
     <div><span>Players cashed out</span><strong>{paidPlayers.length}/{result.participants.length}</strong></div>
    </div>
    {paidPlayers.length>0&&<>
     <div className="section-head"><h2>Provisional player results</h2></div>
     {paidPlayers.map((p:{id:string;name:string;net:number|null})=>
      <div className="standing-row" key={p.id}><div><strong>{p.name}</strong><small>Cashed out · not finalized</small></div>
       <strong className={(p.net||0)>=0?'amount-positive':'amount-negative'}>{p.net===0?'Even':(p.net||0)>0?'+':'−'}{p.net===0?'':money(p.net||0,game.currency)}</strong>
      </div>)}
    </>}
   </section>;
  })}
  {!closed.length&&<div className="info-note stats-info"><TrendingUp size={17}/> Lifetime profit and loss is calculated from closed, reconciled games. The graph above shows live bank activity until those results become final.</div>}
 </div>;
}
