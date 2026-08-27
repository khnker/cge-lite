// engine/rg-stub.js — reemplazo de @vscode/ripgrep SOLO en el bundle SEA (vía esbuild --alias).
// El valor real lo aporta CGE_RG_PATH (extracción del asset en engine/sea-entry.js);
// engine/rg.js resuelve en call-time, por eso un valor vacío aquí no rompe el bundle.
export const rgPath = '';