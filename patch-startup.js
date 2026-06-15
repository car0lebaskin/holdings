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

const recentHelpers = String.raw`function recentPlayerNames(){
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };
  if (S.cur && S.cur.players) S.cur.players.forEach(p => add(p.name));
  Object.values(lsSessions())
    .sort((a,b) => String(b.session?.startedAt || '').localeCompare(String(a.session?.startedAt || '')))
    .forEach(st => (st.players || []).forEach(p => add(p.name)));
  (S.home.leaderboard || []).forEach(p => add(p.name));
  return out.slice(0, 12);
}

`;
replaceOnce('/* home data built from on-device sessions (local mode / no Sheet yet) */', recentHelpers + '/* home data built from on-device sessions (local mode / no Sheet yet) */', 'Recent player helpers');

const healthHelper = String.raw`function tableHealthBanner(t, discrepancy, cur){
  if (!t.activeCount) return '';
  if (discrepancy === null) {
    return `<div class="banner sync"><b>Table live</b><br><span class="num">${fmt(t.buyIn,cur)}</span> in · <span class="num">${fmt(t.onTable,cur)}</span> on table · ${t.outCount}/${t.activeCount} cashed out</div>`;
  }
  if (discrepancy === 0) {
    return `<div class="banner ok"><b>Bank balanced</b><br><span class="num">${fmt(t.buyIn,cur)}</span> in · <span class="num">${fmt(t.cashOut,cur)}</span> out</div>`;
  }
  return `<div class="banner warn"><b>${fmt(Math.abs(discrepancy),cur)} ${discrepancy>0?'overpaid':'missing'}</b><br>${discrepancy>0?'Cash-outs exceed buy-ins.':'Chips are unaccounted for.'} Recount before settling.</div>`;
}

`;
replaceOnce('/* ── SESSION VIEW ── */', healthHelper + '/* ── SESSION VIEW ── */', 'Table health helper');

replaceOnce(String.raw`    </div>

    ${myBanner}`, String.raw`    </div>

    ${tableHealthBanner(t, discrepancy, cur)}
    ${myBanner}`, 'Table health placement');

replaceOnce(String.raw`    ${discrepancy!==null && discrepancy!==0 ? `<div class="banner warn">
      Bank is off by <b class="num">${fmt(Math.abs(discrepancy),cur)}</b> —
      ${discrepancy>0?'cash-outs exceed buy-ins.':'chips are unaccounted for.'} Recount stacks before settling.
    </div>` : ''}
    ${discrepancy===0 ? `<div class="banner ok">Bank reconciled — every chip accounted for.</div>` : ''}`, '', 'Old reconciliation banners');

const oldAddPlayer = String.raw`function modalAddPlayer(){
  openModal('Seat a player', `
    <label class="label">Name</label>
    <input class="input-lg" id="ap-name" placeholder="Player name" autofocus />
    <button class="btn" style="margin-top:20px" data-action="confirm-add-player">Add to table</button>
  `);
  const inp = document.getElementById('ap-name');
  inp.focus();
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && inp.value.trim()) { addPlayer(inp.value); closeModal(); render(); } });
}`;

const newAddPlayer = String.raw`function modalAddPlayer(){
  const current = new Set((S.cur?.players || []).map(p => String(p.name || '').trim().toLowerCase()));
  const recent = recentPlayerNames().filter(name => !current.has(name.toLowerCase()));
  const recentHtml = recent.length
    ? '<div style="margin-top:20px"><div class="label">Recent players</div><div style="display:flex;gap:10px;flex-wrap:wrap">' +
      recent.map(name => '<button class="btn-ghost" style="width:auto;padding:12px 16px;font-size:14px" data-action="use-recent-player" data-name="' + esc(name) + '">' + esc(name) + '</button>').join('') +
      '</div></div>'
    : '';
  openModal('Seat a player', `
    <label class="label">Name</label>
    <input class="input-lg" id="ap-name" placeholder="Player name" autofocus />
    ${recentHtml}
    <button class="btn" style="margin-top:20px" data-action="confirm-add-player">Add to table</button>
  `);
  const inp = document.getElementById('ap-name');
  inp.focus();
  inp.addEventListener('keydown', e=>{ if(e.key==='Enter' && inp.value.trim()) { addPlayer(inp.value); closeModal(); render(); } });
}`;
replaceOnce(oldAddPlayer, newAddPlayer, 'Recent players modal');

replaceOnce(String.raw`  if (a==='confirm-add-player'){
    const name = document.getElementById('ap-name').value;
    if (name.trim()){ addPlayer(name); closeModal(); render(); }
    return;
  }`, String.raw`  if (a==='confirm-add-player'){
    const name = document.getElementById('ap-name').value;
    if (name.trim()){ addPlayer(name); closeModal(); render(); }
    return;
  }
  if (a==='use-recent-player'){
    const name = el.dataset.name || '';
    if (name.trim()){ addPlayer(name); closeModal(); render(); }
    return;
  }`, 'Recent player click handler');

const outDir = 'public';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
fs.writeFileSync(path.join(outDir, 'index.html'), html);

for (const asset of ['icon.svg', 'apple-touch-icon.png']) {
  if (fs.existsSync(asset)) {
    fs.copyFileSync(asset, path.join(outDir, asset));
  }
}

console.log('Patched startup, recent players, table health, and wrote static output to public/.');
