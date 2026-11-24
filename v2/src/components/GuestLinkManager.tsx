import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Copy,Link2,ShieldCheck,Trash2,LoaderCircle} from 'lucide-react';
type Seat={id:string;display_name_snapshot:string};
type Link={id:string;token:string;seat_id:string;expires_at:string;revoked_at:string|null;created_at:string};
export function GuestLinkManager({db,ownerId,gameId,seats}:{db:SupabaseClient;ownerId:string;gameId:string;seats:Seat[]}){
 const [links,setLinks]=useState<Link[]>([]);
 const [seatId,setSeatId]=useState('');
 const [days,setDays]=useState('7');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [created,setCreated]=useState('');
 async function load(){
  const {data,error:e}=await db.from('holdings_guest_links').select('id,token,seat_id,expires_at,revoked_at,created_at')
    .eq('game_id',gameId).order('created_at',{ascending:false});
  if(e)throw e;setLinks((data||[]) as Link[]);
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[gameId]);
 const buildLink=(token:string)=>{const link=new URL(location.origin+location.pathname);link.hash='join='+token;return link.toString()};
 async function copy(token:string){
  try{await navigator.clipboard.writeText(buildLink(token));setMessage('Player-specific invite copied')}
  catch(e){setError(e instanceof Error?e.message:'Unable to copy link')}
 }
 async function create(){
  if(!seatId||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const expiresAt=new Date(Date.now()+Number(days)*86400000).toISOString();
   const {data,error:e}=await db.from('holdings_guest_links').insert({
    owner_id:ownerId,game_id:gameId,seat_id:seatId,expires_at:expiresAt
   }).select('id,token,seat_id,expires_at,revoked_at,created_at').single();
   if(e)throw e;
   setCreated(data.token);await load();await copy(data.token);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function revoke(link:Link){
  if(busy||link.revoked_at)return;
  if(!window.confirm('Revoke this personal link? It will stop working immediately.'))return;
  setBusy(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_guest_links').update({revoked_at:new Date().toISOString()})
    .eq('id',link.id).eq('owner_id',ownerId).is('revoked_at',null).select('id').single();
   if(e)throw e;if(!data)throw new Error('Could not revoke this invite');
   await load();setMessage('Invite revoked');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const active=links.filter(l=>!l.revoked_at&&new Date(l.expires_at).getTime()>Date.now());
 return <div className="guest-link-manager">
  <div className="section-head"><h2>Personal invites</h2><ShieldCheck size={17} color="#8aaaff"/></div>
  <p className="subtle-copy">A personal invite shows only the selected player's buy-ins and results. Link holders are not identity-verified.</p>
  <label>Player</label>
  <select value={seatId} onChange={e=>setSeatId(e.target.value)}>
   <option value="">Choose player</option>{seats.map(p=><option key={p.id} value={p.id}>{p.display_name_snapshot}</option>)}
  </select>
  <label>Expiry</label>
  <select value={days} onChange={e=>setDays(e.target.value)}>
   <option value="1">24 hours</option><option value="7">7 days</option><option value="30">30 days</option>
  </select>
  <button type="button" className="outline-wide" disabled={!seatId||busy}
   onClick={()=>void create()}>{busy?<LoaderCircle className="spin" size={17}/>:<Link2 size={17}/>} Create &amp; copy personal link</button>
  {created&&<button type="button" className="small-action" onClick={()=>void copy(created)}><Copy size={15}/> Copy latest invite again</button>}
  {active.length>0&&<div className="guest-links-existing">
    <div className="eyebrow">ACTIVE PERSONAL LINKS</div>
    {active.map(link=><div key={link.id} className="guest-link-row">
     <div><strong>{seats.find(s=>s.id===link.seat_id)?.display_name_snapshot||'Player'}</strong>
      <small>Expires {new Date(link.expires_at).toLocaleDateString()}</small></div>
     <button type="button" aria-label="Copy invite" onClick={()=>void copy(link.token)}><Copy size={16}/></button>
     <button type="button" className="revoke-link" aria-label="Revoke invite" onClick={()=>void revoke(link)}><Trash2 size={16}/></button>
    </div>)}
   </div>}
  {message&&<p role="status" className="backup-feedback">{message}</p>}
  {error&&<p role="alert" className="backup-error">{error}</p>}
 </div>;
}
