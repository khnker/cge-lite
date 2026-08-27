#!/usr/bin/env node
// search-code — wrapper @vscode/ripgrep (binario rg portable vía npm; no herramienta del OS)
// Uso: search-code [-d DIR] [-i] [-l] PATTERN
// Exclusiones: agent-context-engineering/config/exclusions.json si existe; si no, defaults inline.
// Exit: 0 matches, 1 sin matches (semántica rg)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getRgPath } from '../engine/rg.js';

const MODULE_BASE = import.meta.url || 'file://' + path.resolve(process.cwd()) + '/';
const SELF_DIR = fileURLToPath(new URL('.', MODULE_BASE));
const EXC_JSON = path.join(SELF_DIR, '..', 'agent-context-engineering', 'config', 'exclusions.json');
const DEFAULT_EXCLUDES = ['!node_modules/', '!.git/', '!dist/', '!build/', '!coverage/', '!vendor/', '!target/', '!__pycache__/', '!.next/'];

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
  let ci = false;
  let list = false;
  let pattern;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-d') { dir = argv[++i] ?? '.'; continue; }
    if (a === '-i') { ci = true; continue; }
    if (a === '-l') { list = true; continue; }
    if (a.startsWith('-')) { console.error(`search-code: opcion invalida ${a}`); return 1; }
    if (pattern === undefined) pattern = a; // extras tras el pattern: ignorados (compat bash)
  }
  if (!pattern) {
    console.error('search-code: falta PATTERN (uso: search-code [-d DIR] [-i] [-l] PATTERN)');
    return 1;
  }

  let excludes = DEFAULT_EXCLUDES;
  try {
    if (fs.existsSync(EXC_JSON)) {
      const exc = JSON.parse(fs.readFileSync(EXC_JSON, 'utf8'));
      const repoRoot = path.basename(path.resolve(dir));
      const merged = [...(exc.defaults ?? []), ...((exc.project_overrides ?? {})[repoRoot] ?? [])];
      if (merged.length) excludes = merged.map((p) => `!${p}/`);
    }
  } catch { /* fallback defaults */ }

  const rgArgs = [
    ...(ci ? ['-i'] : []),
    ...(list ? ['-l'] : []),
    ...(process.env.CF_SEARCH_NO_IGNORE === '1' ? ['--no-ignore'] : []),
    ...excludes.map((e) => `--glob=${e}`),
    '-n', '--', pattern, dir,
  ];
  try {
    console.log(execFileSync(getRgPath(), rgArgs, { encoding: 'utf8' }).trimEnd());
    return 0;
  } catch (e) {
    if (e.stdout) console.log(String(e.stdout).trimEnd()); // exit!=0 puede traer stdout (rg sin matches)
    return e.status ?? 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out, err } = run(process.argv.slice(2));
  if (out) process.stdout.write(out);
  if (err) process.stderr.write(err);
  process.exit(code);
}