import React, { useEffect, useMemo, useRef, useState } from 'react';
import {SignaturePad} from './components/SignaturePad';
import {calculateSettlement, exportSummary} from './lib/settlement.mjs';
import { createRoot } from 'react-dom/client';
import { createClient, type User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronRight, CircleDollarSign, Copy, Download, FileText, History, Home, ImagePlus, LoaderCircle, Plus, RotateCcw, Share2, ShieldCheck, Smartphone, TrendingUp, Users, Wallet, X } from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl,supabaseKey) : null;

type Game={id:string;owner_id:string;title:string;stakes:string;currency:string;default_buyin_cents:number;status:'live'|'closed';invite_token:string;started_at:string};
type Profile={id:string;owner_id:string;display_name:string;avatar_path:string|null};
type Seat={id:string;game_id:string;profile_id:string;display_name_snapshot:string;created_at:string};
type Ledger={id:string;game_id:string;seat_id:string;owner_id:string;kind:'buyin'|'cashout';amount_cents:number;voided_at:string|null;signature_path:string|null;created_at:string};
type GuestSnapshot={game:{id:string;title:string;stakes:string;currency:string;status:string;started_at:string};players:{seat_id:string;name:string;avatar_path:string|null}[];transactions:{id:string;seat_id:string;kind:'buyin'|'cashout';amount_cents:number;voided:boolean;created_at:string}[]};
type SheetState={kind:'game'|'seat'|'player'|'buyin'|'cashout'|'share'|'ledger'|'export'|'close'|'install'|'none';seatId?:string};
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};

