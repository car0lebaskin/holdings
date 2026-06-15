const fs = require('fs');
const path = require('path');

const sourceFile = 'index.html';
let html = fs.readFileSync(sourceFile, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!html.includes(needle)) {
    if (replacement && html.includes(replacement)) return;
    throw new Error(label + ' patch target not found in index.html');
  }
  html = html.replace(needle, replacement);
}

const startupBefore = "if (!S.apiUrl) S.view = S.demo ? 'home' : 'config';";
const startupAfter = "if (!S.apiUrl) { S.demo = true; store.set('pl_demo','1'); S.view = 'home'; }";
replaceOnce(startupBefore, startupAfter, 'Startup');

const mobileFixCss = [
  '',
  '  /* mobile polish patch v2 */',
  '  .hero{overflow:hidden}',
  '  .hero .eyebrow{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '  .hero .fig{display:flex;align-items:baseline;gap:8px;white-space:nowrap;font-size:clamp(34px, 10.4vw, 54px);max-width:100%;overflow:hidden;letter-spacing:-.06em}',
  '  .hero .fig .c{font-size:clamp(17px, 5.3vw, 24px);margin-right:0;flex:0 0 auto;letter-spacing:-.04em}',
  '  .hero .sub{display:grid;grid-template-columns:1fr 1fr .82fr;gap:8px}',
  '  .hero .sub .s{min-width:0;padding:11px 10px;border-radius:15px}',
  '  .hero .sub .s span{font-size:11.5px;line-height:1.35}',
  '  .hero .sub .s b{font-size:clamp(15px, 4.2vw, 17px);line-height:1.2;word-break:break-word;letter-spacing:-.04em}',
  '  .action-card{margin-top:12px;padding:18px 20px;cursor:pointer;transition:transform .12s ease, border-color .12s ease}',
  '  .action-card:active{transform:scale(.985);border-color:rgba(91,140,255,.45)}',
  '  .action-card .title{font-family:var(--display);font-size:23px;font-weight:900;letter-spacing:-.035em;color:var(--text)}',
  '  .action-card .subcopy{font-size:14px;color:var(--dim);line-height:1.45;margin-top:4px;font-weight:500}',
  '  .action-card .arrow{width:42px;height:42px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--accent-hi);flex:none}',
  '  #toast{max-width:calc(100vw - 56px);min-height:54px;padding:11px 18px;gap:12px;align-items:center;line-height:1.2;text-align:left;white-space:normal}',
  '  #toast .tick{width:24px;height:24px;min-width:24px;flex:0 0 24px;font-size:14px;font-weight:900;line-height:24px;display:flex;align-items:center;justify-content:center}',
  '  @media (max-width:420px){',
  '    .wrap{padding-left:18px;padding-right:18px}',
  '    .hero{padding:20px 18px}',
  '    .hero .fig{font-size:clamp(32px, 10vw, 46px);gap:7px}',
  '    .hero .fig .c{font-size:clamp(16px, 5vw, 22px)}',
  '  }',
  '  @media (max-width:360px){',
  '    .hero{padding:18px 15px}',
  '    .hero .fig{font-size:34px;gap:6px}',
  '    .hero .fig .c{font-size:17px}',
  '    .hero .sub{gap:6px}',
  '    .hero .sub .s{padding:10px 8px}',
  '  }',
  '',
].join('\n');
replaceOnce('</style>', mobileFixCss + '</style>', 'Mobile CSS fixes');

const recentHelpers = [
  'function recentPlayerNames(){',
  '  const seen = new Set();',
  '  const out = [];',
  '  const add = (name) => {',
  "    const clean = String(name || '').trim();",
  '    if (!clean) return;',
  '    const key = clean.toLowerCase();',
  '    if (seen.has(key)) return;',
  '    seen.add(key);',
  '    out.push(clean);',
  '  };',
  '  if (S.cur && S.cur.players) S.cur.players.forEach(p => add(p.name));',
  '  Object.values(lsSessions())',
  "    .sort((a,b) => String(b.session?.startedAt || '').localeCompare(String(a.session?.startedAt || '')))",
  '    .forEach(st => (st.players || []).forEach(p => add(p.name)));',
  '  (S.home.leaderboard || []).forEach(p => add(p.name));',
  '  return out.slice(0, 12);',
  '}',
  '',
  'function cleanDisplayStakes(value){',
  "  const v = String(value || '').trim();",
  "  if (!v) return '';",
  "  if (/\\d{4}-\\d{2}-\\d{2}/.test(v)) return '';",
  "  if (/T\\d{2}:\\d{2}:\\d{2}/.test(v)) return '';",
  "  if (v.length > 14) return v.slice(0, 14) + '…';",
  '  return v;',
  '}',
  '',
].join('\n');
replaceOnce('/* home data built from on-device sessions (local mode / no Sheet yet) */', recentHelpers + '/* home data built from on-device sessions (local mode / no Sheet yet) */', 'Recent player helpers');

