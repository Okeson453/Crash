#!/usr/bin/env node
/**
 * Phase 2 smoke acceptance against a running API (default http://127.0.0.1:8081).
 * Usage: node scripts/phase2-acceptance.mjs
 */
import crypto from 'node:crypto';
import { URLSearchParams } from 'node:url';

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:8081';
const BOT = process.env.TELEGRAM_BOT_TOKEN || '123456:ABC-DEF';

async function req(method, path, body, token) {
  const headers = { Accept: 'application/json' };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function initData(userId = 9001) {
  const user = JSON.stringify({ id: userId, first_name: 'Smoke', username: 'smoke' });
  const pairs = { auth_date: String(Math.floor(Date.now() / 1000)), user };
  const dataCheck = Object.keys(pairs).sort().map((k) => `${k}=${pairs[k]}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
  pairs.hash = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams(pairs).toString();
}

const results = [];
function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const health = await req('GET', '/api/v1/health');
ok('health', health.status === 200 && health.data?.data?.status === 'healthy', health.status);

const bad = await req('POST', '/api/v1/auth/telegram', { initData: 'bad' });
ok('auth invalid', bad.status === 401, bad.data?.error?.code);

const auth = await req('POST', '/api/v1/auth/telegram', { initData: initData() });
const tokens = auth.data?.data?.tokens;
ok('auth valid', auth.status === 200 && tokens?.accessToken, auth.status);

const me = await req('GET', '/api/v1/auth/me', undefined, tokens?.accessToken);
ok('auth me', me.status === 200, me.status);

const state = await req('GET', '/api/v1/game/state');
ok('game state', state.status === 200 && state.data?.data?.phase, state.data?.data?.phase);

const admin = await req('GET', '/api/v1/admin/session', undefined, tokens?.accessToken);
ok('rbac player forbidden', admin.status === 403, admin.status);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
