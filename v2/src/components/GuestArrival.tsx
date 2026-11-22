import {ArrowLeft,ArrowRight,ChevronRight,ShieldCheck,Users} from 'lucide-react';
import {guestPlayerTotals} from '../lib/guestTotals.mjs';

type GuestSnapshot={
 game:{id:string;title:string;stakes:string;currency:string;status:string;started_at:string};
 players:{seat_id:string;name:string;avatar_path:string|null}[];
 transactions:{id:string;seat_id:string;kind:'buyin'|'cashout';amount_cents:number;voided:boolean;created_at:string}[];
};
type Props={
 snapshot:GuestSnapshot;
 selectedSeat:string;
 onSelect:(seatId:string)=>void;
 onViewTable:()=>void;
 resolveAvatar:(path:string|null)=>string;
 demo:boolean;
 scoped:boolean;
};
const money=(cents:number,currency:string)=>currency+' '+(cents/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const initials=(s:string)=>s.trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'?';

export function GuestArrival({snapshot,selectedSeat,onSelect,onViewTable,resolveAvatar,demo,scoped}:Props){
 const p=guestPlayerTotals(snapshot,selectedSeat);
 const currency=snapshot.game.currency;
 const isClosed=snapshot.game.status==='closed';
 return <div className="guest-arrival">
  <div className="guest-game-top">
   <div className="eyebrow">HOLDINGS · GUEST ACCESS</div>
   <span className={'live-pill '+(isClosed?'muted':'')}><i/>{isClosed?'Closed':'Live table'}</span>
  </div>
  <h1 className="guest-game-title">{snapshot.game.title}</h1>
  <p className="guest-game-sub">{snapshot.game.stakes||'Cash game'} · {currency} · Read only</p>
  {!p?<>
   <div className="guest-welcome-title">Find your seat.</div>
   <p className="guest-intro">Select your name to see your total buy-ins first.</p>
   {snapshot.players.length===0&&<div className="empty-frame"><Users size={30}/><h3>No players seated yet</h3><p>Open this invite again after the host adds the players.</p></div>}
   <div className="guest-people">
    {snapshot.players.map(person=>{
     const src=resolveAvatar(person.avatar_path);
     return <button key={person.seat_id} type="button" className="guest-person" onClick={()=>onSelect(person.seat_id)}>
      <span className="guest-person-avatar">{initials(person.name)}{src&&<img alt="" src={src} loading="lazy"/>}</span>
      <span>{person.name}</span>
      <ChevronRight size={20} aria-hidden="true"/>
     </button>;
    })}
   </div>
  </>:<>
   {!scoped&&<button className="guest-back" type="button" onClick={()=>onSelect('')}><ArrowLeft size={17}/> Change player</button>}
   <div className="guest-person-heading">
    <span className="guest-person-avatar guest-person-avatar-large">{initials(p.name)}{resolveAvatar(p.avatar_path)&&<img alt="" src={resolveAvatar(p.avatar_path)} loading="lazy"/>}</span>
    <div><div className="eyebrow">YOUR TABLE SUMMARY</div><h2>{p.name}</h2></div>
   </div>
   <div className="guest-personal-total">
    <div className="eyebrow blue-label">YOUR TOTAL BUY-INS</div>
    <div className="guest-buyin-amount">{money(p.totalBuyin,currency)}</div>
    <div className="guest-summary-grid">
     <div><small>Buy-in entries</small><strong>{p.buyinCount}</strong></div>
     <div><small>Cash-out</small><strong>{p.hasCashout?money(p.totalCashout,currency):'Not yet'}</strong></div>
    </div>
   </div>
   {p.net!==null&&<div className="guest-net-result">
    <div><span>Net result</span><small>{isClosed?'Final':'Provisional until the game closes'}</small></div>
    <strong className={p.net>=0?'amount-positive':'amount-negative'}>{p.net>0?'+':''}{money(p.net,currency)}</strong>
   </div>}
   <div className="section-head"><h2>Your activity <span>{p.entries.length}</span></h2></div>
   {p.entries.length===0?<div className="empty-mini">No buy-ins recorded for this player yet.</div>:
    <div className="guest-activity">
     {p.entries.map(t=><div key={t.id} className="guest-activity-row">
      <div><strong>{t.kind==='buyin'?'Buy-in':'Cash-out'}</strong><small>{new Date(t.created_at).toLocaleString()}</small></div>
      <b>{money(t.amount_cents,currency)}</b>
     </div>)}
    </div>}
  </>}
  {p&&!scoped&&<button className="primary-btn guest-view-table" onClick={onViewTable} type="button">
    View full table <ArrowRight size={18}/>
  </button>}
  <div className="info-note"><ShieldCheck size={17}/>{demo?'Demo values are illustrative and cannot be changed.':'Choosing a name personalizes the display; it does not verify identity. Guests cannot edit the table.'}</div>
 </div>;
}
