---
name: context-engineering
description: retrieval eficiente de contexto en codebases grandes con cge-lite: queries CQP (FIND/DEFINITIONS/REFERENCES), presupuestos de tokens, escalación, anti-patterns
triggers:
  - búsqueda de símbolos/funciones/clases en el código
  - entender cómo funciona un subsystem
  - análisis de un repo grande antes de implementar
negatives:
  - tareas de escritura de código (usar coding skills)
  - conversaciones generales
---

# Context Engineering (cge-lite)

Retrieval de contexto en codebases grandes con costo mínimo usando **cge-lite**
(motor cost-aware, un solo binario: `cge-lite`; en dev: `node engine/engine.js`).

## Activación

Aplicar cuando la tarea requiere entender código existente:

- Buscar definición de un símbolo (función, clase, constante)
- Rastrear flujo: quién llama a X, qué llama X
- Mapear un módulo o subsystem antes de tocar código
- Auditar impacto de un cambio (callers de un símbolo)

No aplicar a tareas de escritura desde cero ni conversación general.

## Interfaz

| Modo | Invocación |
|---|---|
| CLI (CQP) | `cge-lite 'FIND definitions OF symbol parseConfig' --stats` |
| CLI (intención natural) | `cge-lite --intent 'dónde está definido parseConfig'` |
| MCP stdio | `cge-lite mcp` → tools: `context_query`, `search_files`, `read_file` |
| Dev sin binario | `node engine/engine.js '<CQP>'` |

El resultado es JSON: `results[]` (path, line_start/end, match_type, score,
token_estimate, tier, sources) + `stats` (budget, tokens_used, ops).

## Árbol de decisión de retrieval (CQP)

1. **Identifier exacto** → `FIND definitions OF symbol X` (search-code / lexical)
2. **Dónde se usa** → `FIND references OF symbol X` o `FIND usages OF symbol X`
3. **Relations** → `FIND X AND FOLLOW references` (pool de candidatos → seguimiento en archivos)
4. **Tests/config relacionados** → `... AND INCLUDE tests` / `AND INCLUDE config`
5. **Concepto difuso / subsystem** → `--intent '<descripción>'` (interpreter + optimize)
6. **Historial reciente** → `FIND "recent changes"` (operador git-log; requiere git)
7. **Nombre de archivo** → `FIND definitions OF symbol X` con `LIMIT` alto (mach filename incluido)

Regla: la query más barata que resuelva la pregunta gana. Escalar solo si no satisface.

## Escalación (niveles 0-6)

| Nivel | Condición | Acción |
|-------|-----------|--------|
| 0 | Nada encontrado | Ampliar scope (budget, quitar filtros); `--intent` para intento distinto |
| 1 | Resultados ruidosos | Anclar pattern: `"\bname\b"` en CQP (word boundary) |
| 2 | Candidato ambiguo | `FOLLOW references` para desambiguar por uso |
| 3 | Concepto difuso | `--intent` (query_type + planes múltiples) |
| 4 | Repo desconocido | Búsqueda lexical amplia + `FIND "recent changes"` (mapa por historial) |
| 5 | Presupuesto excedido | `CF_BUDGET`/`CF_SELECTOR=marginal`, detener con resultados parciales |
| 6 | Fallo total | Reportar query type y contexto parcial |

## Presupuestos de tokens

| Nivel | Presupuesto | Uso |
|-------|-------------|-----|
| S | 2000 | Snippet puntual, verificación de existencia |
| M | 8000 | Función + callers directos |
| L | 20000 | Subsystem completo |
| XL | 30000 | Análisis repo completo |

Flags: `CF_BUDGET` (default 8000), `CF_STRICT_BUDGET=1` (hard cap),
`CF_SELECTOR=marginal` (submodular). Early termination: detener cuando el
resultado satisface la pregunta; nunca exceder presupuesto sin justificación.

## Flags útiles

`CF_INDEX=1` (catálogo SQLite node:sqlite; requiere build previo),
`CF_RRF=1` (fusión RRF), `CF_ABSTAIN=1`, `CF_SOUNDEX=1`, `CF_BM25_NO_PERSIST`.

## Anti-patterns prohibidos

- Query global (`FIND X LIMIT 8000`) cuando existe scope identificable (usar `AND`/budget acotado)
- Volcar archivos completos al contexto: usar MCP `read_file` con rango de líneas del resultado
- Re-leer archivos ya leídos en la sesión (offline dedup — el motor ya dedup por path|line)
- Depender de `search-semantic`: degradado en cge-lite (0 resultados) sin motor ML externo
- Ignorar `node_modules`/`dist` — el motor los excluye por defecto (exclusions.json)
- Pegar bloques de código enteros al contexto sin filtrar (usar presupuestos S/M/L/XL)

## Verificación

- CLI smoke: `cge-lite 'FIND definitions OF symbol ripgrep'` → `results` no vacío
- MCP smoke: `cge-lite mcp` + `initialize`/`tools/list`