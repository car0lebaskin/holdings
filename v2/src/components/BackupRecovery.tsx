import {useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Download,ShieldCheck,FileCheck2,LoaderCircle} from 'lucide-react';
import {createEncryptedBackup,verifyEncryptedBackup} from '../lib/backup';
export function BackupRecovery({db,ownerId}:{db:SupabaseClient;ownerId:string}){
 const [passphrase,setPassphrase]=useState('');
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState('');
 const [problem,setProblem]=useState('');
 const pick=useRef<HTMLInputElement>(null);
 async function backup(){
  if(busy)return;setBusy(true);setProblem('');
  try{
   const blob=await createEncryptedBackup(db,ownerId,passphrase,setStatus);
   const url=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=url;link.download='holdings-backup-'+new Date().toISOString().slice(0,10)+'.encrypted.json';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),10000);
   setStatus('Encrypted backup downloaded. Keep both file and passphrase safe.');
  }catch(e){setProblem(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 async function verify(file:File){
  if(busy)return;setBusy(true);setProblem('');setStatus('Checking encrypted backup…');
  try{
   const a=await verifyEncryptedBackup(file,passphrase);
   setStatus('Verified '+a.games+' games, '+a.ledger+' transactions, '+a.signatures+' signatures and '+a.avatars+' photos (saved '+new Date(a.createdAt).toLocaleString()+').');
  }catch(e){setProblem(e instanceof Error?e.message:String(e));setStatus('')}
  finally{setBusy(false);if(pick.current)pick.current.value=''}
 }
 return <section className="backup-tools">
  <div className="section-head"><h2>Encrypted backup</h2><ShieldCheck size={19} color="#8caaff"/></div>
  <p className="subtle-copy">Download a passphrase-protected copy of your complete ledger, signatures and avatars to your device. No backup leaves this browser except the file you save.</p>
  <label htmlFor="backup-password">Backup passphrase (12+ characters)</label>
  <input id="backup-password" type="password" autoComplete="new-password" value={passphrase}
   onChange={e=>setPassphrase(e.target.value)} placeholder="Strong, unique passphrase"/>
  <button type="button" className="outline-wide" onClick={()=>void backup()} disabled={busy||passphrase.length<12}>
   {busy?<LoaderCircle className="spin" size={17}/>:<Download size={17}/>} Download encrypted backup
  </button>
  <input ref={pick} type="file" accept=".json,application/json" hidden
   onChange={e=>{const f=e.target.files?.[0];if(f)void verify(f)}}/>
  <button type="button" className="outline-wide" disabled={busy||!passphrase} onClick={()=>pick.current?.click()}>
   <FileCheck2 size={17}/> Verify saved backup
  </button>
  {status&&<p className="backup-feedback" role="status">{status}</p>}
  {problem&&<p className="backup-error" role="alert">{problem}</p>}
  <p className="backup-disclaimer">Verification checks the archive locally; importing a backup into Supabase is not yet supported. Save a new copy regularly and store it outside your device.</p>
 </section>;
}
