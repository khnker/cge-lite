#!/usr/bin/env node
/**
 * engine/sea-entry.js — entry point para Node SEA (binario único).
 * Extrae el binario rg embebido (asset) a caché y despacha:
 *   cge-lite mcp        → servidor MCP stdio
 *   cge-lite <CQP|text> → CLI engine
 * Fuera de SEA (dev) se comporta igual; CGE_RG_PATH puede apuntar a un rg propio.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSea, getAsset } from 'node:sea';

import { runCli } from './engine.js';
import { start as startMcp } from './mcp-server.js';

if (isSea()) {
  const dir = path.join(os.tmpdir(), 'cge-lite-rg');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, process.platform === 'win32' ? 'rg.exe' : 'rg');
  if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
    fs.writeFileSync(dest, Buffer.from(getAsset('rg')));
    if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
  }
  process.env.CGE_RG_PATH = dest;
}

const args = process.argv.slice(2);
if (args[0] === 'mcp') {
  startMcp();
} else {
  process.exit(runCli());
}