const fs = require('fs');
const path = require('path');

const file = path.join('public', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const oldMenu = '${bi.length?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"ledger\\" data-id=\\"${p.id}\\" title=\\"Ledger\\" aria-label=\\"Ledger\\">≡</button>`:\'\'}';
const newMenu = '${!guest?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"player-actions\\" data-id=\\"${p.id}\\" title=\\"Player actions\\" aria-label=\\"Player actions\\">•••</button>`:(bi.length?`<button class=\\"x\\" style=\\"flex:none\\" data-action=\\"ledger\\" data-id=\\"${p.id}\\" title=\\"Ledger\\" aria-label=\\"Ledger\\">•••</button>`:\'\')}';

if (!html.includes(oldMenu) && !html.includes('data-action=\\"player-actions\\"')) {
  throw new Error('Player menu target not found in public/index.html');
}

html = html.replace(oldMenu, newMenu);
fs.writeFileSync(file, html);
console.log('Patched player menu button to open action sheet.');
