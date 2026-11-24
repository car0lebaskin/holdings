import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Pencil,Check,X,Trash2,RotateCcw} from 'lucide-react';

type Profile={id:string;owner_id:string;display_name:string;avatar_path:string|null;archived_at?:string|null};
type Props={db:SupabaseClient;ownerId:string;profiles:Profile[];onUpdated:(p:Profile)=>void};

export function ProfileEditor({db,ownerId,profiles,onUpdated}:Props){
 const [editing,setEditing]=useState('');
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [showArchived,setShowArchived]=useState(false);
 const active=profiles.filter(p=>!p.archived_at);
 const archived=profiles.filter(p=>!!p.archived_at);

 async function save(){
  const name=draft.trim();
  if(!name||name.length>100){setError('Player name must be 1–100 characters');return}
  if(profiles.some(p=>p.id!==editing&&!p.archived_at&&p.display_name.toLocaleLowerCase()===name.toLocaleLowerCase())){
   setError('An active player with that name already exists.');return;
  }
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{
   const {data,error:e}=await db.from('holdings_profiles')
    .update({display_name:name}).eq('id',editing).eq('owner_id',ownerId).is('archived_at',null).select('*').single();
   if(e)throw e;onUpdated(data as Profile);setEditing('');setMessage('Player name updated; past table names unchanged.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function changeArchive(p:Profile,restore:boolean){
  if(busy)return;
  if(!restore&&!window.confirm('Remove '+p.display_name+' from saved players? Historical games and signed entries will remain unchanged. You can restore this profile later.'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const target=db.from('holdings_profiles').update({archived_at:restore?null:new Date().toISOString()})
    .eq('id',p.id).eq('owner_id',ownerId);
   const q=restore?target.not('archived_at','is',null):target.is('archived_at',null);
   const {data,error:e}=await q.select('*').single();
   if(e)throw e;
   onUpdated(data as Profile);setEditing('');setMessage(restore?'Player restored to saved players':'Player removed from saved players. Historical games remain intact.');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section className="profile-tools">
  <div className="section-head"><h2>Saved players</h2><span className="stats-count">{active.length}</span></div>
  <p className="subtle-copy">Rename or remove players from your saved list. Removing archives the profile; signed records and previous sessions are preserved.</p>
  {active.map(p=><div key={p.id} className="profile-edit-row">
   {editing===p.id?<div className="profile-edit-active">
     <input value={draft} maxLength={100} onChange={e=>setDraft(e.target.value)} aria-label={'New name for '+p.display_name}/>
     <button type="button" disabled={busy} onClick={()=>void save()} aria-label="Save name"><Check size={18}/></button>
     <button type="button" disabled={busy} onClick={()=>setEditing('')} aria-label="Cancel rename"><X size={18}/></button>
     <button type="button" disabled={busy} className="profile-delete" title="Remove saved player" aria-label={'Remove '+p.display_name} onClick={()=>void changeArchive(p,false)}><Trash2 size={16}/></button>
    </div>:<>
     <span>{p.display_name}</span>
     <button type="button" disabled={busy} aria-label={'Rename '+p.display_name} onClick={()=>{setEditing(p.id);setDraft(p.display_name);setError('')}}><Pencil size={16}/></button>
     <button type="button" disabled={busy} className="profile-delete" title="Remove saved player" aria-label={'Remove '+p.display_name} onClick={()=>void changeArchive(p,false)}><Trash2 size={16}/></button>
    </>}
   </div>)}
  {!active.length&&<p className="subtle-copy">No active saved players. Restore a profile or create a new one when seating.</p>}
  {archived.length>0&&<div className="archived-profiles">
   <button type="button" className="profile-archive-toggle" onClick={()=>setShowArchived(v=>!v)}>
    {showArchived?'Hide':'View'} removed players ({archived.length})
   </button>
   {showArchived&&archived.map(p=><div className="profile-edit-row" key={p.id}>
    <span>{p.display_name}</span>
    <button type="button" disabled={busy} title="Restore player" aria-label={'Restore '+p.display_name} onClick={()=>void changeArchive(p,true)}><RotateCcw size={17}/></button>
   </div>)}
  </div>}
  {message&&<p role="status" className="backup-feedback">{message}</p>}
  {error&&<p role="alert" className="backup-error">{error}</p>}
 </section>;
}
