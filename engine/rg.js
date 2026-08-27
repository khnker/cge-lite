// engine/rg.js — resolución del binario rg.
// Dev: paquete npm @vscode/ripgrep (binary portable instalado vía npm).
// Build SEA: esbuild alias @vscode/ripgrep → engine/rg-stub.js; acá el valor lo da
// CGE_RG_PATH, seteado por engine/sea-entry.js al extraer el asset embebido.
// Lazy (función) porque en el bundle SEA el env se setea DESPUÉS del import-time.
import { rgPath as rgNpm } from '@vscode/ripgrep';

export function getRgPath() {
  return process.env.CGE_RG_PATH || rgNpm;
}