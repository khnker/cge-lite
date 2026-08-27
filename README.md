# cge-lite

Motor de query de contexto cost-aware para agentes LLM. Fork liviano de
**context-query-engine** con una diferencia estructural: **cero dependencias de
herramientas de OS** — todo el pipeline corre sobre lógica JavaScript pura
(Node stdlib) + un único paquete npm portable.

```
CQP/intención natural → parse → interpret → optimizer (plan físico + cost model)
  → operadores → fusión (dedup + RRF + rerank + budget + tiers) → evidencia
```

## Origen (fork)

| | |
|---|---|
| Proyecto original | [khnker/context-query-engine](https://github.com/khnker/context-query-engine) |
| SHA de referencia | `111c0b3` (2026-08-18) |
| Versión origen | v1.4.0 |
| Licencia origen | ISC |

### Qué se eliminó / reemplazó

| OS tool (original) | Reemplazo en cge-lite |
|---|---|
| `rg` (binario del sistema) | `@vscode/ripgrep` — el binario rg real, descargado/instalado vía npm, portable, **no requiere rg en el sistema** |
| `scripts/*` bash (search-code, extract-context, assemble-context, project-map…) | scripts Node con shebang y el mismo contrato CLI (`.js` en `scripts/`) |
| `awk` (extract-context) | `fs.readFileSync` + split de líneas |
| `jq` (assemble-context, inspect, metrics) | lógica JS directa |
| `ast-grep` (search-structure) | regex AST-lite sobre extensiones de código (`scripts/search-structure`) |
| `fd` + `tokei` (project-map) | no incluido — walk `fs` si se necesita |
| `probe` / ML externo (`local-model.js`) | eliminado — `search-semantic` degrada a 0 resultados; reranker ML fuera |
| `smoke.sh` / `test-e2e.sh` (bash) | `test/smoke.test.js` (node --test) |

Se conserva el operador `git-log` (follow-history) vía `child_process` — es la
única dependencia de sistema que queda y es una decisión explícita. Sin git, el
operador devuelve 0 resultados sin crash.

## Requisitos

- Node.js **≥ 22.5.0** (índice persistente usa `node:sqlite`; estable sin flag en 23+)
- `git` **opcional** — solo si quieres evidencia de historial (`git-log` operator)
- npm (única dependencia: `@vscode/ripgrep`)

## Setup

```bash
npm install
npm test
```

## Uso

CLI (CQP):
```bash
node engine/engine.js 'FIND definitions OF symbol parseConfig' --stats
```

CLI (intención natural):
```bash
node engine/engine.js --intent 'dónde está definido parseConfig'
```

MCP server (stdio, JSON-RPC 2.0, cero deps):
```bash
node engine/mcp-server.js
```
Tools: `context_query` (CQP o lenguaje natural), `search_files`, `read_file`.

## Arquitectura

```
engine/
  cqp.js            parser CQP (FIND…AND…LIMIT)
  interpreter.js    intención natural → query_type + confidence (heurística; ML opt-in vía CF_MODEL_CMD)
  optimizer.js      planes físicos + cost model + telemetría
  engine.js         ejecución ordenada de ops + fusión + cache intra-sesión
  selector.js       selección submodular bajo budget (CF_SELECTOR=marginal|mmr)
  rrf.js / bm25.js / soundex.js   fusión RRF, BM25 propio, fallback fonético
  ir.js / federated.js / retriever.js   plano IR, retrieval federado, framework retriever
  index-layer/      índice persistente v1.8 (node:sqlite WAL): extractors, indexer, store, manifest, watcher
  mcp-server.js     MCP stdio
scripts/            CLIs Node (mismo contrato que los bash originales)
test/               node --test (6 unit + smoke e2e)
```

Flags de entorno relevantes (heredados del original): `CF_BUDGET`,
`CF_INDEX=1` (catálogo SQLite), `CF_RRF=1`, `CF_SELECTOR=marginal|mmr`,
`CF_SOUNDEX=1`, `CF_ABSTAIN=1`, `CF_ADAPTIVE=1`, `CF_VOI=1`, `CF_RETRIEVAL=bm25|hybrid`,
`CF_SEARCH_NO_IGNORE=1`. Ver comentarios en `engine/engine.js`.

## No incluido (a propósito)

- `evals/`, `agent-context-engineering/`, experimentos `context-pack*` — investigación del original
- `project-map`, `search-semantic` (requieren binaries externos; semántica degrada sin modelo)
- tests que dependían de fixtures de `evals/` (`adaptive`, `bench`) y de `local-model`
- `scripts/download-binaries.sh` — innecesario: el único binario viene de npm

## Licencia

MIT (ver `LICENSE`). Fork de context-query-engine, originalmente ISC — el
código derivado conserva su copyright original; nuevo código bajo MIT.
