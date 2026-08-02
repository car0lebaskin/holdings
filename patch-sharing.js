const fs = require('fs');

const sourceFile = 'index.html';
let html = fs.readFileSync(sourceFile, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!html.includes(needle)) {
    if (replacement && html.includes(replacement)) return;
    throw new Error(label + ' patch target not found in index.html');
  }
  html = html.replace(needle, replacement);
}

const startupTarget = "if (!S.apiUrl) { S.demo = true; store.set('pl_demo','1'); S.view = 'home'; }";
const startupReplacement = `${startupTarget}

/* Invite links carry the host's public Apps Script endpoint in the URL fragment.
   Fragments stay client-side and are not sent to Vercel in the HTTP request. */
const inviteHash = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
const inviteQuery = new URLSearchParams(location.search);
const inviteCode = String(inviteHash.get('join') || inviteQuery.get('join') || '').trim().toUpperCase();
const inviteApi = String(inviteHash.get('api') || inviteQuery.get('api') || '').trim();
if (inviteCode && inviteApi && /^https:\/\/script\.google(usercontent)?\.com\//.test(inviteApi)) {
  S.apiUrl = inviteApi;
  store.set('pl_api', inviteApi);
  S.demo = false;
  store.del('pl_demo');
  S.view = 'home';
}
S.pendingInviteCode = inviteCode;`;
replaceOnce(startupTarget, startupReplacement, 'Invite startup');

const shareTarget = `  if (a==='share-code'){
    const code = S.cur.session.code;
    const text = \`Join my poker table on Holdings — code \${code}\`;
    if (navigator.share){ navigator.share({title:'Holdings', text}).catch(()=>{}); }
    else { try{ await navigator.clipboard.writeText(code); el.textContent='Copied'; setTimeout(()=>el.textContent='Share',1500);}catch(_){}}
    return;
  }`;

const shareReplacement = `  if (a==='share-code'){
    const code = S.cur.session.code;
    if (!S.apiUrl){ toast('Connect cloud sync before sharing'); return; }
    const invite = new URL(window.location.href);
    invite.search = '';
    invite.hash = new URLSearchParams({ join:code, api:S.apiUrl }).toString();
    const inviteUrl = invite.toString();
    const text = \`Join my poker table on Holdings — code \${code}\`;
    if (navigator.share){
      navigator.share({title:'Holdings', text, url:inviteUrl}).catch(()=>{});
    } else {
      try{
        await navigator.clipboard.writeText(\`\${text}\\n\${inviteUrl}\`);
        el.textContent='Copied';
        setTimeout(()=>el.textContent='Share',1500);
      }catch(_){ toast('Could not copy invite link'); }
    }
    return;
  }`;
replaceOnce(shareTarget, shareReplacement, 'Share invite');

const bootTarget = `/* ── boot ── */
render();
if (S.view==='home') loadHome();
if (S.cur && S.queue.length && S.view!=='config'){ S.view='session'; render(); flush(); }`;

const bootReplacement = `/* ── boot ── */
if (S.pendingInviteCode && S.apiUrl){
  const code = S.pendingInviteCode;
  S.pendingInviteCode = '';
  history.replaceState(null, '', location.pathname);
  joinByCode(code);
} else {
  render();
  if (S.view==='home') loadHome();
  if (S.cur && S.queue.length && S.view!=='config'){ S.view='session'; render(); flush(); }
}`;
replaceOnce(bootTarget, bootReplacement, 'Invite boot');

const required = [
  "navigator.share({title:'Holdings', text, url:inviteUrl})",
  "S.pendingInviteCode = inviteCode",
  "joinByCode(code)",
  "new URLSearchParams({ join:code, api:S.apiUrl })",
];
for (const token of required) {
  if (!html.includes(token)) throw new Error('Sharing patch verification failed: ' + token);
}

fs.writeFileSync(sourceFile, html);
console.log('Applied shareable invite link patch');
