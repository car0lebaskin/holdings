const fs = require('fs');
const path = require('path');

const file = path.join('public', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function addBefore(needle, insert, label){
  if (!html.includes(needle)) throw new Error(label + ' target not found');
  html = html.replace(needle, insert + needle);
}
function replaceMaybe(needle, replacement){
  if (html.includes(needle)) html = html.replace(needle, replacement);
}

addBefore('</style>', `
  /* player row polish + latest action patch */
  .player-head{display:flex;align-items:center;gap:8px;justify-content:space-between;min-width:0;margin-bottom:4px}
  .player-name{font-weight:800;font-size:17px;font-family:var(--display);letter-spacing:-.02em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .player-head .status-chip{margin-left:0;flex:none;padding:5px 10px;font-size:11px}
  .chips{display:none!important}
  .latest-card{margin-top:14px;padding:14px 18px;border-radius:20px;background:rgba(255,255,255,.045);border:1px solid var(--hairline)}
  .latest-card .k{font-size:12px;color:var(--dim);font-weight:700;margin-bottom:4px}
  .latest-card .v{font-size:14px;line-height:1.45;font-weight:700;color:var(--text)}
`, 'CSS insert');

const oldNameLine = '${(()=>{ const st = playerStatus(p); return `<div style="font-weight:700;font-size:17px;font-family:var(--display);letter-spacing:-.01em;display:flex;align-items:center;flex-wrap:wrap;gap:4px">${esc(p.name)}${mine?\'<span class="dim" style="font-size:12px;font-weight:600;margin-left:8px">You</span>\':\'\'}<span class="status-chip ${st.cls}">${st.label}</span>${bi.length?`<span class="chips">${dots}</span>`:\'\'}</div>`; })()}';
const newNameLine = '${(()=>{ const st = playerStatus(p); return `<div class="player-head"><span class="player-name">${esc(p.name)}${mine?\'<span class="dim" style="font-size:12px;font-weight:600;margin-left:8px">You</span>\':\'\'}</span><span class="status-chip ${st.cls}">${st.label}</span></div>`; })()}';
replaceMaybe(oldNameLine, newNameLine);

const latestHelper = `function latestActionCard(cur){
  if (!S.cur || !S.cur.txns || !S.cur.txns.length) return '';
  const tx = [...S.cur.txns].filter(t=>!t.voided).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!tx) return '';
  const p = S.cur.players.find(x=>x.id===tx.playerId);
  const name = p ? p.name : 'Player';
  const action = tx.type === 'cashout' ? 'cashed out' : 'bought in';
  return '<div class="latest-card"><div class="k">Latest</div><div class="v">' + esc(name) + ' ' + action + ' <span class="num">' + fmt(tx.amountCents,cur) + '</span> · ' + timeStr(tx.createdAt) + '</div></div>';
}
`;
addBefore('/* ── SESSION VIEW ── */', latestHelper, 'Latest helper');
replaceMaybe('    ${tableHealthBanner(t, discrepancy, cur)}\n    ${myBanner}', '    ${tableHealthBanner(t, discrepancy, cur)}\n    ${latestActionCard(cur)}\n    ${myBanner}');

const saferClose = `function modalCloseSession(){
  const t = totals();
  const discrepancy = t.cashOut - t.buyIn;
  const allOut = t.activeCount > 0 && t.outCount === t.activeCount;
  const balanced = discrepancy === 0;
  const checklist = '<div class="card check-card" style="margin-bottom:18px">' +
    '<div class="check-row"><span>All players cashed out</span><b class="' + (allOut?'up':'down') + '">' + (allOut?'Yes':'No') + '</b></div>' +
    '<div class="check-row"><span>Bank balanced</span><b class="' + (balanced?'up':'down') + '">' + (balanced?'Yes':'No') + '</b></div>' +
    '<div class="check-row"><span>Total buy-ins</span><b class="num">' + fmt(t.buyIn,S.cur.session.currency) + '</b></div>' +
    '<div class="check-row"><span>Total cash-outs</span><b class="num">' + fmt(t.cashOut,S.cur.session.currency) + '</b></div>' +
    '</div>';
  openModal('Close this game?', checklist +
    '<p class="dim" style="font-size:14px;line-height:1.6;margin:0 0 18px">Closing locks the game and adds results to standings. If anything looks off, keep playing and fix it first.</p>' +
    (!allOut || !balanced ? '<div class="banner warn" style="margin:0 0 18px">This game is not fully ready to close. You can still close it if the table agrees.</div>' : '') +
    '<button class="btn" data-action="confirm-close-session">Close game</button>' +
    '<button class="btn-ghost" style="width:100%;margin-top:10px;padding:13px" data-action="close-modal">Keep playing</button>');
}
`;
addBefore('/* ════════════════════ EVENTS ════════════════════ */', saferClose, 'Safer close override');

replaceMaybe('Without a Sheet, games are stored on this phone only and will upload automatically once you connect.', 'Without a Sheet, games are stored on this phone only and will upload automatically once you connect. Deleting browser/app data may remove unsynced games.');

fs.writeFileSync(file, html);
console.log('Patched cleaner player rows, latest action, safer close checklist, and local-data warning.');
