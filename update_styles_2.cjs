const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Colors
content = content.replace(/amber-100/g, 'lime-100');
content = content.replace(/amber-200/g, 'lime-200');
content = content.replace(/amber-300/g, 'lime-300');
content = content.replace(/amber-400/g, 'lime-400');
content = content.replace(/amber-500/g, 'lime-500');
content = content.replace(/amber-600/g, 'lime-600');
content = content.replace(/amber-700/g, 'lime-700');
content = content.replace(/amber-800/g, 'lime-800');
content = content.replace(/amber-900/g, 'lime-900');
content = content.replace(/amber-950/g, 'lime-950');

// Replace specific rgba shadows
content = content.replace(/rgba\(245,158,11,0\.2\)/g, 'rgba(163,230,53,0.2)');
content = content.replace(/rgba\(245,158,11,0\.3\)/g, 'rgba(163,230,53,0.3)');

// Replace btn-battle with btn-primary for main actions
content = content.replace(/btn-battle bg-lime-400\/20 border-lime-400\/50 text-lime-100/g, 'btn-primary');
content = content.replace(/btn-battle bg-red-500\/20 border-red-500\/50 text-red-100/g, 'btn-secondary');
content = content.replace(/btn-battle/g, 'btn-secondary');

// Replace some specific classes for a more modern look
content = content.replace(/bg-zinc-800/g, 'bg-zinc-900/80');
content = content.replace(/border-white\/10/g, 'border-white/5');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated again');
