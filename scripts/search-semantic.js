#!/usr/bin/env node
// search-semantic — degradado en cge-lite: requiere motor ML externo (probe), no incluido.
// Contrato: NDJSON de hits en stdout; sin modelo → exit 1 sin output (sin resultados).
import { pathToFileURL } from 'node:url';

export function run() {
  return { code: 1, out: '', err: '' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run().code);
}