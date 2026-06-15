const fs = require('fs');
const path = require('path');

const sourceFile = 'index.html';
let html = fs.readFileSync(sourceFile, 'utf8');

const before = "if (!S.apiUrl) S.view = S.demo ? 'home' : 'config';";
const after = "if (!S.apiUrl) { S.demo = true; store.set('pl_demo','1'); S.view = 'home'; }";

if (!html.includes(before) && !html.includes(after)) {
  throw new Error('Startup Apps Script prompt logic not found in index.html');
}

html = html.replace(before, after);

const outDir = 'public';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
fs.writeFileSync(path.join(outDir, 'index.html'), html);

for (const asset of ['icon.svg', 'apple-touch-icon.png']) {
  if (fs.existsSync(asset)) {
    fs.copyFileSync(asset, path.join(outDir, asset));
  }
}

console.log('Patched startup and wrote static output to public/.');