const healthHelper = [
  'function tableHealthBanner(t, discrepancy, cur){',
  "  if (!t.activeCount) return '';",
  '  if (discrepancy === null) {',
  "    return '<div class=\"banner sync\"><b>Table live</b><br><span class=\"num\">' + fmt(t.buyIn,cur) + '</span> in · <span class=\"num\">' + fmt(t.onTable,cur) + '</span> on table · ' + t.outCount + '/' + t.activeCount + ' cashed out</div>';",
  '  }',
  '  if (discrepancy === 0) {',
  "    return '<div class=\"banner ok\"><b>Bank balanced</b><br><span class=\"num\">' + fmt(t.buyIn,cur) + '</span> in · <span class=\"num\">' + fmt(t.cashOut,cur) + '</span> out</div>';",
  '  }',
  "  return '<div class=\"banner warn\"><b>' + fmt(Math.abs(discrepancy),cur) + ' ' + (discrepancy>0?'overpaid':'missing') + '</b><br>' + (discrepancy>0?'Cash-outs exceed buy-ins.':'Chips are unaccounted for.') + ' Recount before settling.</div>';",
  '}',
  '',
].join('\n');
replaceOnce('/* ── SESSION VIEW ── */', healthHelper + '/* ── SESSION VIEW ── */', 'Table health helper');

replaceOnce('  const ses = S.cur.session, cur = ses.currency, t = totals();', "  const ses = S.cur.session, cur = ses.currency, t = totals();\n  const shownStakes = cleanDisplayStakes(ses.stakes);", 'Clean stakes variable');
html = html.replace('${esc(ses.title)}${ses.stakes?` · ${esc(cur)} ${esc(ses.stakes)}`:\'\'}${guest?\' · watching\':\'\'}', '${esc(ses.title)}${shownStakes?` · ${esc(cur)} ${esc(shownStakes)}`:\'\'}${guest?\' · watching\':\'\'}');

replaceOnce('    </div>\n\n    ${myBanner}', '    </div>\n\n    ${tableHealthBanner(t, discrepancy, cur)}\n    ${myBanner}', 'Table health placement');

