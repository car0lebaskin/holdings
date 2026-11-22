import {useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Pencil,Check,X} from 'lucide-react';
type Profile={id:string;owner_id:string;display_name:string;avatar_path:string|null};
export function ProfileEditor({db,ownerId,profiles,onUpdated}:{db:SupabaseClient;ownerId:string;profiles:Profile[];onUpdated:(p:Profile)=>void}){
 const [editing,setEditing]=useState('');
 const [draft,setDraft]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function save(){
  const name=draft.trim();
  if(!name||name.length>100){setError('Player name must be 1–100 characters');return}
  if(profiles.some(p=>p.id!==editing&&p.display_name.toLocaleLowerCase()===name.toLocaleLowerCase())){
   setError('A player with that name already exists. Merge is not yet supported.');return
  }
  setBusy(true);setError('');
  try{
   const {data,error:e}=await db.from('holdings_profiles')
    .update({display_name:name}).eq('id',editing).eq('owner_id',ownerId).select('*').single();
   if(e)throw e;onUpdated(data as Profile);setEditing('');
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 return <section className="profile-tools">
  <div className="section-head"><h2>Saved players</h2></div>
  <p className="subtle-copy">Rename future appearances of a player. Historical game snapshots remain unchanged; renames are logged.</p>
  {profiles.map(p=><div key={p.id} className="profile-edit-row">
   {editing===p.id?<div className="profile-edit-active">
     <input value={draft} maxLength={100} onChange={e=>setDraft(e.target.value)} aria-label="New player name"/>
     <button type="button" disabled={busy} onClick={()=>void save()} aria-label="Save name"><Check size={18}/></button>
     <button type="button" onClick={()=>setEditing('')} aria-label="Cancel rename"><X size={18}/></button>
    </div>:<><span>{p.display_name}</span><button aria-label={'Rename '+p.display_name} onClick={()=>{setEditing(p.id);setDraft(p.display_name);setError('')}}><Pencil size={16}/></button></>}
   </div>)}
  {!profiles.length&&<p className="subtle-copy">Profiles appear here after you seat your first player.</p>}
  {error&&<p role="alert" className="backup-error">{error}</p>}
 </section>;
}
