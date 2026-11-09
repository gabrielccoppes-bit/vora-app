// Depois do "expo export -p web": deixa o site instalável (PWA) e pronto para o GitHub Pages.
// Uso: node scripts/web-pwa.mjs /vora-app
import fs from 'node:fs';

const base = process.argv[2] ?? '';
const arq = 'dist/index.html';
let html = fs.readFileSync(arq, 'utf8');
const tags = [
  `<link rel="manifest" href="${base}/manifest.webmanifest">`,
  `<meta name="theme-color" content="#0E0B0A">`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
  `<meta name="apple-mobile-web-app-title" content="Vora">`,
  `<meta name="description" content="Freelancers para restaurantes, bares e casas noturnas de Porto Alegre.">`,
].join('');
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `${tags}</head>`);
html = html.replace(/<html lang="[^"]*"/, '<html lang="pt-BR"');
fs.writeFileSync(arq, html);
fs.copyFileSync(arq, 'dist/404.html'); // rotas do app no GitHub Pages
fs.writeFileSync('dist/.nojekyll', '');
console.log('PWA ok');
