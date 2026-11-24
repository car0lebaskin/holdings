import {useState} from 'react';
import {ChevronDown,TrendingUp} from 'lucide-react';
import {playerPerformance} from '../lib/performance.mjs';

type Night={game:{id:string;title?:string;started_at:string};items:{key:string;name:string;net:number;buyin:number}[]};
type Player={key:string;name:string};

const money=(c:number,currency:string)=>currency+' '+(Math.abs(c)/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const signed=(n:number,currency:string)=>n===0?'Even':(n>0?'+':'−')+money(n,currency);

export function PlayerBreakdown({nights,players,currency}:{nights:Night[];players:Player[];currency:string}){
 const [selected,setSelected]=useState('');
 const [range,setRange]=useState<'all'|'90d'|'30d'>('all');
 const key=players.some(p=>p.key===selected)?selected:players[0]?.key||'';
 const selectedName=players.find(p=>p.key===key)?.name||'Player';
 const info=playerPerformance(nights,key,range,new Date());
 const W=420,H=176;
 const all=info.values;
 const low=Math.min(...all,0),high=Math.max(...all,0),pad=Math.max(1000,(high-low)*.17);
 const min=low-pad,max=high+pad;
 const x=(i:number)=>22+(W-44)*(info.values.length<=1?.5:i/(info.values.length-1));
 const y=(v:number)=>12+(H-36)*(1-(v-min)/(max-min));
 const color=info.net>=0?'#57D4A1':'#F28D81';
 return <div className="player-breakdown">
  <div className="section-head"><h2>Player breakdown</h2><span className="stats-count">Finalized results only</span></div>
  <div className="player-analytics-controls">
   <div className="focus-player-select">
    <select aria-label="Select player for analytics" value={key} onChange={e=>setSelected(e.target.value)}>
     {players.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}
    </select><ChevronDown size={17} aria-hidden="true"/>
   </div>
   <div className="analytics-periods" role="group" aria-label="Analytics period">
    {([{id:'30d',label:'30D'},{id:'90d',label:'90D'},{id:'all',label:'All'}] as const).map(p=>
     <button type="button" key={p.id} className={range===p.id?'on':''} onClick={()=>setRange(p.id)}>{p.label}</button>)}
   </div>
  </div>
  {info.games?<>
   <div className="player-focus-card">
    <div className="focus-net-label">NET RESULTS · {selectedName}</div>
    <div className={'focus-net '+(info.net>=0?'amount-positive':'amount-negative')}>{signed(info.net,currency)}</div>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={selectedName+' cumulative results across '+info.games+' completed games'}>
     <line x1="22" x2={W-22} y1={y(0)} y2={y(0)} stroke="#747a90" strokeDasharray="5 6" strokeWidth="1"/>
     <path d={info.values.map((v:number,i:number)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ')}
      fill="none" stroke={color} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round"/>
     {info.values.map((v:number,i:number)=>
      <circle key={i} cx={x(i)} cy={y(v)} r={i===info.values.length-1?5:2.7} fill={color} stroke="#171921" strokeWidth="1.5">
       <title>{money(v,currency)} · step {i}</title>
      </circle>)}
     <text x="22" y={H-5} fill="#858eaa" fontSize="10">Start</text>
     <text x={W-22} y={H-5} fill="#858eaa" textAnchor="end" fontSize="10">{info.games} games</text>
    </svg>
    <div className="player-kpi-grid">
     <div><small>Sessions</small><strong>{info.games}</strong></div>
     <div><small>Win rate</small><strong>{Math.round(info.winRate*100)}%</strong></div>
     <div><small>Avg / game</small><strong>{signed(info.average,currency)}</strong></div>
     <div><small>Best result</small><strong>{signed(info.best,currency)}</strong></div>
    </div>
   </div>
   <div className="section-head"><h2>Session history</h2><span className="stats-count">{info.games} results</span></div>
   <div className="player-session-history">
    {[...info.sessions].reverse().map((session:{gameId:string;title:string;date:string;net:number})=>
     <div key={session.gameId} className="player-session-row">
      <div><strong>{session.title}</strong><small>{new Date(session.date).toLocaleDateString()}</small></div>
      <strong className={session.net>=0?'amount-positive':'amount-negative'}>{signed(session.net,currency)}</strong>
     </div>)}
   </div>
  </>:<div className="empty-mini"><TrendingUp size={18}/> No completed results for {selectedName} in this period.</div>}
 </div>;
}
