# Instalación — cge-lite

Tres vías: **binario único** (recomendada, sin Node), **npm** (desarrollo/contribución),
**build desde source**. Ninguna depende de herramientas de OS (`rg`, `jq`, `fd`,
`awk`…); la única dependencia opcional de sistema es `git` (operador `git-log`).

## 1. Binario único (recomendado)

Descargar de [Releases](https://github.com/khnker/cge-lite/releases):

```bash
# Linux x64
curl -fsSL -o cge-lite https://github.com/khnker/cge-lite/releases/download/v1.0.0/cge-lite
chmod +x cge-lite
sudo mv cge-lite /usr/local/bin/

cge-lite 'FIND definitions OF symbol parseConfig' --stats   # CLI
cge-lite --intent 'dónde está definido parseConfig'         # intención natural
cge-lite mcp                                                # servidor MCP stdio
```

- **Sin Node ni npm en la máquina** — el runtime viene embebido en el binario.
- El binario `rg` vive embebido y se extrae a `<os.tmpdir()>/cge-lite-rg/` en el
  primer run (override: `CGE_RG_PATH=/ruta/a/rg`).
- macOS/Windows: correr el workflow **Actions → build-sea → Run workflow** en el
  repo y bajar el artifact de la plataforma (`cge-lite.exe` en Windows).

Requisitos: solo `git` **opcional** (sin él, `git-log` devuelve 0 resultados, sin crash).

## 2. npm (dev)

```bash
git clone https://github.com/khnker/cge-lite.git
cd cge-lite
npm install          # única dep runtime: @vscode/ripgrep (devDeps: esbuild, postject)
npm test             # 42 tests (node --test, sin bash)
node engine/engine.js 'FIND definitions OF symbol parseConfig'
node engine/mcp-server.js           # MCP dev
```

Requisitos: Node.js ≥ 22.5.0 (`node:sqlite`; estable sin flag en 23+).

## 3. Build del binario SEA desde source

```bash
npm install          # instala devDeps (esbuild + postject)
npm run build:sea    # → dist/cge-lite (Linux/macOS) o dist/cge-lite.exe (Windows)
```

Builds multi-OS automatizados: `.github/workflows/build-sea.yml`.

## 4. Instalar la skill de agente

`agent-context-engineering/SKILL.md` enseña al agente LLM a hacer retrieval
eficiente (árbol de decisión CQP, presupuestos, escalación, anti-patterns).

- **opencode / Claude Code**: copiar la carpeta a tus skills:

```bash
mkdir -p ~/.config/opencode/skills/context-engineering
cp agent-context-engineering/SKILL.md ~/.config/opencode/skills/context-engineering/SKILL.md
```

- Los paths en la skill asumen el binario `cge-lite` en PATH (o `node engine/engine.js` en dev).

## 5. Configurar el binario como MCP server

Opencode (`opencode.json` / `opencode.jsonc`):

```jsonc
{
  "mcp": {
    "cge-lite": {
      "type": "local",
      "command": ["/usr/local/bin/cge-lite", "mcp"],
      "enabled": true
    }
  }
}
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cge-lite": {
      "command": "/usr/local/bin/cge-lite",
      "args": ["mcp"]
    }
  }
}
```

Tools expuestas: `context_query` (CQP o intención natural), `search_files` (rg),
`read_file` (líneas numeradas).

## Verificación

```bash
cge-lite 'FIND definitions OF symbol ripgrep'   # → results no vacío (JSON en stdout)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | cge-lite mcp
# → {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"cge-lite","version":"1.0.0"}...}}
```

## Troubleshooting

| Problema | Causa / fix |
|---|---|
| `git-log` sin resultados | `git` no instalado (opcional) — ignorar o instalar |
| MCP no responde | las respuestas van una por línea JSON por stdout; verificar stdout limpio (sin logs) |
| 0 resultados en símbolos | index-path: si existe `.cqe/` el plan usa el catálogo; construir con `CF_INDEX=1` o borrar `.cqe/` |
| `search-semantic` vacío | esperado: requiere motor ML externo (degradado por diseño) |
| rg cache corrupto | borrar `<os.tmpdir()>/cge-lite-rg/` (se re-extrae en el siguiente run) |