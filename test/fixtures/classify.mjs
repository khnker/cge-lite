#!/usr/bin/env node
// test/fixtures/classify.mjs — clasificador mínimo para test 11.7 (CF_MODEL_CMD).
// Reemplaza evals/ml/classify.mjs + model/classifier.json (no incluidos en cge-lite).
// Contrato: classify-query '<payload-json>' → stdout JSON {label, confidence}.
const [task, payload] = process.argv.slice(2);
if (task !== 'classify-query') process.exit(0);
const { query } = JSON.parse(payload);
const label = /caller|calls|\busa\b|uso/i.test(query) ? 'REFERENCE'
  : /defin|declar/i.test(query) ? 'SYMBOL'
  : /how|como|funcion/i.test(query) ? 'STRUCTURAL'
  : 'LEXICAL';
process.stdout.write(JSON.stringify({ label, confidence: 0.9, scores: {}, latencyMs: 1 }));
