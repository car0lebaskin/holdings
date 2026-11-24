/** Read-only guest totals. Never treat a chosen name as verified identity. */
export function guestPlayerTotals(snapshot,seatId){
 const player=snapshot?.players?.find(p=>p.seat_id===seatId);
 if(!player)return null;
 const tx=(snapshot.transactions||[]).filter(t=>t.seat_id===seatId&&!t.voided);
 const buyins=tx.filter(t=>t.kind==='buyin');
 const cashouts=tx.filter(t=>t.kind==='cashout');
 const totalBuyin=buyins.reduce((sum,t)=>sum+Number(t.amount_cents),0);
 const totalCashout=cashouts.reduce((sum,t)=>sum+Number(t.amount_cents),0);
 return {
  id:player.seat_id,name:player.name,avatar_path:player.avatar_path,
  totalBuyin,buyinCount:buyins.length,totalCashout,
  hasCashout:cashouts.length>0,net:cashouts.length>0?totalCashout-totalBuyin:null,
  entries:[...tx].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))
 };
}
