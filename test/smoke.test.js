// test/smoke.test.js — smoke end-to-end (reemplaza test/smoke.sh + engine/test-e2e.sh)
// 1) pipeline search-code → assemble-context 2) CLI CQP completo 3) MCP stdio
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine', 'engine.js');
const MCP = path.join(ROOT, 'engine', 'mcp-server.js');

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

test('smoke: pipeline search-code → assemble-context (tier presente)', () => {
  const raw = execFileSync(path.join(ROOT, 'scripts', 'search-code.js'), ['-l', '-d', path.join(ROOT, 'engine'), 'parseAST'], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.ok(raw.trim().length > 0, 'search-code encuentra parseAST');
  const rows = raw.split('\n').filter(Boolean)
    .map((p) => JSON.stringify({ path: p, line_start: 1, line_end: 1, match_type: 'filename', score: 1, token_estimate: 5, source: 'search-code', reason: 'smoke' }))
    .join('\n') + '\n';
  const out = execFileSync(path.join(ROOT, 'scripts', 'assemble-context.js'), ['2000'], {
    cwd: ROOT, input: rows, encoding: 'utf8',
  });
  assert.ok(out.includes('"tier"'), 'assemble-context emite tier');
});

test('smoke: CLI CQP rg-path (FORCE_PLAN=A) devuelve resultados por rg', () => {
  const out = execFileSync('node', [ENGINE, 'FIND definitions OF symbol ripgrep'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, FORCE_PLAN: 'A' },
  });
  const res = JSON.parse(out);
  assert.ok(Array.isArray(res.results), 'results debe ser array');
  assert.ok(res.results.length >= 1, `esperado >=1 resultado, got ${res.results.length}`);
});

test('smoke: CLI CQP index-path (CF_INDEX=1) consulta catálogo node:sqlite', () => {
  const out = execFileSync('node', [ENGINE, 'FIND definitions OF symbol parseCQP'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CF_INDEX: '1' },
  });
  const res = JSON.parse(out);
  assert.ok(Array.isArray(res.results), 'results debe ser array');
  assert.ok(res.results.length >= 1, `esperado >=1 resultado, got ${res.results.length}`);
  assert.ok(res.results.some((r) => r.path.includes('engine/cqp.js')), 'GT engine/cqp.js presente');
});

test('smoke: MCP stdio initialize + search_files', async () => {
  const child = spawn('node', [MCP], { stdio: ['pipe', 'pipe', 'pipe'] });
  const rl = readline.createInterface({ input: child.stdout });
  const messages = [];
  rl.on('line', (l) => { try { messages.push(JSON.parse(l)); } catch {} });
  const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    await wait(600);
    const init = messages.find((m) => m.id === 1);
    assert.ok(init?.result?.serverInfo?.name === 'cge-lite', 'serverInfo.name === cge-lite');
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_files', arguments: { pattern: 'ripgrep', dir: ROOT } } });
    await wait(2500);
    const call = messages.find((m) => m.id === 2);
    assert.ok(call?.result?.content?.[0]?.text?.length > 0, 'search_files devuelve texto');
  } finally {
    child.kill();
  }
});
