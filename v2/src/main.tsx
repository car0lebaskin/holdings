import React, { useEffect, useMemo, useRef, useState } from 'react';
import {SignaturePad} from './components/SignaturePad';
import {Standings} from './components/Standings';
import {Greeting} from './components/Greeting';
import {ClosedGameRow} from './components/ClosedGameRow';
import {EdgeGlow} from './components/EdgeGlow';
import {GuestArrival} from './components/GuestArrival';
import {BackupRecovery} from './components/BackupRecovery';
import {GuestLinkManager} from './components/GuestLinkManager';
import {ProfileEditor} from './components/ProfileEditor';
import {makeSettlementImage} from './lib/settlementImage';
import {savePending,listPending,deletePending,updatePendingError,type QueuedSignedTransaction} from './lib/offlineQueue';
import {calculateSettlement, exportSummary} from './lib/settlement.mjs';
import { createRoot } from 'react-dom/client';
import { createClient, type User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronRight, CircleDollarSign, Copy, Download, FileText, History, Home, ImagePlus, LoaderCircle, Plus, RotateCcw, ChevronDown, Trash2, Share2, ShieldCheck, Smartphone, TrendingUp, Users, Wallet, X } from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl,supabaseKey) : null;

type Game={id:string;owner_id:string;title:string;stakes:string;currency:string;default_buyin_cents:number;status:'live'|'closed';invite_token:string;started_at:string;deleted_at:string|null};
type Profile={id:string;owner_id:string;display_name:string;avatar_path:string|null;archived_at?:string|null};
type Seat={id:string;game_id:string;profile_id:string;display_name_snapshot:string;created_at:string};
type Ledger={id:string;game_id:string;seat_id:string;owner_id:string;kind:'buyin'|'cashout';amount_cents:number;voided_at:string|null;signature_path:string|null;created_at:string};
type GuestSnapshot={scope?:'table'|'player';game:{id:string;title:string;stakes:string;currency:string;status:string;started_at:string};players:{seat_id:string;name:string;avatar_path:string|null}[];transactions:{id:string;seat_id:string;kind:'buyin'|'cashout';amount_cents:number;voided:boolean;created_at:string}[]};
type SheetState={kind:'game'|'seat'|'player'|'buyin'|'cashout'|'share'|'ledger'|'export'|'close'|'install'|'remove'|'void'|'none';seatId?:string;gameId?:string;txnId?:string};
type Correction={id:string;transaction_id:string;reason:string;created_at:string};
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
type SettledPlayer={id:string;name:string;buyin:number;cashout:number|null;net:number|null;cashedOut:boolean;count:number};

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
 const [statSeats,setStatSeats]=useState<Seat[]>([]);
 const [statLedger,setStatLedger]=useState<Ledger[]>([]);
 const [statsLoading,setStatsLoading]=useState(false);
 const [syncMode,setSyncMode]=useState<'live'|'fallback'|'offline'>('fallback');
 const [game,setGame]=useState<Game|null>(null);
 const [seats,setSeats]=useState<Seat[]>([]);
 const [ledger,setLedger]=useState<Ledger[]>([]);
 const [guest,setGuest]=useState<GuestSnapshot|null>(null);
 const [guestToken,setGuestToken]=useState('');
 const [guestSelectedSeat,setGuestSelectedSeat]=useState('');
 const [guestShowTable,setGuestShowTable]=useState(false);
 const [demoMode,setDemoMode]=useState(false);
 const [section,setSection]=useState<'home'|'stats'|'history'>('home');
 const [homeDragX,setHomeDragX]=useState(0);
 const [homeSwipeDir,setHomeSwipeDir]=useState<'left'|'right'>('left');
 const [historyEditing,setHistoryEditing]=useState(false);
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
 const [corrections,setCorrections]=useState<Correction[]>([]);
 const [voidReason,setVoidReason]=useState('');
 const [pendingOps,setPendingOps]=useState<QueuedSignedTransaction[]>([]);
 const [queueBusy,setQueueBusy]=useState(false);
 const [backupOpen,setBackupOpen]=useState(false);
 const [profilesOpen,setProfilesOpen]=useState(false);
 const [manageSeatProfiles,setManageSeatProfiles]=useState(false);
 const [dragX,setDragX]=useState(0);
 const [swipeDir,setSwipeDir]=useState<'left'|'right'>('left');
 const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null);
 const [standalone,setStandalone]=useState(false);
 const [imageProfile,setImageProfile]=useState<Profile|null>(null);
 const photoRef=useRef<HTMLInputElement>(null);
 const touchPoint=useRef<{x:number;y:number}|null>(null);
 const homeTouch=useRef<{x:number;y:number}|null>(null);
 const homeSwipeConsumed=useRef(false);
 const busy=useRef(false);
 const syncingRef=useRef(false);
 const seatOpRef=useRef<string|null>(null);
 const isGuest=!!guest;
 const active=!!game||isGuest;
 const curr=game?.currency||guest?.game.currency||'RM';
 const activeSeats=isGuest?(guest?.players||[]).map(p=>({id:p.seat_id,display_name_snapshot:p.name,profile_id:'',game_id:'',created_at:'',avatar_path:p.avatar_path})):seats.map(s=>({...s,avatar_path:profiles.find(p=>p.id===s.profile_id)?.avatar_path||null}));
 const visibleGames=games.filter(g=>!g.deleted_at);
 const liveGames=visibleGames.filter(g=>g.status==='live');
 const closedGames=visibleGames.filter(g=>g.status==='closed');
 const removedGames=games.filter(g=>!!g.deleted_at&&g.status==='closed');
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
 useEffect(()=>{
  if(!db||!guestToken||demoMode)return;
  let active=true;
  const token=guestToken;
  let lastRefresh=0;
  const refresh=()=>{
   const now=Date.now();
   if(!active||document.hidden||now-lastRefresh<1500)return;
   lastRefresh=now;
   void refreshGuest(token).catch(e=>{if(active){setError(errMsg(e));setSyncMode('fallback')}});
  };
  const channel=db.channel('holdings:game:'+token,{config:{private:false}})
   .on('broadcast',{event:'refresh'},refresh)
   .subscribe(status=>{
    if(!active)return;
    if(status==='SUBSCRIBED'){setSyncMode('live');refresh()}
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setSyncMode('fallback');
   });
  const fallback=window.setInterval(refresh,45000);
  const onVisibility=()=>{if(!document.hidden)refresh()};
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('focus',refresh);
  return ()=>{active=false;window.clearInterval(fallback);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('focus',refresh);void db.removeChannel(channel)};
 },[guestToken,demoMode]);

 useEffect(()=>{
  if(!db||!user?.id||!game?.id||demoMode)return;
  let active=true;
  const gameId=game.id;
  let pending:number|undefined;
  const refresh=async()=>{
   try{
    const [g,s,l]=await Promise.all([
     db.from('holdings_games').select('*').eq('id',gameId).single(),
     db.from('holdings_seats').select('*').eq('game_id',gameId).order('created_at'),
     db.from('holdings_ledger').select('*').eq('game_id',gameId).order('created_at')
    ]);
    if(g.error)throw g.error;if(s.error)throw s.error;if(l.error)throw l.error;
    if(!active)return;
    setGame(prev=>prev?.id===gameId?g.data as Game:prev);
    setSeats(s.data as Seat[]);setLedger(l.data as Ledger[]);
   }catch(e){if(active)setSyncMode('fallback')}
  };
  const refreshSoon=()=>{
   if(pending)clearTimeout(pending);
   pending=window.setTimeout(()=>{void refresh()},120);
  };
  const channel=db.channel('holdings:host:'+gameId)
   .on('postgres_changes',{event:'*',schema:'public',table:'holdings_seats',filter:'game_id=eq.'+gameId},refreshSoon)
   .on('postgres_changes',{event:'*',schema:'public',table:'holdings_ledger',filter:'game_id=eq.'+gameId},refreshSoon)
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'holdings_games',filter:'id=eq.'+gameId},refreshSoon)
   .subscribe(status=>{
    if(!active)return;
    if(status==='SUBSCRIBED')setSyncMode('live');
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')setSyncMode('fallback');
   });
  const fallback=window.setInterval(()=>{if(!document.hidden)void refresh()},60000);
  const onVisibility=()=>{if(!document.hidden)void refresh()};
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('focus',onVisibility);
  return ()=>{
   active=false;if(pending)clearTimeout(pending);window.clearInterval(fallback);
   document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('focus',onVisibility);
   void db.removeChannel(channel);
  };
 },[user?.id,game?.id,demoMode]);

 useEffect(()=>{
  if(!user?.id||!game?.id||demoMode){setPendingOps([]);return}
  let active=true;
  void listPending(user.id,game.id).then(ops=>{if(active)setPendingOps(ops)}).catch(e=>{if(active)setError(errMsg(e))});
  const onOnline=()=>{void flushPending()};
  window.addEventListener('online',onOnline);
  if(navigator.onLine)void flushPending();
  return()=>{active=false;window.removeEventListener('online',onOnline)}
 },[user?.id,game?.id,demoMode]);

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
  setDemoMode(true);setGuestToken('');setGame(null);setTab('table');setGuestSelectedSeat('');setGuestShowTable(false);
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
   void refreshStats((g.data as Game[]).filter(game=>!game.deleted_at));
  }catch(e){setError(errMsg(e))}
 }
 async function refreshStats(closed:Game[]){
  if(!db||!user)return;
  const ids=closed.map(g=>g.id);if(!ids.length){setStatSeats([]);setStatLedger([]);setStatsLoading(false);return}
  setStatsLoading(true);
  try{
   const [s,t]=await Promise.all([
    db.from('holdings_seats').select('id,game_id,profile_id,display_name_snapshot').in('game_id',ids),
    db.from('holdings_ledger').select('game_id,seat_id,kind,amount_cents,voided_at,created_at').in('game_id',ids)
   ]);
   if(s.error)throw s.error;if(t.error)throw t.error;
   setStatSeats(s.data as Seat[]);setStatLedger(t.data as Ledger[]);
  }catch(e){setError(errMsg(e))}finally{setStatsLoading(false)}
 }
 async function removeClosedGame(id:string){
   if(!db||!user||busy.current)return;
   const target=games.find(g=>g.id===id);
   if(!target||target.status!=='closed'||target.deleted_at){setError('Only completed games can be removed');return}
   busy.current=true;setLoading(true);setError('');
   try{
    const {data,error:e}=await db.from('holdings_games')
      .update({deleted_at:new Date().toISOString()})
      .eq('id',id).eq('owner_id',user.id).eq('status','closed').is('deleted_at',null).select('*').single();
    if(e)throw e;
    setGames(prev=>prev.map(g=>g.id===id?data as Game:g));
    setHistoryEditing(false);setSheet({kind:'none'});
    void refreshHome();noticeNow('Removed from History. You can restore it below.');
   }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 async function restoreClosedGame(id:string){
   if(!db||!user||busy.current)return;
   busy.current=true;setLoading(true);setError('');
   try{
    const {data,error:e}=await db.from('holdings_games')
      .update({deleted_at:null})
      .eq('id',id).eq('owner_id',user.id).eq('status','closed').not('deleted_at','is',null).select('*').single();
    if(e)throw e;
    setGames(prev=>prev.map(g=>g.id===id?data as Game:g));
    void refreshHome();noticeNow('Game restored to History');
   }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 function changeHomeSection(next:'home'|'stats'|'history'){
  if(next===section)return;
  const order:['home','stats','history']=['home','stats','history'];
  setHomeSwipeDir(order.indexOf(next)>order.indexOf(section)?'left':'right');
  setHistoryEditing(false);setSection(next);
  window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});
 }
 function onHomeTouchStart(e:React.TouchEvent){
   if((e.target as HTMLElement).closest('input,textarea,select,canvas,.sheet,[role="dialog"]'))return;
   const p=e.touches[0];if(p)homeTouch.current={x:p.clientX,y:p.clientY};
 }
 function onHomeTouchMove(e:React.TouchEvent){
   const p=e.touches[0],start=homeTouch.current;if(!p||!start)return;
   const dx=p.clientX-start.x,dy=p.clientY-start.y;
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4)setHomeDragX(Math.max(-75,Math.min(75,dx*.42)));
 }
 function onHomeTouchEnd(e:React.TouchEvent){
   const start=homeTouch.current;homeTouch.current=null;setHomeDragX(0);
   if(!start)return;
   const p=e.changedTouches[0],dx=p.clientX-start.x,dy=p.clientY-start.y;
   if(Math.abs(dx)<66||Math.abs(dx)<Math.abs(dy)*1.4)return;
   const order:['home','stats','history']=['home','stats','history'];
   const next=order[Math.max(0,Math.min(2,order.indexOf(section)+(dx<0?1:-1)))];
   if(next===section)return;
   homeSwipeConsumed.current=true;
   window.setTimeout(()=>{homeSwipeConsumed.current=false},320);
   changeHomeSection(next);
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
  if(e)throw e;if(!data){setGuest(null);throw new Error('Invite not found or no longer valid')}setGuest(data as GuestSnapshot);
   if((data as GuestSnapshot).scope==='player'&&(data as GuestSnapshot).players.length===1){setGuestSelectedSeat((data as GuestSnapshot).players[0].seat_id);setGuestShowTable(false)}
 }
 async function openGuest(token:string){
  if(!db)return;setDemoMode(false);setError('');setLoading(true);setGame(null);setGuest(null);setTab('table');setGuestSelectedSeat('');setGuestShowTable(false);
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
 function openSeatSheet(){
  setManageSeatProfiles(false);
  seatOpRef.current=null;
  setPlayerName('');
  setSelectedProfile('');
  setSignatureBlob(null);
  setError('');
  setAmount(String((game?.default_buyin_cents||10000)/100));
  setSheet({kind:'seat'});
 }
 async function removeEmptySeat(seatId:string,name:string){
  if(!db||!game||!user||busy.current||game.status!=='live')return;
  if(ledger.some(t=>t.seat_id===seatId)||pendingOps.some(t=>t.seatId===seatId)){
   setError('Signed or pending entries exist. Correct the ledger instead of removing this seat.');return;
  }
  if(!window.confirm('Remove '+name+' from this table? The saved player profile stays available.'))return;
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.rpc('holdings_remove_empty_seat',{p_seat_id:seatId});
   if(e)throw e;
   if(!data?.removed||data.seat_id!==seatId)throw new Error('Seat removal was not confirmed');
   setSeats(prev=>prev.filter(s=>s.id!==seatId));
   noticeNow('Player removed from this table');
  }catch(e){fail(e)}
  finally{busy.current=false;setLoading(false)}
 }
 async function seatWithFirstBuyin(){
  if(!db||!game||!user||busy.current)return;
  if(game.status!=='live'){setError('This game is closed');return}
  const name=playerName.trim();
  if(!selectedProfile&&!name){setError('Choose an existing player or enter a new name');return}
  if(!selectedProfile&&name.length>100){setError('Player name is too long');return}
  const cents=toCents(amount);
  if(cents===null||cents<=0){setError('Enter a first buy-in greater than zero');return}
  if(!signatureBlob){setError('Player signature is required');return}
  if(selectedProfile&&seats.some(s=>s.profile_id===selectedProfile)){
   setError('This player is already seated');return;
  }
  busy.current=true;setLoading(true);setError('');
  const operationId=seatOpRef.current||crypto.randomUUID();
  seatOpRef.current=operationId;
  const signaturePath=user.id+'/'+game.id+'/'+operationId+'.png';
  try{
   const upload=await db.storage.from('holdings-signatures').upload(signaturePath,signatureBlob,{contentType:'image/png',upsert:false});
   // A retry after an uncertain network result must reuse the same signed operation.
   if(upload.error&&!/already exists|duplicate/i.test(upload.error.message))throw upload.error;
   const {data,error:e}=await db.rpc('holdings_seat_and_buyin',{
    p_game_id:game.id,p_profile_id:selectedProfile||null,p_display_name:selectedProfile?null:name,
    p_amount_cents:cents,p_signature_path:signaturePath,p_operation_id:operationId
   });
   if(e)throw e;
   if(!data||!data.seat||!data.transaction||!data.profile)throw new Error('Incomplete seating confirmation');
   const result=data as {seat:Seat;transaction:Ledger;profile:Profile;replayed:boolean};
   setProfiles(prev=>prev.some(p=>p.id===result.profile.id)?prev:[...prev,result.profile]);
   setSeats(prev=>prev.some(s=>s.id===result.seat.id)?prev:[...prev,result.seat]);
   setLedger(prev=>prev.some(t=>t.id===result.transaction.id)?prev:[...prev,result.transaction]);
   setSheet({kind:'none'});setSelectedProfile('');setPlayerName('');setSignatureBlob(null);
   seatOpRef.current=null;
   setTab('table');
   noticeNow(result.replayed?'Previous signed seating confirmed':'Player seated · first buy-in signed');
   void refreshHome();
  }catch(e){fail(e)}
  finally{busy.current=false;setLoading(false)}
 }
 async function refreshPending(){
  if(!user||!game)return;
  try{setPendingOps(await listPending(user.id,game.id))}
  catch(e){setError('Offline storage error: '+errMsg(e))}
 }
 async function flushPending(){
  if(!db||!user||!game||syncingRef.current||!navigator.onLine)return;
  syncingRef.current=true;setQueueBusy(true);
  try{
   const operations=await listPending(user.id,game.id);
   for(const op of operations){
    if(!navigator.onLine)break;
    try{
     const current=await db.from('holdings_ledger').select('*').eq('id',op.id).eq('owner_id',user.id).maybeSingle();
     if(current.error)throw current.error;
     let record=current.data as Ledger|null;
     if(!record){
      const signaturePath=op.ownerId+'/'+op.gameId+'/'+op.id+'.png';
      const uploaded=await db.storage.from('holdings-signatures').upload(signaturePath,op.signature,{
       contentType:'image/png',upsert:false
      });
      if(uploaded.error&&!/already exists|duplicate|exists/i.test(uploaded.error.message))throw uploaded.error;
      const write=await db.from('holdings_ledger').insert({
       id:op.id,client_operation_id:op.id,owner_id:op.ownerId,game_id:op.gameId,
       seat_id:op.seatId,kind:op.kind,amount_cents:op.amountCents,signature_path:signaturePath
      }).select('*').single();
      if(write.error){
       if(write.error.code==='23505'){
        const check=await db.from('holdings_ledger').select('*').eq('id',op.id).eq('owner_id',user.id).maybeSingle();
        if(check.error||!check.data)throw write.error;
        record=check.data as Ledger;
       }else throw write.error;
      }else record=write.data as Ledger;
     }
     if(record.owner_id!==op.ownerId||record.game_id!==op.gameId||record.seat_id!==op.seatId||
      record.kind!==op.kind||Number(record.amount_cents)!==op.amountCents)
      throw new Error('Server record mismatch; cannot clear this pending entry');
     await deletePending(op.id);
     setLedger(prev=>prev.some(t=>t.id===record!.id)?prev:[...prev,record!]);
    }catch(e){
     await updatePendingError(op,errMsg(e));
     if(!navigator.onLine)break;
    }
   }
  }catch(e){setError('Pending sync error: '+errMsg(e))}
  finally{syncingRef.current=false;setQueueBusy(false);await refreshPending()}
 }
 async function discardPending(id:string){
  if(!window.confirm('Discard this unsynced signed entry? This cannot be recovered from the server.'))return;
  try{await deletePending(id);await refreshPending();noticeNow('Local pending entry discarded')}
  catch(e){setError(errMsg(e))}
 }
 async function addTransaction(kind:'buyin'|'cashout',seatId:string){
  if(!game||!user||busy.current)return;
  const cents=toCents(amount);
  if(cents===null||(kind==='buyin'&&cents===0)){setError('Enter a valid amount');return}
  if(!signatureBlob){setError('Player signature is required');return}
  if(game.status==='closed'){setError('This game is closed');return}
  const otherCashout=ledger.some(x=>x.seat_id===seatId&&x.kind==='cashout'&&!x.voided_at)||
    pendingOps.some(x=>x.seatId===seatId&&x.kind==='cashout');
  const hasBuyin=ledger.some(x=>x.seat_id===seatId&&x.kind==='buyin'&&!x.voided_at);
  if(otherCashout){setError('This player already has a cash-out recorded or pending');return}
  if(kind==='cashout'&&!hasBuyin){setError('Sync the initial buy-in before cash-out');return}
  busy.current=true;setLoading(true);setError('');
  try{
   const op:QueuedSignedTransaction={
    id:crypto.randomUUID(),ownerId:user.id,gameId:game.id,seatId,kind,
    amountCents:cents,signature:signatureBlob,createdAt:new Date().toISOString()
   };
   // Persist first. Until the server confirms, balances never treat this as settled.
   await savePending(op);
   setPendingOps(prev=>[...prev,op]);
   setSheet({kind:'none'});setAmount('');setSignatureBlob(null);
   noticeNow(navigator.onLine?'Signed entry queued for sync':'Saved on this device — awaiting connection');
  }catch(e){fail(e)}
  finally{busy.current=false;setLoading(false)}
  if(navigator.onLine)void flushPending();
 }
 async function openLedger(seatId:string){
  if(!db||!game)return;
  setSheet({kind:'ledger',seatId});setError('');
  const signed=ledger.filter(x=>x.seat_id===seatId&&x.signature_path);
  const [urls,history]=await Promise.all([
   Promise.all(signed.map(async t=>{
    const {data}=await db.storage.from('holdings-signatures').createSignedUrl(t.signature_path!,3600);
    return {id:t.id,url:data?.signedUrl||''};
   })),
   db.from('holdings_corrections').select('id,transaction_id,reason,created_at').eq('game_id',game.id)
  ]);
  setSignatureUrls(prev=>({...prev,...Object.fromEntries(urls.map(x=>[x.id,x.url]))}));
  if(history.error)setError(history.error.message);
  else setCorrections((history.data||[]) as Correction[]);
 }
 function startCorrection(tx:Ledger){
  setVoidReason('');
  setError('');
  setSheet({kind:'void',txnId:tx.id,seatId:tx.seat_id});
 }
 async function confirmCorrection(){
  if(!db||!game||busy.current||game.status!=='live'||!sheet.txnId)return;
  if(voidReason.trim().length<5){setError('Enter a reason of at least five characters');return}
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.rpc('holdings_void_signed_transaction',{
    p_transaction_id:sheet.txnId,p_reason:voidReason.trim()
   });
   if(e)throw e;
   if(!data?.transaction||!data?.correction)throw new Error('Missing correction confirmation');
   const changed=data.transaction as Ledger;
   setLedger(prev=>prev.map(t=>t.id===changed.id?changed:t));
   setCorrections(prev=>[...prev,data.correction as Correction]);
   setSheet({kind:'ledger',seatId:changed.seat_id});
   setVoidReason('');
   noticeNow('Signed entry voided with reason preserved');
  }catch(e){fail(e)}
  finally{busy.current=false;setLoading(false)}
 }
 async function closeGame(){
  if(!db||!game||busy.current)return;
  if(pendingOps.length){setError('Sync or discard pending signed transactions before closing');return}
  if(!settlement.ready){setError('Cash out every player and reconcile the bank before closing');return}
  busy.current=true;setLoading(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_games').update({status:'closed'}).eq('id',game.id).eq('status','live').select('*').single();
   if(e)throw e;
   setGame(data as Game);setGames(prev=>prev.map(g=>g.id===data.id?data as Game:g));
   setSheet({kind:'export'});setTab('settle');void refreshHome();noticeNow('Game closed; results saved to history');
  }catch(e){fail(e)}finally{busy.current=false;setLoading(false)}
 }
 function downloadSummary(){
  const file=new Blob([summaryText],{type:'text/plain;charset=utf-8'});
  const link=URL.createObjectURL(file);const anchor=document.createElement('a');anchor.href=link;
  anchor.download='Holdings-'+(game?.title||guest?.game.title||'Game').replace(/[^a-z0-9]+/gi,'-')+'-summary.txt';
  document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(link);
 }
 async function shareSettlementImage(){
  if(!game||!settlement.ready||game.status!=='closed'){setError('Close and reconcile the game before sharing a final settlement');return}
  setLoading(true);setError('');
  try{
   const blob=await makeSettlementImage({
    title:game.title,currency:game.currency,stakes:game.stakes,
    started_at:game.started_at,status:game.status
   },settlement);
   const fileName='holdings-'+game.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-settlement.png';
   const image=new File([blob],fileName,{type:'image/png'});
   if(navigator.canShare?.({files:[image]})&&navigator.share){
    try{await navigator.share({files:[image],title:'Holdings — '+game.title})}
    catch(e){if((e as Error).name==='AbortError')return;throw e}
   }else{
    const link=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=link;a.download=fileName;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(link),10000);
    noticeNow('Settlement image saved');
   }
  }catch(e){fail(e)}finally{setLoading(false)}
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
 function goHome(){setDemoMode(false);setGame(null);setGuest(null);setGuestToken('');setGuestSelectedSeat('');setGuestShowTable(false);history.replaceState(null,'',location.pathname);setSheet({kind:'none'});setTab('table');if(user)void refreshHome()}
 const seatBalances=activeSeats.map(s=>{const tx=sums.live.filter(t=>t.seat_id===s.id);const total=tx.filter(t=>t.kind==='buyin').reduce((n,t)=>n+Number(t.amount_cents),0);const cashout=tx.filter(t=>t.kind==='cashout').reduce((n,t)=>n+Number(t.amount_cents),0);return {...s,total,cashout,hasCashout:tx.some(t=>t.kind==='cashout'),count:tx.filter(t=>t.kind==='buyin').length}});
 const closed=game?.status==='closed'||guest?.game.status==='closed';
 const titleText=game?.title||guest?.game.title||'';
 const avatarProfile=(s:typeof seatBalances[number])=>profiles.find(p=>p.id===s.profile_id)||null;

 return <><EdgeGlow/><div className="app-shell">
  <header className="header"><div className="brand"><div className="brand-symbol">♠</div><span>Holdings</span></div><span className="header-meta">{active?'TABLE LEDGER':'PRIVATE POKER LEDGER'}</span></header>
  {!db?<section className="empty-frame"><ShieldCheck size={32}/><h2>Preview configuration required</h2><p>Add Supabase project URL and publishable key in Vercel project environment variables.</p></section>:
  initializing?<div className="loading-line"><LoaderCircle size={20} className="spin"/> Starting Holdings…</div>:
  active?(isGuest&&(guest?.scope==='player'||!guestShowTable)&&guest?<GuestArrival snapshot={guest} selectedSeat={guestSelectedSeat}
    onSelect={setGuestSelectedSeat} onViewTable={()=>setGuestShowTable(true)}
    resolveAvatar={avatarUrl} demo={demoMode} scoped={guest.scope==='player'}/>:<>
   <div className="topline"><button className="text-link" onClick={isGuest?()=>setGuestShowTable(false):goHome}><ArrowLeft size={18}/> {isGuest?'My buy-ins':'All games'}</button><div className="right-actions"><span className={'live-pill '+(closed?'muted':'')}><i/>{closed?'Closed':'Live'}</span>{game&&<button className="icon-control" title="Share table" onClick={()=>setSheet({kind:'share'})}><Share2 size={19}/></button>}</div></div>
   <div className="page-title"><div className="eyebrow">{isGuest?'YOU ARE VIEWING':'CURRENT GAME'}</div><div className="sync-indicator" aria-live="polite"><span className={syncMode==='live'?'sync-dot sync-connected':'sync-dot'}/>{demoMode?'Demo data':syncMode==='live'?'Live sync':'Auto-refresh'}</div><h1>{titleText}</h1><p>{game?.stakes||guest?.game.stakes||'Cash game'} · {curr}{isGuest?' · Read only':''}</p></div>
   {game&&pendingOps.length>0&&<section className="pending-panel" aria-live="polite">
     <div className="pending-head"><strong>{pendingOps.length} signed {pendingOps.length===1?'entry':'entries'} awaiting sync</strong>
      <button className="small-action" disabled={queueBusy||!navigator.onLine}
        onClick={()=>void flushPending()}>{queueBusy?'Syncing…':'Retry sync'}</button>
     </div>
     <p>These records are saved on this device but not included in table totals until the server confirms them. Do not close the game before they sync.</p>
     {pendingOps.map(op=><div className="pending-item" key={op.id}>
      <div><strong>{op.kind==='buyin'?'Buy-in':'Cash-out'} · {fmt(op.amountCents,curr)}</strong>
       <small>{seats.find(s=>s.id===op.seatId)?.display_name_snapshot||'Player'} · {op.lastError||'Awaiting server confirmation'}</small></div>
      <button type="button" onClick={()=>void discardPending(op.id)}>Discard</button>
     </div>)}
    </section>}
    <section className="hero"><div className="eyebrow blue-label">TOTAL BUY-INS</div><div className="hero-amount"><span>{curr}</span>{(sums.ins/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div className="hero-grid"><div><small>Chips in play</small><strong>{fmt(sums.onTable,curr)}</strong></div><div><small>Paid out</small><strong>{fmt(sums.outs,curr)}</strong></div><div><small>Players</small><strong>{activeSeats.length}</strong></div></div></section>
   <div className="segmented" role="tablist" aria-label="Table sections">{(['table','cashout','settle'] as const).map(t=><button type="button" role="tab" aria-selected={tab===t} className={tab===t?'selected':''} onClick={()=>changeTab(t)} key={t}>{t==='table'?'Table':t==='cashout'?'Cash out':'Settle'}</button>)}</div>
   <main onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}
    onTouchCancel={()=>{touchPoint.current=null;setDragX(0)}} className="tab-content"
    style={{transform:'translate3d('+dragX+'px,0,0)',transition:dragX?'none':'transform .18s ease-out'}}>
    <div key={tab} className={'tab-panel tab-from-'+swipeDir}>
    {tab==='table'?<>
     <div className="section-head"><h2>Players <span>{activeSeats.length}</span></h2>{game&&!closed&&<button className="small-action" onClick={openSeatSheet}><Plus size={16}/> Add player</button>}</div>
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
         {game&&!closed&&!ledger.some(t=>t.seat_id===s.id)&&!pendingOps.some(t=>t.seatId===s.id)&&<button
          className="remove-empty-seat" type="button" title="Remove empty seat" aria-label={'Remove '+s.display_name_snapshot+' from table'}
          onClick={()=>void removeEmptySeat(s.id,s.display_name_snapshot)}><Trash2 size={15}/></button>}
       </div>
      </article>)}
     {game&&!closed&&<button className="primary-btn add-transaction" onClick={openSeatSheet}><Plus size={19}/> Seat player</button>}
     {isGuest&&<div className="info-note"><ShieldCheck size={17}/>{demoMode?'Demo preview: sample data only. No changes are saved.':'Guest access is read only. The host controls all changes.'}</div>}
    </>:tab==='cashout'?<>
     <div className="section-head"><h2>Cash out</h2></div>
     {seatBalances.filter(s=>s.total>0).map(s=><article className="player-row" key={s.id}>
       <Avatar name={s.display_name_snapshot} path={s.avatar_path}/>
       <div className="player-main"><strong>{s.display_name_snapshot}</strong><span>In for {fmt(s.total,curr)}</span>
        {game&&<button className="ledger-link" onClick={()=>void openLedger(s.id)}>Signed ledger <ChevronRight size={13}/></button>}
       </div>
       {s.hasCashout?<div className="cashout-result">
          <div className="cashout-breakdown-line"><small>Cashed out</small><strong>{fmt(s.cashout,curr)}</strong></div>
          <div className="cashout-breakdown-line"><small>Net P&amp;L</small><strong className={s.cashout-s.total>0?'amount-positive':s.cashout-s.total<0?'amount-negative':''}>{s.cashout===s.total?'Even':(s.cashout-s.total>0?'+':'−')+fmt(Math.abs(s.cashout-s.total),curr)}</strong></div>
          {game&&!closed&&<button className="recount-action" onClick={()=>{const tx=ledger.find(x=>x.seat_id===s.id&&x.kind==='cashout'&&!x.voided_at);if(tx)startCorrection(tx)}}><RotateCcw size={13}/> Recount</button>}
         </div>
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
      <div className="section-head"><h2>Player results</h2><span className="stats-count">{settlement.participants.length} players</span></div>
      {settlement.players.filter((p:SettledPlayer)=>p.buyin>0).sort((a:SettledPlayer,b:SettledPlayer)=>(b.net??0)-(a.net??0)).map((s:SettledPlayer)=>
       <article className="result-row settlement-player-result" key={s.id}>
        <div className="settlement-player-name"><strong>{s.name}</strong><small>Buy-ins {fmt(s.buyin,curr)}</small></div>
        <div className="settlement-player-figures">
         <span>{s.cashout===null?'Not cashed out':'Cashed out '+fmt(s.cashout,curr)}</span>
         <strong className={s.net===null?'':s.net>0?'amount-positive':s.net<0?'amount-negative':''}>
          {s.net===null?'Awaiting payout':s.net===0?'Even':(s.net>0?'+':'−')+fmt(Math.abs(s.net),curr)}
         </strong>
         {s.net!==null&&<small>Net P&amp;L</small>}
        </div>
       </article>)}
      {!settlement.allOut?<div className="info-note"><ShieldCheck size={17}/> Settlement unlocks when every player with a buy-in has cashed out. {settlement.cashedOutCount} of {settlement.participants.length} complete.</div>:
       <>
        <div className="section-head"><h2>Who pays whom</h2></div>
        {!settlement.transfers.length?<div className="empty-mini">No transfers needed.</div>:settlement.transfers.map((t,i)=>
          <div key={i} className="transfer-row"><div><strong>{t.from}</strong><span>pays</span><strong>{t.to}</strong></div><b>{fmt(t.amount,curr)}</b></div>)}
        {settlement.discrepancy!==0&&<div className="reconcile-warning">Bank is {fmt(Math.abs(settlement.discrepancy),curr)} {settlement.discrepancy>0?'overpaid':'short'}. Transfers cannot fully reconcile until stacks are corrected.</div>}
        <button className="primary-btn" onClick={()=>setSheet({kind:'export'})}><FileText size={18}/> Export session summary</button>
        {game&&game.status==='live'&&<button className="outline-wide" disabled={!settlement.ready||loading||pendingOps.length>0} onClick={()=>setSheet({kind:'close'})}><Check size={18}/> Close game</button>}
        {game&&game.status==='closed'&&<div className="info-note"><Check size={17}/> Game closed. Results are saved in History.</div>}
       </>}

    </>}
    </div></main>
  </>):!user?<div className="auth-view"><div className="intro-label">YOUR PRIVATE LEDGER</div><h1>Every chip.<br/>Accounted for.</h1><p>A cleaner way to run your home game. Record buy-ins, track results and let friends watch live.</p><form onSubmit={async e=>{e.preventDefault();if(!db)return;setLoading(true);setError('');const {error:e2}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});setLoading(false);if(e2)setError(e2.message);else setEmailSent(true)}}><label>Email address</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/><button className="primary-btn" disabled={loading}>{loading?'Sending…':emailSent?'Send another login link':'Sign in with email'} <ArrowRight size={17}/></button>{emailSent&&<div className="info-note"><Check size={17}/> Check your email for a secure sign-in link.</div>}</form><button className="outline-wide" type="button" onClick={startDemo}>Explore demo without signing in <ArrowRight size={17}/></button><p className="muted-detail">Demo uses sample data. Your existing Holdings records are not affected.</p>{!standalone&&<button type="button" className="install-cta" onClick={()=>void requestInstall()}><Smartphone size={18}/> Install on your phone <ArrowRight size={17}/></button>}</div>:
  <>
   <main className="home-swipe-surface" onTouchStart={onHomeTouchStart} onTouchMove={onHomeTouchMove}
    onTouchEnd={onHomeTouchEnd} onTouchCancel={()=>{homeTouch.current=null;setHomeDragX(0)}}
    onClickCapture={e=>{if(homeSwipeConsumed.current){e.preventDefault();e.stopPropagation();homeSwipeConsumed.current=false}}}
    style={{transform:'translate3d('+homeDragX+'px,0,0)',transition:homeDragX?'none':'transform .19s ease-out'}}>
    <div key={section} className={'home-section-panel home-from-'+homeSwipeDir}>
    {section==='home'&&<>
     <div className="welcome"><div className="eyebrow">YOUR PRIVATE LEDGER</div><h1><Greeting/></h1><p>Every buy-in signed. Every chip accounted for.</p></div>
     {!standalone&&<button className="install-cta" onClick={()=>void requestInstall()}><Smartphone size={19}/> Install Holdings on your phone <ArrowRight size={17}/></button>}
     <section className="overview-card"><div className="eyebrow blue-label">YOUR GAMES</div><strong>{visibleGames.length}</strong><p>{liveGames.length} live · {closedGames.length} completed</p></section>
     <div className="section-head"><h2>Live tables <span>{liveGames.length}</span></h2><button className="small-action" onClick={()=>setSheet({kind:'game'})}><Plus size={16}/> New game</button></div>
     {liveGames.map(x=><button className="game-row" key={x.id} onClick={()=>void openGame(x)}><div className="game-icon">♠</div><div className="player-main"><strong>{x.title}</strong><span>{new Date(x.started_at).toLocaleDateString()} · {x.currency} · {x.stakes||'Cash game'}</span></div><span className="live-pill"><i/>Live</span><ChevronRight size={19}/></button>)}
     <div className="home-tools">
      <details open={backupOpen} onToggle={e=>setBackupOpen((e.currentTarget as HTMLDetailsElement).open)}>
       <summary>Backup &amp; recovery <ChevronRight size={18}/></summary>
       {user&&db&&<BackupRecovery db={db} ownerId={user.id}/>}
      </details>
      <details open={profilesOpen} onToggle={e=>setProfilesOpen((e.currentTarget as HTMLDetailsElement).open)}>
       <summary>Manage player profiles <ChevronRight size={18}/></summary>
       {user&&db&&<ProfileEditor db={db} ownerId={user.id} profiles={profiles}
        onUpdated={profile=>setProfiles(p=>p.map(x=>x.id===profile.id?profile:x))}/>}
      </details>
     </div>
     {!liveGames.length&&<div className="empty-frame"><CircleDollarSign size={32}/><h3>{visibleGames.length?'No live tables':'Ready for your first game?'}</h3><p>{visibleGames.length?'Your '+closedGames.length+' completed game'+(closedGames.length===1?' is':'s are')+' in History. Start another table when ready.':'Create a table to record signed buy-ins and player results.'}</p></div>}
    </>}
    {section==='stats'&&<>
     <div className="welcome alt-welcome"><div className="eyebrow">PLAYER PERFORMANCE</div><h1>Your stats.</h1><p>Cumulative profits and losses from completed games.</p></div>
     <Standings games={visibleGames} seats={statSeats} transactions={statLedger} loading={statsLoading}/>
    </>}
    {section==='history'&&<>
     <div className="welcome alt-welcome"><div className="eyebrow">COMPLETED SESSIONS</div><h1>Game history.</h1><p>Past results and signed transactions, kept in one place.</p></div>
     <div className="section-head"><h2>Completed <span>{closedGames.length}</span></h2>
      {closedGames.length>0&&<button className="small-action" onClick={()=>setHistoryEditing(v=>!v)}>{historyEditing?'Done':'Edit'}</button>}
     </div>
     {closedGames.map(x=><ClosedGameRow key={x.id} game={x} editing={historyEditing}
      onEdit={()=>setHistoryEditing(true)}
      onOpen={()=>void openGame(x)}
      onRemove={()=>setSheet({kind:'remove',gameId:x.id})}/>)}
     {!closedGames.length&&<div className="empty-frame"><History size={32}/><h3>No completed games</h3><p>Closed sessions appear here with their final settlement and signatures.</p></div>}
     {closedGames.length>0&&!historyEditing&&<p className="history-hint">Press and hold a completed game to manage it.</p>}
     {removedGames.length>0&&<section className="removed-section"><div className="section-head"><h2>Recently removed <span>{removedGames.length}</span></h2></div>
      <p className="removed-subtitle">These games are hidden, not permanently deleted. You can restore them.</p>
      {removedGames.map(x=><div className="removed-row" key={x.id}><div><strong>{x.title}</strong><small>{new Date(x.started_at).toLocaleDateString()} · {x.currency}</small></div><button onClick={()=>void restoreClosedGame(x.id)} disabled={loading}>Restore</button></div>)}
     </section>}
    </>}
    </div>
   </main>
   <nav className="bottom-nav" aria-label="Main navigation"><button className={section==='home'?'on':''} onClick={()=>changeHomeSection('home')}><Home size={22}/> Home</button><button className={section==='stats'?'on':''} onClick={()=>changeHomeSection('stats')}><TrendingUp size={22}/> Stats</button><button className={section==='history'?'on':''} onClick={()=>changeHomeSection('history')}><History size={22}/> History</button></nav>
  </>}
  {error&&<div role="alert" className="error-banner"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={18}/></button></div>}
  {notice&&<div className="toast"><Check size={18}/>{notice}</div>}
  {loading&&<div className="busy-badge"><LoaderCircle className="spin" size={16}/> Saving…</div>}
  </div>
  {sheet.kind!=='none'&&<div className="sheet-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setSheet({kind:'none'});setError('')}}}><div className="sheet" role="dialog" aria-modal="true"><div className="sheet-grab"/><div className="sheet-head"><h2>{sheet.kind==='game'?'New table':sheet.kind==='seat'?'Seat a player':sheet.kind==='player'?'Player photo':sheet.kind==='share'?'Invite players':sheet.kind==='ledger'?'Player ledger':sheet.kind==='export'?'Session summary':sheet.kind==='close'?'Close game':sheet.kind==='install'?'Install Holdings':sheet.kind==='remove'?'Remove completed game':sheet.kind==='void'?'Correct signed entry':sheet.kind==='buyin'?'Record buy-in':'Cash out'}</h2><button className="icon-control" onClick={()=>{setSheet({kind:'none'});setError('')}} aria-label="Close"><X size={20}/></button></div><div className="sheet-scroll">
   {sheet.kind==='game'&&<form onSubmit={e=>{e.preventDefault();void createGame()}}><label>Table name</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100}/><div className="form-grid"><div><label>Stakes</label><input value={stakes} onChange={e=>setStakes(e.target.value)}/></div><div><label>Currency</label><input value={currency} onChange={e=>setCurrency(e.target.value)} maxLength={4}/></div></div><label>Standard buy-in</label><input type="number" min="0" step="0.01" value={buyin} onChange={e=>setBuyin(e.target.value)}/><button className="primary-btn" disabled={loading}>Create table <ArrowRight size={18}/></button></form>}
   {sheet.kind==='seat'&&<form id="seat-first-buyin-form" className="seat-first-form" onSubmit={e=>{e.preventDefault();void seatWithFirstBuyin()}}>
      <p className="subtle-copy">Seat a player and record their first signed buy-in together.</p>
      <label>Existing player</label>
      <div className="select-shell">
       <select aria-label="Choose existing player" value={selectedProfile} onChange={e=>{seatOpRef.current=null;setSelectedProfile(e.target.value);if(e.target.value)setPlayerName('')}}>
        <option value="">New player or select existing</option>
        {profiles.filter(p=>!p.archived_at&&!seats.some(s=>s.profile_id===p.id)).map(p=><option value={p.id} key={p.id}>{p.display_name}</option>)}
       </select>
       <ChevronDown size={20} aria-hidden="true" className="select-chevron"/>
      </div>
      <button type="button" className="profile-manager-link" onClick={()=>setManageSeatProfiles(v=>!v)}>
       {manageSeatProfiles?'Done managing saved players':'Edit / remove saved players'} <ChevronRight size={15}/>
      </button>
      {manageSeatProfiles&&user&&db&&<div className="seat-profiles-manager">
       <ProfileEditor db={db} ownerId={user.id} profiles={profiles}
        onUpdated={profile=>{
         setProfiles(p=>p.map(x=>x.id===profile.id?profile:x));
         if(profile.archived_at&&selectedProfile===profile.id){setSelectedProfile('');setSignatureBlob(null);seatOpRef.current=null}
        }}/>
      </div>}
      {!selectedProfile&&<>
       <label>New player name</label>
       <input value={playerName} maxLength={100} onChange={e=>{seatOpRef.current=null;setPlayerName(e.target.value)}} placeholder="Full name or nickname" autoComplete="off"/>
       <p className="seat-profile-tip">New player profiles are saved and reusable in future games.</p>
      </>}
      <label>First buy-in ({curr})</label>
      <input className="amount-input" type="number" inputMode="decimal" step="0.01" min="0.01"
       value={amount} onChange={e=>{seatOpRef.current=null;setAmount(e.target.value)}} placeholder="0.00" required/>
      <div className="quick-amounts">{[1,2,3].map(n=>
       <button type="button" key={n} onClick={()=>{seatOpRef.current=null;setAmount(String(n*(game?.default_buyin_cents||10000)/100))}}>
        {fmt(n*(game?.default_buyin_cents||10000),curr)}
       </button>)}
      </div>
      <label>Player signature</label>
      <p className="subtle-copy">The player signs to confirm the first buy-in amount. Seating requires an internet connection; offline queueing is available for later signed buy-ins and cash-outs.</p>
      <SignaturePad key={'seat-'+(game?.id||'')} resetId={'seat-'+(game?.id||'')}
       onChange={blob=>{seatOpRef.current=null;setSignatureBlob(blob)}}/>
    </form>}
    {sheet.kind==='player'&&<><p className="subtle-copy">Change {imageProfile?.display_name}'s profile photo. Pictures follow the player into future games.</p><input ref={photoRef} type="file" accept="image/*" capture={undefined} className="hidden-input" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadAvatar(f)}}/><button className="menu-row" onClick={()=>photoRef.current?.click()}><ImagePlus size={22}/> Choose photo <ChevronRight size={18}/></button><button className="menu-row" onClick={()=>{if(photoRef.current){photoRef.current.setAttribute('capture','environment');photoRef.current.click();photoRef.current.removeAttribute('capture')}}}><Camera size={22}/> Take photo <ChevronRight size={18}/></button></>}
   {sheet.kind==='share'&&<><p className="subtle-copy">Send a read-only invitation. Friends can view the table without an account or access to your backend settings.</p><div className="invite-code">{game?short(game.invite_token):''}</div><button className="primary-btn" onClick={()=>void share()}><Share2 size={18}/> Share invite</button><button className="outline-wide" onClick={async()=>{if(!game)return;const u=new URL(location.origin+location.pathname);u.hash='join='+game.invite_token;await navigator.clipboard.writeText(u.toString());noticeNow('Link copied')}}><Copy size={18}/> Copy link</button>
    {game&&user&&db&&<GuestLinkManager db={db} ownerId={user.id} gameId={game.id} seats={seats}/>}
   </>}
   {(sheet.kind==='buyin'||sheet.kind==='cashout')&&<form id="signed-ledger-form" onSubmit={e=>{e.preventDefault();void addTransaction(sheet.kind as 'buyin'|'cashout',sheet.seatId||'')}}>
      <p className="subtle-copy">{seats.find(s=>s.id===sheet.seatId)?.display_name_snapshot||''}</p>
      <label>{sheet.kind==='buyin'?'Buy-in amount':'Final stack'} ({curr})</label>
      <input className="amount-input" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" required/>
      {sheet.kind==='buyin'&&<div className="quick-amounts">{[1,2,3].map(n=><button type="button" key={n} onClick={()=>setAmount(String(n*(game?.default_buyin_cents||10000)/100))}>{fmt(n*(game?.default_buyin_cents||10000),curr)}</button>)}</div>}
      {sheet.kind==='cashout'&&<div className="cashout-preview">
        {(()=>{
         const total=settlement.players.find((p:SettledPlayer)=>p.id===sheet.seatId)?.buyin||0;
         const out=amount.trim()?toCents(amount):null;
         const profit=out===null?null:out-total;
         return <>
          <div><span>Total buy-ins</span><strong>{fmt(total,curr)}</strong></div>
          <div><span>Cash-out / payout</span><strong>{out===null?'Enter amount':fmt(out,curr)}</strong></div>
          <div className="cashout-preview-net"><span>Net profit / loss</span>
           <strong className={profit===null?'':profit>0?'amount-positive':profit<0?'amount-negative':''}>
            {profit===null?'—':profit===0?'Even':(profit>0?'+':'−')+fmt(Math.abs(profit),curr)}
           </strong>
          </div>
         </>;
        })()}
       </div>}
      <label>Player signature for verification</label>
      <p className="subtle-copy">The player signs to acknowledge this recorded amount. It is not proof of legal identity.</p>
      <SignaturePad key={(sheet.kind||'')+'-'+(sheet.seatId||'')} onChange={setSignatureBlob} resetId={(sheet.kind||'')+'-'+(sheet.seatId||'')}/>
    </form>}
    {sheet.kind==='ledger'&&<div className="ledger-audit">
      <p className="subtle-copy">Signed transactions remain in the audit trail even if a buy-in or cash-out is voided.</p>
      {ledger.filter(t=>t.seat_id===sheet.seatId).map(t=><div className={'audit-item '+(t.voided_at?'voided':'')} key={t.id}>
        <div className="audit-title"><strong>{t.kind==='buyin'?'Buy-in':'Cash-out'} · {fmt(t.amount_cents,curr)}</strong><span>{new Date(t.created_at).toLocaleString()}</span></div>
        {t.voided_at&&<span className="void-label">VOIDED · {new Date(t.voided_at).toLocaleString()}</span>}
        {corrections.filter(c=>c.transaction_id===t.id).map(a=><p key={a.id} className="correction-reason">Correction reason: {a.reason}</p>)}
        {t.signature_path?
          signatureUrls[t.id]?<img className="signature-image" src={signatureUrls[t.id]} alt="Player signature"/>:<p className="subtle-copy">Loading private signature…</p>
          :<p className="subtle-copy">No signature on this earlier record.</p>}
        {game&&!closed&&!t.voided_at&&<button className="danger-link" onClick={()=>startCorrection(t)}>Void {t.kind==='buyin'?'buy-in':'cash-out'} <RotateCcw size={14}/></button>}
      </div>)}
      {!ledger.some(t=>t.seat_id===sheet.seatId)&&<p className="subtle-copy">No transactions recorded.</p>}
    </div>}
    {sheet.kind==='export'&&<>
      <p className="subtle-copy">Player profits, losses and the exact transfers to settle this table.</p>
      {game?.status==='closed'&&settlement.ready&&<button className="primary-btn" onClick={()=>void shareSettlementImage()}><Share2 size={18}/> Share settlement image</button>}
      <textarea className="export-text" readOnly value={summaryText} onClick={e=>e.currentTarget.select()}/>
      <button className="primary-btn" onClick={async()=>{try{await navigator.clipboard.writeText(summaryText);noticeNow('Summary copied')}catch(e){fail(e)}}}><Copy size={18}/> Copy summary</button>
      <button className="outline-wide" onClick={downloadSummary}><Download size={18}/> Download .txt summary</button>
      {navigator.share&&<button className="outline-wide" onClick={async()=>{try{await navigator.share({title:'Holdings session summary',text:summaryText})}catch(e){if((e as Error).name!=='AbortError')fail(e)}}}><Share2 size={18}/> Share results</button>}
    </>}
    {sheet.kind==='close'&&<>
      <div className="info-note"><ShieldCheck size={19}/> Closing locks all transactions. Results remain available in History and can be exported afterward.</div>
      <div className="summary-card"><div><span>Bank difference</span><strong>{fmt(settlement.discrepancy,curr)}</strong></div><div><span>Players settled</span><strong>{settlement.cashedOutCount}/{settlement.participants.length}</strong></div></div>
      <button className="primary-btn" disabled={!settlement.ready||loading||pendingOps.length>0} onClick={()=>void closeGame()}><Check size={18}/> Confirm close game</button>
      <button className="outline-wide" onClick={()=>setSheet({kind:'none'})}>Keep playing</button>
    </>}
    {sheet.kind==='void'&&<>
       <p className="subtle-copy">Void this signed entry. The original value and signature remain in the ledger audit trail.</p>
       <label>Reason for correction</label>
       <textarea className="correction-input" value={voidReason} onChange={e=>setVoidReason(e.target.value)}
         placeholder="What was recorded incorrectly?" maxLength={300} rows={3}/>
       <button type="button" disabled={loading||voidReason.trim().length<5}
        className="destructive-btn" onClick={()=>void confirmCorrection()}><Trash2 size={17}/> Confirm correction</button>
       <button type="button" className="outline-wide" onClick={()=>setSheet({kind:'ledger',seatId:sheet.seatId})}>Cancel</button>
     </>}
     {sheet.kind==='remove'&&<>
      <p className="subtle-copy">Remove <strong>{games.find(g=>g.id===sheet.gameId)?.title||'this game'}</strong> from your History?</p>
      <div className="info-note"><ShieldCheck size={18}/> The game disappears from History, Stats and guest links. Its signed transactions remain intact and can be restored from Recently removed.</div>
      <button className="destructive-btn" disabled={loading} onClick={()=>{if(sheet.gameId)void removeClosedGame(sheet.gameId)}}><Trash2 size={18}/> Remove game</button>
      <button className="outline-wide" type="button" onClick={()=>setSheet({kind:'none'})}>Cancel</button>
     </>}
    {sheet.kind==='install'&&<>
      <p className="subtle-copy">Install Holdings as a standalone app. It keeps the Wise-style interface and launches without a browser tab.</p>
      <div className="install-instructions"><b>Android · Chrome</b><p>Open Chrome menu (⋮), then select Install app or Add to Home screen.</p><b>iPhone · Safari</b><p>Tap Share, choose Add to Home Screen and enable Open as Web App.</p></div>
      <button className="primary-btn" onClick={()=>setSheet({kind:'none'})}><Check size={18}/> Got it</button>
    </>}

  </div>
  {sheet.kind==='seat'&&<div className="sheet-action-footer">
    <button type="submit" form="seat-first-buyin-form" className="primary-btn"
      disabled={loading||(!selectedProfile&&!playerName.trim())||!signatureBlob||toCents(amount)===null||(toCents(amount)||0)<=0}>
      {loading?<><LoaderCircle className="spin" size={17}/> Saving…</>:<><Check size={19}/> Seat &amp; record buy-in</>}
    </button>
   </div>}
   {(sheet.kind==='buyin'||sheet.kind==='cashout')&&<div className="sheet-action-footer">
    <button type="submit" form="signed-ledger-form"
     disabled={loading||!signatureBlob||toCents(amount)===null||(sheet.kind==='buyin'&&toCents(amount)===0)}
     className="primary-btn">
      {loading?<><LoaderCircle className="spin" size={17}/> Saving…</>:<><Check size={19}/> Confirm {sheet.kind==='buyin'?'buy-in':'cash-out'}</>}
    </button>
  </div>}
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
if ('serviceWorker' in navigator) {
 window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(err=>console.warn('Service worker registration failed',err))});
}

