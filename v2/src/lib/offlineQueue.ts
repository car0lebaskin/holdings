export type QueuedSignedTransaction={
 id:string;ownerId:string;gameId:string;seatId:string;kind:'buyin'|'cashout';
 amountCents:number;signature:Blob;createdAt:string;lastError?:string;
};
const DB='holdings-v2-pending-signed';const STORE='operations';const VERSION=1;
export const offlineQueueAvailable=()=>typeof indexedDB!=='undefined';
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!offlineQueueAvailable())return reject(new Error('Offline storage is not supported on this browser'));
  const request=indexedDB.open(DB,VERSION);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Offline storage unavailable'));
 });
}
async function txn<T>(mode:IDBTransactionMode,work:(store:IDBObjectStore,done:(v:T)=>void,reject:(e:Error)=>void)=>void):Promise<T>{
 const db=await openDb();
 return new Promise<T>((resolve,reject)=>{
  let response!:T;
  let failed=false;
  const transaction=db.transaction(STORE,mode);
  const store=transaction.objectStore(STORE);
  const rejectOnce=(e:Error)=>{if(!failed){failed=true;reject(e)}};
  transaction.oncomplete=()=>{db.close();if(!failed)resolve(response)};
  transaction.onabort=()=>{db.close();rejectOnce(transaction.error||new Error('Offline transaction aborted'))};
  transaction.onerror=()=>rejectOnce(transaction.error||new Error('Offline transaction failed'));
  try{work(store,v=>{response=v},rejectOnce)}
  catch(e){transaction.abort();rejectOnce(e instanceof Error?e:new Error(String(e)))}
 });
}

export async function savePending(op:QueuedSignedTransaction):Promise<void>{
 return txn<void>('readwrite',(store,resolve,reject)=>{
  const request=store.put(op);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error||new Error('Cannot save pending signed record'));
 });
}
export async function listPending(ownerId:string,gameId:string):Promise<QueuedSignedTransaction[]>{
 const all=await txn<QueuedSignedTransaction[]>('readonly',(store,resolve,reject)=>{
  const request=store.getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Cannot read pending records'));
 });
 return all.filter(op=>op.ownerId===ownerId&&op.gameId===gameId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
export async function deletePending(id:string):Promise<void>{
 return txn<void>('readwrite',(store,resolve,reject)=>{
  const request=store.delete(id);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error||new Error('Cannot remove pending record'));
 });
}
export async function updatePendingError(op:QueuedSignedTransaction,error:string){
 await savePending({...op,lastError:error.slice(0,240)});
}
