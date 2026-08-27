#!/usr/bin/env node
// search-structure — search estructural AST-lite (regex sobre extensiones de código).
// Reemplaza ast-grep: sin parser full, patrones simples vía regex.
// Uso: search-structure [-d DIR] PATTERN
// Salida: path:line:col:content (formato parseStructural de engine.js)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CODE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.java', '.rs', '.rb', '.php', '.c', '.h', '.cpp', '.hpp', '.cs', '.swift', '.kt', '.vue', '.svelte', '.yml', '.yaml', '.json', '.toml', '.sh', '.html', '.css']);
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'vendor', '.next', '__pycache__']);

export function run(argv = [], input = '') {
  const logs = [];
  const errs = [];
  const clog = console.log.bind(console);
  const cerr = console.error.bind(console);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errs.push(a.join(' '));
  try {
    const code = main(argv);
    return { code, out: logs.join('\n') + (logs.length ? '\n' : ''), err: errs.join('\n') + (errs.length ? '\n' : '') };
  } finally {
    console.log = clog;
    console.error = cerr;
  }
}

function main(argv) {
  let dir = '.';
  let pattern;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-d') { dir = argv[++i] ?? '.'; continue; }
    if (a.startsWith('-')) { console.error(`search-structure: opcion invalida ${a}`); return 1; }
    if (pattern === undefined) pattern = a;
  }
  if (!pattern) {
    console.error('search-structure: falta PATTERN (uso: search-structure [-d DIR] PATTERN)');
    return 1;
  }
  let re;
  try { re = new RegExp(pattern); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }

  function walk(p, out) {
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp, out);
      else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) out.push(fp);
    }
  }
  const files = [];
  walk(dir, files);
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = re.exec(lines[i]);
      if (m) console.log(`${f}:${i + 1}:${m.index + 1}:${lines[i]}`);
    }
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out, err } = run(process.argv.slice(2));
  if (out) process.stdout.write(out);
  if (err) process.stderr.write(err);
  process.exit(code);
}