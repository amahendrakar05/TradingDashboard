import { Plugin } from "vite";

//#region src/plugins/wasm-module-import.d.ts
/**
 * vinext:wasm-module-import — handle `import x from '*.wasm?module'`.
 *
 * Resolutions marked external by Vite or a target adapter are preserved. For
 * non-external resolutions, this plugin reads the WASM file, inlines it as
 * base64, and exports a compiled WebAssembly.Module.
 *
 * Fixes #1351.
 */
declare function createWasmModuleImportPlugin(): Plugin;
//#endregion
export { createWasmModuleImportPlugin };