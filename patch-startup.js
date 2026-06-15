const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const before = "if (!S.apiUrl) S.view = S.demo ? 'home' : 'config';";
const after = "if (!S.apiUrl) { S.demo = true; store.set('pl_demo','1'); S.view = 'home'; }";

if (!html.includes(before) && !html.includes(after)) {
  throw new Error('Startup Apps Script prompt logic not found in index.html');
}

html = html.replace(before, after);
fs.writeFileSync(file, html);
console.log('Patched startup: app now opens Home in local mode instead of forcing Apps Script config.');
