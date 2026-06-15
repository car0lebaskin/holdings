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
  '  /* mobile polish patch */',
  '  .hero{overflow:hidden}',
  '  .hero .fig{display:flex;align-items:baseline;gap:10px;white-space:nowrap;font-size:clamp(42px, 14vw, 62px);max-width:100%;overflow:hidden}',
  '  .hero .fig .c{font-size:clamp(20px, 7vw, 28px);margin-right:0;flex:0 0 auto}',
  '  .hero .sub{display:grid;grid-template-columns:1fr 1fr 0.82fr;gap:10px}',
  '  .hero .sub .s{min-width:0;padding:12px}',
  '  .hero .sub .s b{font-size:clamp(16px, 5vw, 18px);word-break:break-word}',
  '  #toast{max-width:calc(100vw - 48px);padding:12px 18px;gap:12px;align-items:center;line-height:1.25;text-align:left}',
  '  #toast .tick{width:26px;height:26px;min-width:26px;flex:0 0 26px;font-size:15px;font-weight:900;line-height:1}',
  '  @media (max-width:420px){',
  '    .wrap{padding-left:18px;padding-right:18px}',
  '    .hero{padding:20px 18px}',
  '    .hero .sub{gap:8px}',
  '    .hero .sub .s{border-radius:15px;padding:11px 10px}',
  '    .hero .sub .s span{font-size:11.5px}',
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
  "  if (/^\\d{4}-\\d{2}-\\d{2}T/.test(v)) return '';",
  "  if (/^\\d{4}-\\d{2}-\\d{2}/.test(v)) return '';",
  "  if (v.length > 22) return v.slice(0, 22) + '…';",
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
replaceOnce('${esc(ses.title)}${ses.stakes?` · ${esc(cur)} ${esc(ses.stakes)}`:\'\'}${guest?\' · watching\':\'\'}', '${esc(ses.title)}${shownStakes?` · ${esc(cur)} ${esc(shownStakes)}`:\'\'}${guest?\' · watching\':\'\'}', 'Hero stakes cleanup');

replaceOnce('    </div>\n\n    ${myBanner}', '    </div>\n\n    ${tableHealthBanner(t, discrepancy, cur)}\n    ${myBanner}', 'Table health placement');

html = html.replace(/\n    \$\{discrepancy!==null && discrepancy!==0 \? `<div class="banner warn">[\s\S]*?\n    \$\{discrepancy===0 \? `<div class="banner ok">Bank reconciled — every chip accounted for\.<\/div>` : ''\}/, '');

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

replaceOnce(
  "  if (a==='confirm-add-player'){\n    const name = document.getElementById('ap-name').value;\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }",
  "  if (a==='confirm-add-player'){\n    const name = document.getElementById('ap-name').value;\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }\n  if (a==='use-recent-player'){\n    const name = el.dataset.name || '';\n    if (name.trim()){ addPlayer(name); closeModal(); render(); }\n    return;\n  }",
  'Recent player click handler'
);

const outDir = 'public';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
fs.writeFileSync(path.join(outDir, 'index.html'), html);

for (const asset of ['icon.svg', 'apple-touch-icon.png']) {
  if (fs.existsSync(asset)) {
    fs.copyFileSync(asset, path.join(outDir, asset));
  }
}

console.log('Patched startup, mobile hero sizing, toast sizing, recent players, table health, and wrote static output to public/.');
