import { readdirSync, statSync } from 'node:fs';
const limits = { index: 300, vendor: 500, charts: 250, socket: 100, query: 80 };
const files = readdirSync('dist/assets').filter((file) => file.endsWith('.js'));
let failed = false;
for (const file of files) {
  const key = Object.keys(limits).find((name) => file.startsWith(`${name}-`));
  if (!key) continue;
  const kb = statSync(`dist/assets/${file}`).size / 1024;
  if (kb > limits[key]) { console.error(`${file}: ${kb.toFixed(1)}KB > ${limits[key]}KB`); failed = true; }
}
if (failed) process.exit(1);
console.log('Bundle limits passed');
