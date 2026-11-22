import type {SupabaseClient} from '@supabase/supabase-js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
type Asset={path:string;type:string;data:string};
type Snapshot={
 format:'holdings-v2-snapshot';version:1;createdAt:string;ownerId:string;
 records:{games:unknown[];profiles:unknown[];seats:unknown[];ledger:unknown[];corrections:unknown[];profileChanges:unknown[];guestLinks:unknown[]};
 assets:{signatures:Asset[];avatars:Asset[]};
};
type Envelope={format:'holdings-v2-encrypted-backup';version:1;kdf:'PBKDF2-SHA256';rounds:number;cipher:'AES-256-GCM';salt:string;iv:string;payload:string};
function encode(bytes:Uint8Array):string{
 let result='';const chunk=16384;
 for(let i=0;i<bytes.length;i+=chunk)result+=String.fromCharCode(...bytes.slice(i,i+chunk));
 return btoa(result);
}
function decode(b64:string):Uint8Array{
 const chars=atob(b64),out=new Uint8Array(chars.length);
 for(let i=0;i<chars.length;i++)out[i]=chars.charCodeAt(i);
 return out;
}
async function assetToBase64(blob:Blob){return encode(new Uint8Array(await blob.arrayBuffer()))}
function assertArray(x:unknown,label:string):asserts x is unknown[]{if(!Array.isArray(x))throw new Error('Backup is missing '+label)}
async function deriveKey(passphrase:string,salt:Uint8Array,rounds:number,mode:'encrypt'|'decrypt'){
 const source=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as BufferSource,iterations:rounds,hash:'SHA-256'},
 source,{name:'AES-GCM',length:256},false,[mode]);
}
export async function createEncryptedBackup(db:SupabaseClient,ownerId:string,passphrase:string,progress:(message:string)=>void):Promise<Blob>{
 if(passphrase.length<12)throw new Error('Backup passphrase must be at least 12 characters');
 const fetchAll=async(table:string)=>{
  const rows:unknown[]=[];let from=0;
  for(;;){
   const {data,error}=await db.from(table).select('*').eq('owner_id',ownerId).range(from,from+499);
   if(error)throw error;
   rows.push(...(data||[]));
   if(!data||data.length<500)break;
   from+=500;
   if(from>100000)throw new Error('Backup too large for browser export');
  }
  return rows;
 };
 progress('Collecting ledger and game records…');
 const [games,profiles,ledger,corrections,profileChanges,guestLinks]=await Promise.all([
  fetchAll('holdings_games'),fetchAll('holdings_profiles'),fetchAll('holdings_ledger'),
  fetchAll('holdings_corrections'),fetchAll('holdings_profile_changes'),fetchAll('holdings_guest_links')
 ]);
 const ids=(games as {id:string}[]).map(g=>g.id);
 const seats:unknown[]=[];
 for(let i=0;i<ids.length;i+=40){
  const {data,error}=await db.from('holdings_seats').select('*').in('game_id',ids.slice(i,i+40));
  if(error)throw error;seats.push(...(data||[]));
 }
 const sigPaths=[...new Set((ledger as {signature_path?:string|null}[]).map(x=>x.signature_path).filter((x):x is string=>!!x))];
 const avatarPaths=[...new Set((profiles as {avatar_path?:string|null}[]).map(x=>x.avatar_path).filter((x):x is string=>!!x))];
 const downloadAll=async(bucket:string,paths:string[])=>{
  const results:Asset[]=[];
  for(let i=0;i<paths.length;i++){
   progress('Copying '+bucket+' images ('+(i+1)+'/'+paths.length+')…');
   const {data,error}=await db.storage.from(bucket).download(paths[i]);
   if(error||!data)throw new Error('Backup cannot include '+paths[i]+': '+(error?.message||'File not found'));
   results.push({path:paths[i],type:data.type||'application/octet-stream',data:await assetToBase64(data)});
  }
  return results;
 };
 const signatures=await downloadAll('holdings-signatures',sigPaths);
 const avatars=await downloadAll('holdings-avatars',avatarPaths);
 const snapshot:Snapshot={format:'holdings-v2-snapshot',version:1,createdAt:new Date().toISOString(),ownerId,
  records:{games,profiles,seats,ledger,corrections,profileChanges,guestLinks},assets:{signatures,avatars}};
 progress('Encrypting backup on this device…');
 const salt=crypto.getRandomValues(new Uint8Array(16));const iv=crypto.getRandomValues(new Uint8Array(12));const rounds=220000;
 const key=await deriveKey(passphrase,salt,rounds,'encrypt');
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(snapshot)));
 const envelope:Envelope={format:'holdings-v2-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',rounds,cipher:'AES-256-GCM',
  salt:encode(salt),iv:encode(iv),payload:encode(new Uint8Array(cipher))};
 return new Blob([JSON.stringify(envelope)],{type:'application/json'});
}
export async function verifyEncryptedBackup(file:File,passphrase:string){
 if(file.size>150_000_000)throw new Error('Backup exceeds 150 MB. Use the desktop recovery workflow.');
 const outer=JSON.parse(await file.text()) as Envelope;
 if(outer.format!=='holdings-v2-encrypted-backup'||outer.version!==1||outer.kdf!=='PBKDF2-SHA256'||
 outer.cipher!=='AES-256-GCM'||outer.rounds!==220000)throw new Error('This is not a supported Holdings encrypted backup');
 const key=await deriveKey(passphrase,decode(outer.salt),outer.rounds,'decrypt');
 let plain:ArrayBuffer;
 try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(outer.iv)},key,decode(outer.payload))}
 catch{throw new Error('Incorrect passphrase or backup data is damaged')}
 const snap=JSON.parse(decoder.decode(plain)) as Snapshot;
 if(snap.format!=='holdings-v2-snapshot'||snap.version!==1||!snap.records||!snap.assets)throw new Error('Backup format invalid');
 for(const key of ['games','profiles','seats','ledger','corrections','profileChanges','guestLinks'] as const)assertArray(snap.records[key],key);
 assertArray(snap.assets.signatures,'signatures');assertArray(snap.assets.avatars,'avatars');
 const seen=new Set<string>();
 for(const row of snap.records.ledger as {id?:string;amount_cents?:number}[]){
  if(!row.id||seen.has(row.id)||!Number.isFinite(Number(row.amount_cents))||Number(row.amount_cents)<0)
   throw new Error('Backup has duplicate or malformed ledger records');
  seen.add(row.id);
 }
 return {createdAt:snap.createdAt,ownerId:snap.ownerId,
  games:snap.records.games.length,profiles:snap.records.profiles.length,
  ledger:snap.records.ledger.length,signatures:snap.assets.signatures.length,
  avatars:snap.assets.avatars.length};
}