const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'?';
const fmt=(cents:number,currency:string)=>currency+' '+(cents/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const short=(token:string)=>token.slice(0,8).toUpperCase();
const errMsg=(e:unknown)=>e instanceof Error?e.message:String(e);
const toCents=(input:string)=>{const n=Number(input);if(!Number.isFinite(n)||n<0||Math.round(n*100)!==n*100 && Math.abs(Math.round(n*100)-n*100)>0.00001)return null;return Math.round(n*100)};
function avatarUrl(path:string|null){if(!db||!path)return '';return db.storage.from('holdings-avatars').getPublicUrl(path).data.publicUrl;}
function Avatar({name,path,onClick}: {name:string;path?:string|null;onClick?:()=>void}){
 const src=avatarUrl(path||null);return <button className={'avatar '+(onClick?'avatar-edit':'')} type="button" title={onClick?'Change player photo':name} onClick={onClick} disabled={!onClick}><span>{initials(name)}</span>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>}{onClick&&<span className="avatar-camera"><Camera size={10}/></span>}</button>;
}
const pool=(transactions:{seat_id:string;kind:string;amount_cents:number;voided?:boolean;voided_at?:string|null}[])=>{
 const live=transactions.filter(t=>!(t.voided||t.voided_at));
 const ins=live.filter(x=>x.kind==='buyin').reduce((n,x)=>n+Number(x.amount_cents),0);
 const outs=live.filter(x=>x.kind==='cashout').reduce((n,x)=>n+Number(x.amount_cents),0);
 return {ins,outs,onTable:ins-outs,live};
};
function App(){
 const [user,setUser]=useState<User|null>(null);
 const [initializing,setInitializing]=useState(true);
 const [email,setEmail]=useState('');
 const [emailSent,setEmailSent]=useState(false);
 const [games,setGames]=useState<Game[]>([]);
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [game,setGame]=useState<Game|null>(null);
 const [seats,setSeats]=useState<Seat[]>([]);
 const [ledger,setLedger]=useState<Ledger[]>([]);
 const [guest,setGuest]=useState<GuestSnapshot|null>(null);
 const [guestToken,setGuestToken]=useState('');
 const [demoMode,setDemoMode]=useState(false);
 const [section,setSection]=useState<'home'|'stats'|'history'>('home');
 const [tab,setTab]=useState<'table'|'cashout'|'settle'>('table');
 const [sheet,setSheet]=useState<SheetState>({kind:'none'});
 const [loading,setLoading]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [title,setTitle]=useState('Friday cash game');
 const [stakes,setStakes]=useState('1 / 2');
 const [currency,setCurrency]=useState('RM');
 const [buyin,setBuyin]=useState('100');
 const [playerName,setPlayerName]=useState('');
 const [selectedProfile,setSelectedProfile]=useState('');
 const [amount,setAmount]=useState('');
 const [signatureBlob,setSignatureBlob]=useState<Blob|null>(null);
 const [signatureUrls,setSignatureUrls]=useState<Record<string,string>>({});
 const [dragX,setDragX]=useState(0);
 const [swipeDir,setSwipeDir]=useState<'left'|'right'>('left');
 const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null);
 const [standalone,setStandalone]=useState(false);
 const [imageProfile,setImageProfile]=useState<Profile|null>(null);
 const photoRef=useRef<HTMLInputElement>(null);
 const touchPoint=useRef<{x:number;y:number}|null>(null);
 const busy=useRef(false);
 const isGuest=!!guest;
 const active=!!game||isGuest;
 const curr=game?.currency||guest?.game.currency||'RM';
 const activeSeats=isGuest?(guest?.players||[]).map(p=>({id:p.seat_id,display_name_snapshot:p.name,profile_id:'',game_id:'',created_at:'',avatar_path:p.avatar_path})):seats.map(s=>({...s,avatar_path:profiles.find(p=>p.id===s.profile_id)?.avatar_path||null}));
 const currentLedger=isGuest?(guest?.transactions||[]):ledger;
 const sums=useMemo(()=>pool(currentLedger),[currentLedger]);
 const settlement=calculateSettlement(activeSeats,currentLedger);
 const summaryText=exportSummary({title:game?.title||guest?.game.title||'Game',currency:curr,stakes:game?.stakes||guest?.game.stakes||'',status:game?.status||guest?.game.status||'live',started_at:game?.started_at||guest?.game.started_at||new Date().toISOString()},settlement);
 const noticeNow=(msg:string)=>{setNotice(msg);setTimeout(()=>setNotice(''),2500)};
 const fail=(e:unknown)=>{setError(errMsg(e));setLoading(false)};

 useEffect(()=>{
  if(!db){setInitializing(false);return}
  db.auth.getUser().then(({data})=>{setUser(data.user);setInitializing(false)}).catch(()=>setInitializing(false));
  const {data:sub}=db.auth.onAuthStateChange((_event,session)=>setUser(session?.user||null));
  return ()=>sub.subscription.unsubscribe();
 },[]);
 useEffect(()=>{const match=location.hash.match(/^#join=([a-f0-9]{36})$/);if(match)setGuestToken(match[1]);},[]);
 useEffect(()=>{if(user){void refreshHome()}},[user?.id]);
 useEffect(()=>{if(guestToken){void openGuest(guestToken)}},[guestToken]);
 useEffect(()=>{if(!guestToken)return;const interval=setInterval(()=>{if(!document.hidden)void refreshGuest(guestToken)},10000);return()=>clearInterval(interval)},[guestToken]);

 useEffect(()=>{
   const check=()=>setStandalone(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator & {standalone?:boolean}).standalone===true);
   check();const onPrompt=(event:Event)=>{event.preventDefault();setInstallEvent(event as InstallEvent)};
   const onInstalled=()=>{setInstallEvent(null);check()};
   window.addEventListener('beforeinstallprompt',onPrompt);
   window.addEventListener('appinstalled',onInstalled);
   return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)};
  },[]);

 function startDemo(){
  const now=new Date().toISOString();
  setDemoMode(true);setGuestToken('');setGame(null);setTab('table');
  setGuest({game:{id:'preview',title:'Friday Cash Game',stakes:'1 / 2',currency:'RM',status:'live',started_at:now},
    players:[{seat_id:'p1',name:'Alex Chen',avatar_path:null},{seat_id:'p2',name:'Jamie Lee',avatar_path:null},{seat_id:'p3',name:'Sam Tan',avatar_path:null},{seat_id:'p4',name:'Taylor Wong',avatar_path:null}],
    transactions:[{id:'t1',seat_id:'p1',kind:'buyin',amount_cents:50000,voided:false,created_at:now},{id:'t2',seat_id:'p1',kind:'buyin',amount_cents:50000,voided:false,created_at:now},{id:'t3',seat_id:'p2',kind:'buyin',amount_cents:50000,voided:false,created_at:now},{id:'t4',seat_id:'p3',kind:'buyin',amount_cents:100000,voided:false,created_at:now},{id:'t5',seat_id:'p3',kind:'cashout',amount_cents:130000,voided:false,created_at:now},{id:'t6',seat_id:'p4',kind:'buyin',amount_cents:50000,voided:false,created_at:now}]});
  setError('');
 }
 async function refreshHome(){
  if(!db||!user)return;
  try{
   const [g,p]=await Promise.all([db.from('holdings_games').select('*').eq('owner_id',user.id).order('started_at',{ascending:false}),db.from('holdings_profiles').select('*').eq('owner_id',user.id).order('display_name')]);
   if(g.error)throw g.error;if(p.error)throw p.error;
   setGames(g.data as Game[]);setProfiles(p.data as Profile[]);
  }catch(e){setError(errMsg(e))}
 }
 async function openGame(item:Game){
  if(!db||!user)return;
  setGuest(null);setGuestToken('');history.replaceState(null,'',location.pathname);
  setGame(item);setTab('table');setLoading(true);setError('');
  try{
   const [s,l]=await Promise.all([db.from('holdings_seats').select('*').eq('game_id',item.id).order('created_at'),db.from('holdings_ledger').select('*').eq('game_id',item.id).order('created_at')]);
   if(s.error)throw s.error;if(l.error)throw l.error;setSeats(s.data as Seat[]);setLedger(l.data as Ledger[]);
  }catch(e){fail(e)}finally{setLoading(false)}
 }
 async function refreshGuest(token:string){
  if(!db)return;const {data,error:e}=await db.rpc('holdings_guest_snapshot',{p_invite_token:token});
  if(e)throw e;if(!data)throw new Error('Invite not found or no longer valid');setGuest(data as GuestSnapshot);
 }
 async function openGuest(token:string){
  if(!db)return;setDemoMode(false);setError('');setLoading(true);setGame(null);setGuest(null);setTab('table');
  try{await refreshGuest(token)}catch(e){fail(e)}finally{setLoading(false)}
 }
 async function createGame(){
  if(!db||!user||busy.current)return;
  const cents=toCents(buyin);if(cents===null){setError('Use a valid buy-in amount');return}
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_games').insert({owner_id:user.id,title:title.trim()||'Cash game',stakes:stakes.trim(),currency:currency.trim()||'RM',default_buyin_cents:cents}).select('*').single();
   if(e)throw e;setSheet({kind:'none'});await refreshHome();await openGame(data as Game);noticeNow('Table created');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 async function makeProfile(){
  if(!db||!user||busy.current)return;
  if(!playerName.trim())return;
  busy.current=true;setLoading(true);
  try{
   const {data,error:e}=await db.from('holdings_profiles').insert({owner_id:user.id,display_name:playerName.trim()}).select('*').single();
   if(e)throw e;setProfiles(prev=>[...prev,data as Profile]);setSelectedProfile(data.id);setPlayerName('');setSheet({kind:'seat'});noticeNow('Player profile saved');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 async function seatPlayer(){
  if(!db||!game||!selectedProfile||busy.current)return;
  const profile=profiles.find(p=>p.id===selectedProfile);if(!profile)return;
  busy.current=true;setLoading(true);
  try{
   const {data,error:e}=await db.from('holdings_seats').insert({game_id:game.id,profile_id:profile.id,display_name_snapshot:profile.display_name}).select('*').single();
   if(e)throw e;setSeats(s=>[...s,data as Seat]);setSheet({kind:'none'});setSelectedProfile('');noticeNow('Player seated');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 async function addTransaction(kind:'buyin'|'cashout',seatId:string){
  if(!db||!game||!user||busy.current)return;
  const cents=toCents(amount);
  if(cents===null||(kind==='buyin'&&cents===0)){setError('Enter a valid amount');return}
  if(!signatureBlob){setError('Player signature is required');return}
  if(game.status==='closed'){setError('This game is closed');return}
  const hasCashout=ledger.some(x=>x.seat_id===seatId&&x.kind==='cashout'&&!x.voided_at);
  const hasBuyin=ledger.some(x=>x.seat_id===seatId&&x.kind==='buyin'&&!x.voided_at);
  if(hasCashout){setError('This player has already cashed out');return}
  if(kind==='cashout'&&!hasBuyin){setError('Record a buy-in before cash-out');return}
  busy.current=true;setLoading(true);setError('');
  const id=crypto.randomUUID();
  const signaturePath=user.id+'/'+game.id+'/'+id+'.png';
  let uploaded=false;
  try{
   const upload=await db.storage.from('holdings-signatures').upload(signaturePath,signatureBlob,{contentType:'image/png'});
   if(upload.error)throw upload.error;
   uploaded=true;
   const {data,error:e}=await db.from('holdings_ledger').insert({id,owner_id:user.id,game_id:game.id,seat_id:seatId,kind,amount_cents:cents,signature_path:signaturePath,client_operation_id:id}).select('*').single();
   if(e)throw e;
   setLedger(l=>[...l,data as Ledger]);setSheet({kind:'none'});setAmount('');setSignatureBlob(null);
   noticeNow(kind==='buyin'?'Signed buy-in recorded':'Signed cash-out recorded');
  }catch(e){if(uploaded)await db.storage.from('holdings-signatures').remove([signaturePath]);fail(e)}
  finally{busy.current=false;setLoading(false)}
 }
 async function openLedger(seatId:string){
  if(!db)return;
  setSheet({kind:'ledger',seatId});setError('');
  const signed=ledger.filter(x=>x.seat_id===seatId&&x.signature_path);
  const urls=await Promise.all(signed.map(async t=>{
   const {data}=await db.storage.from('holdings-signatures').createSignedUrl(t.signature_path!,3600);
   return {id:t.id,url:data?.signedUrl||''};
  }));
  setSignatureUrls(prev=>({...prev,...Object.fromEntries(urls.map(x=>[x.id,x.url]))}));
 }
 async function voidTransaction(tx:Ledger){
  if(!db||!game||busy.current||game.status==='closed')return;
  if(!window.confirm('Void this '+(tx.kind==='buyin'?'buy-in':'cash-out')+'? The signed entry stays in the audit trail.'))return;
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_ledger').update({voided_at:new Date().toISOString()}).eq('id',tx.id).eq('game_id',game.id).is('voided_at',null).select('*').single();
   if(e)throw e;
   setLedger(prev=>prev.map(t=>t.id===tx.id?data as Ledger:t));noticeNow(tx.kind==='cashout'?'Cash-out voided; recount available':'Buy-in voided');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 async function closeGame(){
  if(!db||!game||busy.current)return;
  if(!settlement.ready){setError('Cash out every player and reconcile the bank before closing');return}
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_games').update({status:'closed'}).eq('id',game.id).eq('status','live').select('*').single();
   if(e)throw e;
   setGame(data as Game);setGames(prev=>prev.map(g=>g.id===data.id?data as Game:g));
   setSheet({kind:'export'});setTab('settle');noticeNow('Game closed; results saved to history');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 function downloadSummary(){
  const file=new Blob([summaryText],{type:'text/plain;charset=utf-8'});
  const link=URL.createObjectURL(file);const anchor=document.createElement('a');anchor.href=link;
  anchor.download='Holdings-'+(game?.title||guest?.game.title||'Game').replace(/[^a-z0-9]+/gi,'-')+'-summary.txt';
  document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(link);
 }
 function openTransaction(kind:'buyin'|'cashout',seatId:string){
  setSignatureBlob(null);
  setAmount(kind==='buyin'?String((game?.default_buyin_cents||10000)/100):'');
  setSheet({kind,seatId});
 }
 function changeTab(next:'table'|'cashout'|'settle'){
  if(next===tab)return;
  const order=['table','cashout','settle'];
  setSwipeDir(order.indexOf(next)>order.indexOf(tab)?'left':'right');
  setTab(next);
 }
 function onSwipeStart(e:React.TouchEvent){
  if((e.target as HTMLElement).closest('button,input,textarea,select,canvas,.sheet,[data-noswipe]'))return;
  const p=e.touches[0];touchPoint.current={x:p.clientX,y:p.clientY};
 }
 function onSwipeMove(e:React.TouchEvent){
  const start=touchPoint.current;if(!start)return;
  const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
  if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.35)setDragX(Math.max(-90,Math.min(90,dx*.5)));
 }
 function onSwipeEnd(e:React.TouchEvent){
  const start=touchPoint.current;touchPoint.current=null;
  setDragX(0);if(!start)return;
  const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
  if(Math.abs(dx)<65||Math.abs(dx)<=Math.abs(dy)*1.35)return;
  const tabs:['table','cashout','settle']=['table','cashout','settle'];
  const next=Math.max(0,Math.min(2,tabs.indexOf(tab)+(dx<0?1:-1)));
  changeTab(tabs[next]);
 }
 async function requestInstall(){
  if(installEvent){await installEvent.prompt();const choice=await installEvent.userChoice;if(choice.outcome==='accepted')setInstallEvent(null)}
  else setSheet({kind:'install'});
 }
 async function uploadAvatar(file:File){
  if(!db||!user||!imageProfile)return;
  setLoading(true);setError('');
  try{
   if(!file.type.startsWith('image/'))throw new Error('Select an image');
   const compressed=await compressImage(file);
   const path=user.id+'/'+imageProfile.id+'/'+Date.now()+'.webp';
   const uploaded=await db.storage.from('holdings-avatars').upload(path,compressed,{contentType:'image/webp'});
   if(uploaded.error)throw uploaded.error;
   const updated=await db.from('holdings_profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',imageProfile.id).eq('owner_id',user.id).select('*').single();
   if(updated.error)throw updated.error;
   setProfiles(p=>p.map(x=>x.id===imageProfile.id?updated.data as Profile:x));noticeNow('Photo updated');
  }catch(e){fail(e)}finally{setLoading(false);setImageProfile(null);if(photoRef.current)photoRef.current.value=''}
 }
 async function share(){
  if(!game)return;
  const url=new URL(location.origin+location.pathname);url.hash='join='+game.invite_token;
  const msg='Join my Holdings table: '+game.title;
  try{if(navigator.share)await navigator.share({title:'Holdings',text:msg,url:url.toString()});
  else {await navigator.clipboard.writeText(msg+'\n'+url.toString());noticeNow('Invite link copied')}}
  catch(e){if((e as Error).name!=='AbortError')fail(e)}
 }
 function goHome(){setDemoMode(false);setGame(null);setGuest(null);setGuestToken('');history.replaceState(null,'',location.pathname);setSheet({kind:'none'});setTab('table');if(user)void refreshHome()}
 const seatBalances=activeSeats.map(s=>{const tx=sums.live.filter(t=>t.seat_id===s.id);const total=tx.filter(t=>t.kind==='buyin').reduce((n,t)=>n+Number(t.amount_cents),0);const cashout=tx.filter(t=>t.kind==='cashout').reduce((n,t)=>n+Number(t.amount_cents),0);return {...s,total,cashout,hasCashout:tx.some(t=>t.kind==='cashout'),count:tx.filter(t=>t.kind==='buyin').length}});
 const closed=game?.status==='closed'||guest?.game.status==='closed';
 const titleText=game?.title||guest?.game.title||'';
 const avatarProfile=(s:typeof seatBalances[number])=>profiles.find(p=>p.id===s.profile_id)||null;

 return <><div className="app-shell">
  <header className="header"><div className="brand"><div className="brand-symbol">♠</div><span>Holdings</span></div><span className="header-meta">{active?'TABLE LEDGER':'PRIVATE POKER LEDGER'}</span></header>
  {!db?<section className="empty-frame"><ShieldCheck size={32}/><h2>Preview configuration required</h2><p>Add Supabase project URL and publishable key in Vercel project environment variables.</p></section>:
  initializing?<div className="loading-line"><LoaderCircle size={20} className="spin"/> Starting Holdings…</div>:
  active?<>
   <div className="topline"><button className="text-link" onClick={goHome}><ArrowLeft size={18}/> All games</button><div className="right-actions"><span className={'live-pill '+(closed?'muted':'')}><i/>{closed?'Closed':'Live'}</span>{game&&<button className="icon-control" title="Share table" onClick={()=>setSheet({kind:'share'})}><Share2 size={19}/></button>}</div></div>
   <div className="page-title"><div className="eyebrow">{isGuest?'YOU ARE VIEWING':'CURRENT GAME'}</div><h1>{titleText}</h1><p>{game?.stakes||guest?.game.stakes||'Cash game'} · {curr}{isGuest?' · Read only':''}</p></div>
   <section className="hero"><div className="eyebrow blue-label">TOTAL BUY-INS</div><div className="hero-amount"><span>{curr}</span>{(sums.ins/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div className="hero-grid"><div><small>Chips in play</small><strong>{fmt(sums.onTable,curr)}</strong></div><div><small>Paid out</small><strong>{fmt(sums.outs,curr)}</strong></div><div><small>Players</small><strong>{activeSeats.length}</strong></div></div></section>
   <div className="segmented" role="tablist" aria-label="Table sections">{(['table','cashout','settle'] as const).map(t=><button type="button" role="tab" aria-selected={tab===t} className={tab===t?'selected':''} onClick={()=>changeTab(t)} key={t}>{t==='table'?'Table':t==='cashout'?'Cash out':'Settle'}</button>)}</div>
   <main onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}
    onTouchCancel={()=>{touchPoint.current=null;setDragX(0)}} className="tab-content"
    style={{transform:'translate3d('+dragX+'px,0,0)',transition:dragX?'none':'transform .18s ease-out'}}>
    <div key={tab} className={'tab-panel tab-from-'+swipeDir}>
    {tab==='table'?<>
     <div className="section-head"><h2>Players <span>{activeSeats.length}</span></h2>{game&&!closed&&<button className="small-action" onClick={()=>setSheet({kind:'seat'})}><Plus size={16}/> Add player</button>}</div>
     {!activeSeats.length&&<div className="empty-frame"><Users size={32}/><h3>No players seated</h3><p>Add the first player to start tracking this table.</p></div>}
     {seatBalances.map(s=><article className="player-row" key={s.id}>
       <Avatar name={s.display_name_snapshot} path={s.avatar_path} onClick={game&&!closed?()=>{const p=avatarProfile(s);if(p){setImageProfile(p);setSheet({kind:'player',seatId:s.id})}}:undefined}/>
       <div className="player-main"><strong>{s.display_name_snapshot}</strong>
        <span>{s.count?fmt(s.total,curr)+' · '+s.count+' buy-in'+(s.count>1?'s':''):'No buy-ins yet'}</span>
        {game&&<button className="ledger-link" onClick={()=>void openLedger(s.id)}>Signed ledger <ChevronRight size={13}/></button>}
       </div>
       <div className="player-side">
        {s.hasCashout?<span className="mini-status paid">Cashed out</span>:s.count?<span className="mini-status">Playing</span>:<span className="mini-status quiet">Seated</span>}
        {game&&!closed&&!s.hasCashout&&<button className="row-arrow" title="Record buy-in" aria-label={'Record buy-in for '+s.display_name_snapshot} onClick={()=>openTransaction('buyin',s.id)}><Plus size={19}/></button>}
       </div>
      </article>)}
     {game&&!closed&&<button className="primary-btn add-transaction" onClick={()=>setSheet({kind:'seat'})}><Plus size={19}/> Seat player</button>}
     {isGuest&&<div className="info-note"><ShieldCheck size={17}/>{demoMode?'Demo preview: sample data only. No changes are saved.':'Guest access is read only. The host controls all changes.'}</div>}
    </>:tab==='cashout'?<>
     <div className="section-head"><h2>Cash out</h2></div>
     {seatBalances.filter(s=>s.total>0).map(s=><article className="player-row" key={s.id}>
       <Avatar name={s.display_name_snapshot} path={s.avatar_path}/>
       <div className="player-main"><strong>{s.display_name_snapshot}</strong><span>In for {fmt(s.total,curr)}</span>
        {game&&<button className="ledger-link" onClick={()=>void openLedger(s.id)}>Signed ledger <ChevronRight size={13}/></button>}
       </div>
       {s.hasCashout?<div className="cashout-result"><strong className={s.cashout-s.total>=0?'amount-positive':'amount-negative'}>{s.cashout-s.total>=0?'+':'−'}{fmt(Math.abs(s.cashout-s.total),curr)}</strong>
          {game&&!closed&&<button className="recount-action" onClick={()=>{const tx=ledger.find(x=>x.seat_id===s.id&&x.kind==='cashout'&&!x.voided_at);if(tx)void voidTransaction(tx)}}><RotateCcw size={13}/> Recount</button>}</div>
        :game&&!closed?<button className="outline-btn" onClick={()=>openTransaction('cashout',s.id)}>Cash out</button>:<span className="mini-status quiet">In play</span>}
      </article>)}
     {!seatBalances.some(s=>s.total>0)&&<div className="empty-frame"><Wallet size={30}/><p>Cash-outs become available after the first buy-in.</p></div>}
    </>:<>
      <div className="section-head"><h2>Bank overview</h2></div>
      <div className="summary-card">
       <div><span>Total buy-ins</span><strong>{fmt(settlement.totalBuyin,curr)}</strong></div>
       <div><span>Total cash-outs</span><strong>{fmt(settlement.totalCashout,curr)}</strong></div>
       <div><span>Bank difference</span><strong className={settlement.discrepancy===0?'amount-positive':'amount-negative'}>{settlement.discrepancy>0?'+':''}{fmt(settlement.discrepancy,curr)}</strong></div>
       <div><span>Players cashed out</span><strong>{settlement.cashedOutCount}/{settlement.participants.length}</strong></div>
      </div>
      {!settlement.allOut?<div className="info-note"><ShieldCheck size={17}/> Settlement unlocks when every player with a buy-in has cashed out. {settlement.cashedOutCount} of {settlement.participants.length} complete.</div>:
       <>
        <div className="section-head"><h2>Player results</h2></div>
        {settlement.players.filter(p=>p.buyin>0).sort((a,b)=>(b.net??0)-(a.net??0)).map(s=>
         <article className="result-row" key={s.id}><span>{s.name}</span>
          <strong className={(s.net??0)>0?'amount-positive':(s.net??0)<0?'amount-negative':''}>{s.net===0?'Even':(s.net??0)>0?'+':'−'}{s.net===0?'':fmt(Math.abs(s.net||0),curr)}</strong>
         </article>)}
        <div className="section-head"><h2>Who pays whom</h2></div>
        {!settlement.transfers.length?<div className="empty-mini">No transfers needed.</div>:settlement.transfers.map((t,i)=>
          <div key={i} className="transfer-row"><div><strong>{t.from}</strong><span>pays</span><strong>{t.to}</strong></div><b>{fmt(t.amount,curr)}</b></div>)}
        {settlement.discrepancy!==0&&<div className="reconcile-warning">Bank is {fmt(Math.abs(settlement.discrepancy),curr)} {settlement.discrepancy>0?'overpaid':'short'}. Transfers cannot fully reconcile until stacks are corrected.</div>}
        <button className="primary-btn" onClick={()=>setSheet({kind:'export'})}><FileText size={18}/> Export session summary</button>
        {game&&game.status==='live'&&<button className="outline-wide" disabled={!settlement.ready||loading} onClick={()=>setSheet({kind:'close'})}><Check size={18}/> Close game</button>}
        {game&&game.status==='closed'&&<div className="info-note"><Check size={17}/> Game closed. Results are saved in History.</div>}
       </>}

    </>}
    </div></main>
  </>:!user?<div className="auth-view"><div className="intro-label">YOUR PRIVATE LEDGER</div><h1>Every chip.<br/>Accounted for.</h1><p>A cleaner way to run your home game. Record buy-ins, track results and let friends watch live.</p><form onSubmit={async e=>{e.preventDefault();if(!db)return;setLoading(true);setError('');const {error:e2}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});setLoading(false);if(e2)setError(e2.message);else setEmailSent(true)}}><label>Email address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/><button className="primary-btn" disabled={loading}>{loading?'Sending…':emailSent?'Send another login link':'Sign in with email'} <ArrowRight size={17}/></button>{emailSent&&<div className="info-note"><Check size={17}/> Check your email for a secure sign-in link.</div>}</form><button className="outline-wide" type="button" onClick={startDemo}>Explore demo without signing in <ArrowRight size={17}/></button><p className="muted-detail">Demo uses sample data. Your existing Holdings records are not affected.</p></div>:
  <><div className="welcome"><div className="eyebrow">YOUR PRIVATE LEDGER</div><h1>Good evening.</h1><p>Every buy-in signed. Every chip accounted for.</p></div><section className="overview-card"><div className="eyebrow blue-label">YOUR GAMES</div><strong>{games.length}</strong><p>{games.filter(x=>x.status==='live').length} live · {games.filter(x=>x.status==='closed').length} completed</p></section><div className="section-head"><h2>{section==='home'?'Your tables':section==='stats'?'Player overview':'Game history'}</h2>{section==='home'&&<button className="small-action" onClick={()=>setSheet({kind:'game'})}><Plus size={16}/> New game</button>}</div>
   {(section==='home'?games.filter(x=>x.status==='live'):section==='history'?games.filter(x=>x.status==='closed'):[]).map(x=><button className="game-row" key={x.id} onClick={()=>void openGame(x)}><div className="game-icon">♠</div><div className="player-main"><strong>{x.title}</strong><span>{new Date(x.started_at).toLocaleDateString()} · {x.currency} · {x.stakes||'Cash game'}</span></div><span className={'live-pill '+(x.status==='closed'?'muted':'')}><i/>{x.status==='closed'?'Closed':'Live'}</span><ChevronRight size={19} color="#787887"/></button>)}
   {section==='stats'&&<div className="empty-frame"><TrendingUp size={32}/><h3>Player insights</h3><p>{profiles.length} saved player profiles. Historical player analytics will be unlocked after the ledger migration is validated.</p></div>}
   {section!=='stats'&&!games.some(x=>section==='home'?x.status==='live':x.status==='closed')&&<div className="empty-frame"><CircleDollarSign size={32}/><h3>{section==='home'?'Ready for the next game?':'No completed games yet'}</h3><p>{section==='home'?'Open your first Holdings table.':'Finished games appear here.'}</p></div>}
   <nav className="bottom-nav" aria-label="Main navigation"><button className={section==='home'?'on':''} onClick={()=>setSection('home')}><Home size={22}/> Home</button><button className={section==='stats'?'on':''} onClick={()=>setSection('stats')}><TrendingUp size={22}/> Stats</button><button className={section==='history'?'on':''} onClick={()=>setSection('history')}><History size={22}/> History</button></nav>
  </>}
  {error&&<div role="alert" className="error-banner"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={18}/></button></div>}
  {notice&&<div className="toast"><Check size={18}/>{notice}</div>}
  {loading&&<div className="busy-badge"><LoaderCircle className="spin" size={16}/> Saving…</div>}
  </div>
  {sheet.kind!=='none'&&<div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSheet({kind:'none'});setError('')}}}><div className="sheet" role="dialog" aria-modal="true"><div className="sheet-grab"/><div className="sheet-head"><h2>{sheet.kind==='game'?'New table':sheet.kind==='seat'?'Seat a player':sheet.kind==='player'?'Player photo':sheet.kind==='share'?'Invite players':sheet.kind==='buyin'?'Record buy-in':'Cash out'}</h2><button className="icon-control" onClick={()=>{setSheet({kind:'none'});setError('')}} aria-label="Close"><X size={20}/></button></div>
   {sheet.kind==='game'&&<form onSubmit={e=>{e.preventDefault();void createGame()}}><label>Table name</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100}/><div className="form-grid"><div><label>Stakes</label><input value={stakes} onChange={e=>setStakes(e.target.value)}/></div><div><label>Currency</label><input value={currency} onChange={e=>setCurrency(e.target.value)} maxLength={4}/></div></div><label>Standard buy-in</label><input type="number" min="0" step="0.01" value={buyin} onChange={e=>setBuyin(e.target.value)}/><button className="primary-btn" disabled={loading}>Create table <ArrowRight size={18}/></button></form>}
   {sheet.kind==='seat'&&<><label>Choose existing player</label><select value={selectedProfile} onChange={e=>setSelectedProfile(e.target.value)}><option value="">Select player</option>{profiles.filter(p=>!seats.some(s=>s.profile_id===p.id)).map(p=><option value={p.id} key={p.id}>{p.display_name}</option>)}</select><button className="primary-btn" disabled={!selectedProfile||loading} onClick={()=>void seatPlayer()}>Seat selected player</button><div className="sheet-divider">or create a new profile</div><label>New player name</label><input value={playerName} maxLength={100} onChange={e=>setPlayerName(e.target.value)} placeholder="Player name"/><button className="outline-wide" disabled={!playerName.trim()||loading} onClick={()=>void makeProfile()}><Plus size={17}/> Save player profile</button></>}
   {sheet.kind==='player'&&<><p className="subtle-copy">Change {imageProfile?.display_name}'s profile photo. Pictures follow the player into future games.</p><input ref={photoRef} type="file" accept="image/*" capture={undefined} className="hidden-input" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadAvatar(f)}}/><button className="menu-row" onClick={()=>photoRef.current?.click()}><ImagePlus size={22}/> Choose photo <ChevronRight size={18}/></button><button className="menu-row" onClick={()=>{if(photoRef.current){photoRef.current.setAttribute('capture','environment');photoRef.current.click();photoRef.current.removeAttribute('capture')}}}><Camera size={22}/> Take photo <ChevronRight size={18}/></button></>}
   {sheet.kind==='share'&&<><p className="subtle-copy">Send a read-only invitation. Friends can view the table without an account or access to your backend settings.</p><div className="invite-code">{game?short(game.invite_token):''}</div><button className="primary-btn" onClick={()=>void share()}><Share2 size={18}/> Share invite</button><button className="outline-wide" onClick={async()=>{if(!game)return;const u=new URL(location.origin+location.pathname);u.hash='join='+game.invite_token;await navigator.clipboard.writeText(u.toString());noticeNow('Link copied')}}><Copy size={18}/> Copy link</button></>}
   {(sheet.kind==='buyin'||sheet.kind==='cashout')&&<form onSubmit={e=>{e.preventDefault();void addTransaction(sheet.kind as 'buyin'|'cashout',sheet.seatId||'')}}><p className="subtle-copy">{seats.find(s=>s.id===sheet.seatId)?.display_name_snapshot||''}</p><label>Amount ({curr})</label><input className="amount-input" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/><p className="subtle-copy caution">Preview limitation: signature capture and final ledger settlement auditing are not yet implemented. Do not use this build for real game settlement.</p><button disabled={loading} className="primary-btn">Record {sheet.kind==='buyin'?'buy-in':'cash-out'} <Check size={18}/></button></form>}
  </div></div>}
 </>;
}
async function compressImage(file:File):Promise<Blob>{
 const src=await createImageBitmap(file);try{
  const canvas=document.createElement('canvas');const ratio=Math.min(1,512/Math.max(src.width,src.height));
  canvas.width=Math.round(src.width*ratio);canvas.height=Math.round(src.height*ratio);
  const context=canvas.getContext('2d');if(!context)throw new Error('Image processing unavailable');context.drawImage(src,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.78));if(!blob)throw new Error('Unable to process photo');if(blob.size>1048576)throw new Error('Photo is too large');return blob;
 }finally{src.close()}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
