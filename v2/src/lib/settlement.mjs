/**
 * Ledger arithmetic uses integer cents only.
 * The transfer algorithm matches the original Holdings implementation:
 * largest debtor pays largest creditor until all matched amounts are zero.
 */
export function calculateSettlement(seats, transactions) {
  const live = transactions.filter(t => !(t.voided || t.voided_at));
  const players = seats.map(seat => {
    const tx = live.filter(t => t.seat_id === seat.id);
    const buyin = tx.filter(t => t.kind === 'buyin').reduce((n, t) => n + Number(t.amount_cents), 0);
    const cashedOut = tx.filter(t => t.kind === 'cashout').length > 0;
    const cashout = tx.filter(t => t.kind === 'cashout').reduce((n, t) => n + Number(t.amount_cents), 0);
    return { id:seat.id, name:seat.display_name_snapshot, buyin, cashout:cashedOut ? cashout : null, net: cashedOut ? cashout - buyin : null, cashedOut, count:tx.filter(t => t.kind === 'buyin').length };
  });
  const participants = players.filter(p => p.buyin > 0);
  const allOut = participants.length > 0 && participants.every(p => p.cashedOut);
  const totalBuyin = participants.reduce((n, p) => n + p.buyin, 0);
  const totalCashout = players.reduce((n, p) => n + (p.cashout ?? 0), 0);
  const discrepancy = totalCashout - totalBuyin;
  const debtors = players.filter(p => p.net !== null && p.net < 0).map(p => ({name:p.name, rem:-p.net})).sort((a,b) => b.rem - a.rem || a.name.localeCompare(b.name));
  const creditors = players.filter(p => p.net !== null && p.net > 0).map(p => ({name:p.name, rem:p.net})).sort((a,b) => b.rem - a.rem || a.name.localeCompare(b.name));
  const transfers = [];
  if (allOut) {
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].rem, creditors[j].rem);
      if (amount > 0) transfers.push({from:debtors[i].name, to:creditors[j].name, amount});
      debtors[i].rem -= amount; creditors[j].rem -= amount;
      if (!debtors[i].rem) i++;
      if (!creditors[j].rem) j++;
    }
  }
  return {players, participants, totalBuyin, totalCashout, onTable:totalBuyin - totalCashout, discrepancy, allOut, ready:allOut && discrepancy === 0, cashedOutCount:participants.filter(p => p.cashedOut).length, transfers};
}
export function exportSummary(game, calculation) {
  const fmt = cents => String(game.currency || 'RM')+' '+(cents/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const signed = cents => cents === 0 ? 'even' : (cents > 0 ? '+' : '-') + fmt(Math.abs(cents));
  const sorted = calculation.players.filter(p=>p.buyin>0).sort((a,b)=>Number(b.net??0)-Number(a.net??0));
  const lines = [
    'HOLDINGS — ' + game.title,
    new Date(game.started_at).toLocaleString(),
    (game.stakes ? 'Stakes '+game.stakes+' · ' : '')+sorted.length+' players · Bank '+fmt(calculation.totalBuyin),
    calculation.allOut
      ? (calculation.discrepancy === 0 ? 'Bank reconciled' : 'BANK DIFFERENCE: '+fmt(Math.abs(calculation.discrepancy)))
      : 'IN PROGRESS — '+calculation.cashedOutCount+'/'+calculation.participants.length+' cashed out',
    '', 'PLAYER RESULTS',
    ...sorted.map(p=>'  '+p.name+': In '+fmt(p.buyin)+' · Out '+(p.cashout===null?'Pending':fmt(p.cashout))+' · Net '+(p.net===null?'Not settled':signed(p.net))),
    '', 'SETTLEMENT — '+calculation.transfers.length+' transfer(s)',
    ...(calculation.allOut && calculation.transfers.length
      ? calculation.transfers.map(t=>'  '+t.from+' pays '+t.to+': '+fmt(t.amount))
      : [calculation.allOut?'  No transfers required':'  Available after everyone cashes out']),
    '', 'STATUS: '+String(game.status === 'closed'?'CLOSED':calculation.ready?'READY TO CLOSE':'NOT FINAL'),
  ];
  return lines.join('\n');
}
