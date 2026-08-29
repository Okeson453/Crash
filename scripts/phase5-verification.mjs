#!/usr/bin/env node
/**
 * Phase 5 production verification runner.
 * Executes the acceptance matrix available in this environment and writes a report.
 *
 * Usage: node scripts/phase5-verification.mjs
 * Exit 0 only if required gates pass.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function run(name, cmd, args, opts = {}) {
  const cwd = opts.cwd ? join(root, opts.cwd) : root;
  console.log(`\n▶ ${name}\n  $ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
      ...opts.env,
    },
    timeout: opts.timeout ?? 300_000,
  });
  const ok = res.status === 0;
  results.push({
    name,
    ok,
    status: res.status,
    required: opts.required !== false,
    stdoutTail: (res.stdout || '').slice(-1500),
    stderrTail: (res.stderr || '').slice(-1500),
  });
  if (!ok) {
    console.log(`  ✗ FAILED (exit ${res.status})`);
    if (res.stderr) console.log(res.stderr.slice(-800));
  } else {
    console.log(`  ✓ PASS`);
  }
  return ok;
}

console.log('CrashWave Phase 5 verification');
console.log('==============================');

// 1–2 Dependency install
run('Backend npm ci', 'npm', ['ci', '--no-audit', '--no-fund'], { required: true, timeout: 180_000 });
if (existsSync(join(root, 'mini-app/package.json'))) {
  run('Mini App npm ci', 'npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: 'mini-app',
    required: true,
    timeout: 180_000,
  });
}
if (
  existsSync(join(root, 'admin-dashboard/package.json')) &&
  existsSync(join(root, 'admin-dashboard/package-lock.json'))
) {
  run('Admin dashboard npm ci', 'npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: 'admin-dashboard',
    required: false,
    timeout: 180_000,
  });
} else {
  results.push({
    name: 'Admin dashboard npm ci',
    ok: false,
    status: null,
    required: false,
    stdoutTail: '',
    stderrTail: 'Skipped — package-lock.json missing',
  });
  console.log('\n▶ Admin dashboard npm ci\n  ⊘ SKIPPED (no package-lock.json)');
}

// Typecheck
run('Backend typecheck', 'npx', ['tsc', '--noEmit', '-p', 'tsconfig.build.json'], { required: true });
run('Mini App typecheck', 'npx', ['tsc', '--noEmit'], { cwd: 'mini-app', required: true });

// Lint (non-fatal if max-warnings issues in legacy code — still report)
run('Backend lint', 'npm', ['run', 'lint'], { required: false });
run('Mini App lint', 'npm', ['run', 'lint'], { cwd: 'mini-app', required: false });

// Unit tests — required gate is security + referrals (Phase 5 acceptance)
run(
  'Security + referral unit suite',
  'npx',
  [
    'jest',
    '--testPathPattern=tests/unit/(security|referrals)',
    '--passWithNoTests',
    '--runInBand',
    '--ci',
  ],
  { required: true, timeout: 180_000 }
);
run(
  'Backend unit tests (full)',
  'npx',
  ['jest', '--testPathPattern=tests/unit', '--passWithNoTests', '--runInBand', '--ci'],
  { required: false, timeout: 600_000 }
);
run('Mini App unit tests', 'npm', ['run', 'test'], { cwd: 'mini-app', required: false, timeout: 180_000 });

// Build
run('Backend build', 'npm', ['run', 'build'], { required: true });
run('Mini App build', 'npm', ['run', 'build'], { cwd: 'mini-app', required: true, timeout: 180_000 });

// Security audit (npm)
run('npm audit (backend)', 'npm', ['audit', '--audit-level=high'], { required: false });

// Docker build (optional — needs docker daemon)
const docker = spawnSync('docker', ['info'], { encoding: 'utf8' });
if (docker.status === 0) {
  run('Docker image build', 'docker', ['build', '-t', 'crashwave:phase5', '.'], {
    required: false,
    timeout: 600_000,
  });
} else {
  results.push({
    name: 'Docker image build',
    ok: false,
    status: null,
    required: false,
    stdoutTail: '',
    stderrTail: 'Docker daemon not available in this environment',
  });
  console.log('\n▶ Docker image build\n  ⊘ SKIPPED (no docker daemon)');
}

// Integration / E2E require live DB — mark blocked if no DATABASE_URL
if (!process.env.DATABASE_URL) {
  results.push({
    name: 'Integration tests (live DB)',
    ok: false,
    status: null,
    required: false,
    stdoutTail: '',
    stderrTail: 'DATABASE_URL not set — verification blocked',
  });
  results.push({
    name: 'Referral E2E (live DB)',
    ok: false,
    status: null,
    required: false,
    stdoutTail: '',
    stderrTail: 'DATABASE_URL not set — verification blocked',
  });
  console.log('\n▶ Integration / live E2E\n  ⊘ BLOCKED (no DATABASE_URL)');
} else {
  run('Integration tests', 'npm', ['run', 'test:integration'], { required: false, timeout: 300_000 });
}

const requiredFailed = results.filter((r) => r.required && !r.ok);
const optionalFailed = results.filter((r) => !r.required && !r.ok);
const passed = results.filter((r) => r.ok);

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: results.length,
    passed: passed.length,
    requiredFailed: requiredFailed.length,
    optionalFailedOrBlocked: optionalFailed.length,
    overall: requiredFailed.length === 0 ? 'PASS' : 'FAIL',
  },
  results,
};

writeFileSync(join(root, 'PHASE_5_VERIFICATION_REPORT.json'), JSON.stringify(report, null, 2));

console.log('\n==============================');
console.log(`Overall: ${report.summary.overall}`);
console.log(`Passed: ${passed.length}/${results.length}`);
console.log(`Required failures: ${requiredFailed.length}`);
console.log(`Optional failed/blocked: ${optionalFailed.length}`);
console.log('Report: PHASE_5_VERIFICATION_REPORT.json');

if (requiredFailed.length) {
  console.log('\nRequired failures:');
  for (const f of requiredFailed) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
