const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Colors
content = content.replace(/stone-/g, 'zinc-');
content = content.replace(/amber-500/g, 'lime-400');
content = content.replace(/amber-400/g, 'lime-300');
content = content.replace(/amber-950/g, 'lime-950');
content = content.replace(/amber-900/g, 'lime-900');

// Backgrounds
content = content.replace(/bg-gradient-to-br from-zinc-900 to-black/g, 'bg-transparent');
content = content.replace(/bg-zinc-900\/50/g, 'glass-card');
content = content.replace(/bg-zinc-900/g, 'glass-card');

// Borders
content = content.replace(/border-zinc-800/g, 'border-white/5');

// Rounded corners
content = content.replace(/rounded-2xl/g, 'rounded-3xl');
content = content.replace(/rounded-xl/g, 'rounded-2xl');

// Bottom Nav
content = content.replace(/fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-white\/5/g, 'fixed bottom-0 left-0 right-0 glass-nav pb-safe');

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated');
