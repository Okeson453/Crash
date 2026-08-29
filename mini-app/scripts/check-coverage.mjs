import { readFileSync } from 'node:fs';
const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'));
const thresholds = { 'src/utils/': 90, 'src/lib/': 80, 'src/hooks/': 70, 'src/api/': 60, 'src/components/ui/': 80, 'src/stores/': 60 };
let failed = false;
for (const [prefix, minimum] of Object.entries(thresholds)) {
  const entries = Object.entries(summary).filter(([file]) => file.replaceAll('\\', '/').includes(prefix));
  if (!entries.length) { console.error(`Missing coverage data for ${prefix}`); failed = true; continue; }
  for (const [file, data] of entries) if (typeof data.lines?.pct === 'number' && data.lines.pct < minimum) { console.error(`Coverage ${file}: ${data.lines.pct}% < ${minimum}%`); failed = true; }
}
if (failed) process.exit(1);
console.log('Coverage thresholds passed');
