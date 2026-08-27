#!/usr/bin/env node
// extract-context — imprime archivo con numeración de líneas (port de scripts/extract-context awk)
// Uso: extract-context FILE [START_LINE] [END_LINE]
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
    const code = main(argv);
    return { code, out: logs.join('\n') + (logs.length ? '\n' : ''), err: errs.join('\n') + (errs.length ? '\n' : '') };
  } finally {
    console.log = clog;
    console.error = cerr;
  }
}

function main(argv) {
  const [file, startArg = '1', endArg = ''] = argv;
  if (!file) { console.error('extract-context: falta FILE (uso: extract-context FILE [START_LINE] [END_LINE])'); return 1; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { console.error(`extract-context: archivo no existe: ${file}`); return 1; }
  if (!/^\d+$/.test(startArg) || (endArg && !/^\d+$/.test(endArg))) { console.error('extract-context: START_LINE/END_LINE deben ser numeros'); return 1; }
  const start = Number(startArg);
  const end = endArg ? Number(endArg) : Infinity;
  if (endArg && start > end) { console.error(`extract-context: START_LINE (${start}) > END_LINE (${end})`); return 1; }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop(); // awk: sin record fantasma al final
  const last = Math.min(end, lines.length);
  for (let i = start; i <= last; i++) console.log(`${i}: ${lines[i - 1]}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, out, err } = run(process.argv.slice(2));
  if (out) process.stdout.write(out);
  if (err) process.stderr.write(err);
  process.exit(code);
}