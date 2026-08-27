#!/usr/bin/env node
// scripts/build-sea.js — build del binario único (Node SEA) para la plataforma actual.
// Uso: node scripts/build-sea.js [NOMBRE]   (default: cge-lite / cge-lite.exe en win32)
// Pasos: esbuild bundle CJS → sea-config → blob → copia node → postject (inyección).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rgPath } from '@vscode/ripgrep';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const bin = (n) => path.join(ROOT, 'node_modules', '.bin', n + (process.platform === 'win32' ? '.cmd' : ''));
const name = process.argv[2] || (process.platform === 'win32' ? 'cge-lite.exe' : 'cge-lite');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1) bundle CJS único (esbuild): engine + scripts + @vscode/ripgrep inlined
execFileSync(bin('esbuild'), [
  'engine/sea-entry.js', '--bundle', '--platform=node', '--format=cjs',
  '--target=node22', '--alias:@vscode/ripgrep=./engine/rg-stub.js',
  '--outfile=' + path.join(DIST, 'sea-bundle.cjs'), '--log-level=warning',
], { cwd: ROOT, stdio: 'inherit' });

// 2) sea-config: blob + asset rg (binario real de @vscode/ripgrep)
const config = {
  main: path.join(DIST, 'sea-bundle.cjs'),
  output: path.join(DIST, 'sea-prep.blob'),
  assets: { rg: rgPath },
  disableExperimentalSEAWarning: true,
};
fs.writeFileSync(path.join(DIST, 'sea-config.json'), JSON.stringify(config, null, 2));

// 3) genera el blob
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { cwd: DIST, stdio: 'inherit' });

// 4) copia el binario node + inyecta el blob (postject)
const out = path.join(DIST, name);
fs.copyFileSync(process.execPath, out);
if (process.platform === 'darwin') execFileSync('codesign', ['--remove-signature', out], { stdio: 'inherit' });
if (process.platform !== 'win32') fs.chmodSync(out, 0o755);
execFileSync(bin('postject'), [
  out, 'NODE_SEA_BLOB', path.join(DIST, 'sea-prep.blob'),
  '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
], { cwd: ROOT, stdio: 'inherit' });

console.error(`OK dist/${name} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);