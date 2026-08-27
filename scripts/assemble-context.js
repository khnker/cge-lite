#!/usr/bin/env node
// assemble-context — ensamblado de contexto desde retrieval NDJSON (port de scripts/assemble-context bash+jq)
// Uso: assemble-context [BUDGET] < results.ndjson
// Pipeline: normalize -> filter -> deduplicate -> rank -> budget -> order
// Salida: stats (JSON) en stderr; items NDJSON (con "tier") en stdout.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function run(argv = [], input = '') {
  const logs = [];
  const errs = [];
  const clog = console.log.bind(console);
  const cerr = console.error.bind(console);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    const code = main(argv, input);
    return { code, out: logs.join('\n') + (logs.length ? '\n' : ''), err: errs.join('\n') + (errs.length ? '\n' : '') };
  } finally {
    console.log = clog;
    console.error = cerr;
  }
}

function main(argv, input = '') {
  const [budgetArg = '8000'] = argv;
  const BUDGET = /^\d+$/.test(budgetArg) ? Number(budgetArg) : 8000;
  const SW = Number(process.env.CF_SCORE_WEIGHT ?? (process.env.CF_MODEL_CMD ? '0.5' : '0.3')) || 0.3;

  const BAD = ['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor'];
  if (process.env.CF_INCLUDE_GENERATED === '1') BAD.splice(2, 2); // visibiliza dist/build (opt-in)
  const STRICT = process.env.CF_STRICT_BUDGET !== '0';
  const NOBUDGET = process.env.CF_SELECTOR === 'marginal' || process.env.CF_SELECTOR_RANKED_ONLY === '1';
  const TOP = Number(process.env.CF_SELECTOR_TOP ?? 200);
  const RRF_RANK = process.env.CF_RRF_RANK === '1';

  const stdin = input || (() => { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } })();
  const rawRows = stdin.split('\n').filter(Boolean);
  if (!rawRows.length) { console.error('assemble-context: error: stdin vacio (sin lineas NDJSON)'); return 1; }
  const rows = [];
  for (const l of rawRows) {
    try { rows.push(JSON.parse(l)); } catch { console.error('assemble-context: error: input no es NDJSON valido'); return 1; }
  }

  const exactness = (r) => ({ exact: 1, filename: 0.8, structural: 0.7, reference: 0.6, semantic: 0.5, test: 0.4, config: 0.3 }[r.match_type] ?? 0.5);
  const pathRelevance = (r) => ((r.match_type === 'test' && (r.path.includes('tests') || r.path.includes('spec'))) || (r.match_type === 'config' && r.path.includes('config'))) ? 0.5 : 0.3;
  const tokenEfficiency = (r) => 1 - Math.min(r.token_estimate, 400) / 400;
  const evidenceTier = (r) => ['exact', 'filename', 'structural'].includes(r.match_type) ? 0 : ['reference', 'git'].includes(r.match_type) ? 1 : r.match_type === 'semantic' ? 2 : 3;
  const tier = (r) => ['exact', 'filename'].includes(r.match_type) ? 1 : ['structural', 'reference'].includes(r.match_type) ? 2 : r.match_type === 'semantic' ? 3 : 4;
  const badPath = (p) => p.split('/').every((s) => !BAD.includes(s));

  let pool = rows
    .filter((r) => typeof r.path === 'string' && r.path.length > 0 && typeof r.line_start === 'number' && typeof r.line_end === 'number')
    .map((r) => ({
      ...r,
      path: r.path.startsWith('./') ? r.path.slice(2) : r.path,
      score: typeof r.score === 'number' ? r.score : 0.5,
      token_estimate: typeof r.token_estimate === 'number' ? r.token_estimate : (r.line_end - r.line_start + 1) * 5,
      source: r.source ?? 'unknown',
      match_type: r.match_type ?? 'semantic',
      reason: r.reason ?? '',
      symbol: r.symbol ?? null,
      language: r.language ?? null,
    }));
  for (const r of pool) r.evidence_tier = evidenceTier(r);

  pool = pool.filter((r) => (r.evidence_tier <= 1 || r.score >= 0.2) && r.token_estimate > 0 && badPath(r.path));

  const key = (r) => `${r.path}|${r.line_start}|${r.line_end}`;
  const groups = new Map();
  for (const r of pool) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  let ranked = [...groups.values()].map((g) => {
    const best = g.reduce((a, b) => (b.score > a.score ? b : a));
    return { ...best, score: Math.max(...g.map((x) => x.score)), sources: g.map((x) => x.source) };
  });

  ranked = ranked.map((r) => ({ ...r, score_final: (1 - SW - 0.2 - 0.15) * exactness(r) + SW * r.score + 0.2 * pathRelevance(r) + 0.15 * tokenEfficiency(r) }));
  ranked.sort((a, b) => (RRF_RANK ? (b.rrf ?? b.score_final) : b.score_final) - (RRF_RANK ? (a.rrf ?? a.score_final) : a.score_final));

  let items;
  let stats;
  if (NOBUDGET) {
    items = ranked.slice(0, TOP);
    stats = { budget: BUDGET, selector_top: TOP, tokens_used: items.reduce((a, r) => a + r.token_estimate, 0), kept: items.length, dropped: 0 };
  } else {
    const res = ranked.reduce((acc, c) => {
      if (acc.used + c.token_estimate <= BUDGET || (!STRICT && !acc.kept.some((k) => k.path === c.path))) {
        acc.kept.push(c);
        acc.used += c.token_estimate;
      }
      return acc;
    }, { kept: [], used: 0 });
    items = res.kept.map((c) => ({ ...c, tier: tier(c) })).sort((a, b) => a.tier - b.tier || b.score_final - a.score_final);
    stats = { budget: BUDGET, tokens_used: res.used, kept: res.kept.length, dropped: ranked.length - res.kept.length };
  }

  console.error(JSON.stringify(stats));
  for (const it of items) console.log(JSON.stringify(it));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out, err } = run(process.argv.slice(2));
  if (out) process.stdout.write(out);
  if (err) process.stderr.write(err);
  process.exit(code);
}