html = html.replace(/\n    \$\{discrepancy!==null && discrepancy!==0 \? `<div class="banner warn">[\s\S]*?\n    \$\{discrepancy===0 \? `<div class="banner ok">Bank reconciled — every chip accounted for\.<\/div>` : ''\}/, '');

const oldHomeActions = "    <button class=\"btn\" style=\"margin-top:22px\" data-action=\"new-game\">Open a new table</button>\n    ${S.apiUrl ? `<button class=\"btn-ghost\" style=\"width:100%;margin-top:10px;padding:16px;font-size:15px\" data-action=\"join-game\">Join a game with a code</button>` : ''}";
const newHomeActions = "    <button class=\"btn\" style=\"margin-top:22px\" data-action=\"new-game\">Start game</button>\n    <div class=\"card action-card row\" data-action=\"join-game\">\n      <div>\n        <div class=\"title\">Join game</div>\n        <div class=\"subcopy\">Enter a 5-digit table code</div>\n      </div>\n      <div class=\"arrow\">→</div>\n    </div>";
replaceOnce(oldHomeActions, newHomeActions, 'Home action hierarchy');

replaceOnce("  if (a==='join-game'){ modalJoinGame(); return; }", "  if (a==='join-game'){\n    if (!S.apiUrl){ S.view='config'; render(); const msg=document.getElementById('cfg-msg'); if(msg) msg.innerHTML='<span class=\"down\">Connect cloud sync first to join a live game by code.</span>'; return; }\n    modalJoinGame(); return;\n  }", 'Join game cloud guard');

const playerMutationHelpers = [
  'function addPlayer(name){',
  '  const id = uid();',
  '  S.cur.players.push({ id, name:name.trim() });',
  "  enqueue({ action:'addPlayer', id, sessionId:S.cur.session.id, name:name.trim() });",
  '  persist();',
  '}',
  'function editPlayerName(playerId, name){',
  '  const p = S.cur.players.find(x=>x.id===playerId);',
  '  if (!p) return;',
  "  const clean = String(name || '').trim();",
  '  if (!clean) return;',
  '  p.name = clean;',
  '  persist();',
  '  toast(\'Name updated\');',
  '}',
  'function removePlayer(playerId){',
  '  const hasHistory = S.cur.txns.some(t=>t.playerId===playerId);',
  '  if (hasHistory) return false;',
  '  S.cur.players = S.cur.players.filter(p=>p.id!==playerId);',
  '  persist();',
  '  toast(\'Player removed\');',
  '  return true;',
  '}',
].join('\n');
replaceOnce("function addPlayer(name){\n  const id = uid();\n  S.cur.players.push({ id, name:name.trim() });\n  enqueue({ action:'addPlayer', id, sessionId:S.cur.session.id, name:name.trim() });\n  persist();\n}", playerMutationHelpers, 'Player edit/remove mutations');

const newAddPlayer = [
  'function modalAddPlayer(){',
  "  const current = new Set((S.cur?.players || []).map(p => String(p.name || '').trim().toLowerCase()));",
  '  const recent = recentPlayerNames().filter(name => !current.has(name.toLowerCase()));',
  '  const recentHtml = recent.length',
  "    ? '<div style=\"margin-top:20px\"><div class=\"label\">Recent players</div><div style=\"display:flex;gap:10px;flex-wrap:wrap\">' +",
  "      recent.map(name => '<button class=\"btn-ghost\" style=\"width:auto;padding:12px 16px;font-size:14px\" data-action=\"use-recent-player\" data-name=\"' + esc(name) + '\">' + esc(name) + '</button>').join('') +",
  "      '</div></div>'",
  "    : '';",
  "  openModal('Seat a player', '<label class=\"label\">Name</label>' +",
  "    '<input class=\"input-lg\" id=\"ap-name\" placeholder=\"Player name\" autofocus />' +",
  "    recentHtml +",
  "    '<button class=\"btn\" style=\"margin-top:20px\" data-action=\"confirm-add-player\">Add to table</button>');",
  "  const inp = document.getElementById('ap-name');",
  '  inp.focus();',
  "  inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && inp.value.trim()) { addPlayer(inp.value); closeModal(); render(); } });",
  '}',
].join('\n');
html = html.replace(/function modalAddPlayer\(\)\{[\s\S]*?\n\}/, newAddPlayer);

const playerActionModals = [
  'function modalPlayerActions(playerId){',
  '  const p = S.cur.players.find(x=>x.id===playerId);',
  '  if (!p) return;',
  '  const hasHistory = S.cur.txns.some(t=>t.playerId===playerId);',
  "  openModal(esc(p.name), '<button class=\"btn-ghost\" style=\"width:100%;text-align:left;margin-bottom:10px;padding:16px 18px\" data-action=\"edit-player\" data-id=\"' + playerId + '\">Edit name</button>' +",
  "    '<button class=\"btn-ghost\" style=\"width:100%;text-align:left;margin-bottom:10px;padding:16px 18px\" data-action=\"ledger\" data-id=\"' + playerId + '\">View ledger</button>' +",
  "    '<button class=\"btn-ghost btn-danger\" style=\"width:100%;text-align:left;padding:16px 18px\" data-action=\"remove-player\" data-id=\"' + playerId + '\">Remove player</button>' +",
  "    (hasHistory ? '<p class=\"dim\" style=\"font-size:12px;line-height:1.5;margin:12px 0 0\">Players with ledger history cannot be removed. Void their buy-ins first if needed.</p>' : ''));",
  '}',
  'function modalEditPlayer(playerId){',
  '  const p = S.cur.players.find(x=>x.id===playerId);',
  '  if (!p) return;',
  "  openModal('Edit name', '<label class=\"label\">Player name</label>' +",
  "    '<input class=\"input-lg\" id=\"ep-name\" value=\"' + esc(p.name) + '\" autofocus />' +",
  "    '<button class=\"btn\" style=\"margin-top:20px\" data-action=\"confirm-edit-player\" data-id=\"' + playerId + '\">Save name</button>');",
  "  const inp = document.getElementById('ep-name');",
  '  inp.focus(); inp.select();',
  "  inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && inp.value.trim()) { editPlayerName(playerId, inp.value); closeModal(); render(); } });",
  '}',
  'function modalRemovePlayer(playerId){',
  '  const p = S.cur.players.find(x=>x.id===playerId);',
  '  if (!p) return;',
  '  const hasHistory = S.cur.txns.some(t=>t.playerId===playerId);',
  '  if (hasHistory){',
  "    openModal('Cannot remove player', '<p class=\"dim\" style=\"font-size:15px;line-height:1.6;margin:0 0 18px\">' + esc(p.name) + ' has buy-ins or cash-outs in the ledger. Remove is locked to protect the table math.</p>' +",
  "      '<button class=\"btn\" data-action=\"ledger\" data-id=\"' + playerId + '\">View ledger</button>');",
  '    return;',
  '  }',
  "  openModal('Remove player?', '<p class=\"dim\" style=\"font-size:15px;line-height:1.6;margin:0 0 18px\">Remove ' + esc(p.name) + ' from this table?</p>' +",
  "    '<button class=\"btn btn-danger\" data-action=\"confirm-remove-player\" data-id=\"' + playerId + '\">Remove player</button>' +",
  "    '<button class=\"btn-ghost\" style=\"width:100%;margin-top:10px;padding:13px\" data-action=\"close-modal\">Cancel</button>');",
  '}',
  '',
].join('\n');
replaceOnce('function modalLedger(playerId){', playerActionModals + 'function modalLedger(playerId){', 'Player action modals');

html = html.replace(/\$\{bi\.length\?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"ledger\\" data-id=\\"\$\{p\.id\}\\" title=\\"Ledger\\" aria-label=\\"Ledger\\">≡<\/button>`:''\}/, '${!guest?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"player-actions\\" data-id=\\"${p.id}\\" title=\\"Player actions\\" aria-label=\\"Player actions\\">•••</button>`:(bi.length?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"ledger\\" data-id=\\"${p.id}\\" title=\\"Ledger\\" aria-label=\\"Ledger\\">•••</button>`:\'\')}');

replaceOnce(
  "  if (a==='confirm-add-player'){\n    const name = document.getElementById('ap-name').value;\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }",
  "  if (a==='confirm-add-player'){\n    const name = document.getElementById('ap-name').value;\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }\n  if (a==='use-recent-player'){\n    const name = el.dataset.name || '';\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }",
  'Recent player click handler'
);

replaceOnce(
  "  if (a==='buyin'){ modalBuyIn(el.dataset.id); return; }",
  "  if (a==='player-actions'){ modalPlayerActions(el.dataset.id); return; }\n  if (a==='edit-player'){ modalEditPlayer(el.dataset.id); return; }\n  if (a==='confirm-edit-player'){ const name = document.getElementById('ep-name').value; if (name.trim()){ editPlayerName(el.dataset.id, name); closeModal(); render(); } return; }\n  if (a==='remove-player'){ modalRemovePlayer(el.dataset.id); return; }\n  if (a==='confirm-remove-player'){ if (removePlayer(el.dataset.id)){ closeModal(); render(); } return; }\n  if (a==='buyin'){ modalBuyIn(el.dataset.id); return; }",
  'Player action handlers'
);

const outDir = 'public';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
fs.writeFileSync(path.join(outDir, 'index.html'), html);

for (const asset of ['icon.svg', 'apple-touch-icon.png']) {
  if (fs.existsSync(asset)) {
    fs.copyFileSync(asset, path.join(outDir, asset));
  }
}

console.log('Patched startup, mobile UI, Wise home actions, player actions, recent players, table health, and wrote static output to public/.');
