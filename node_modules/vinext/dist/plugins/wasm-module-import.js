import { stripViteModuleQuery } from "../utils/path.js";
import fs from "node:fs";
//#region src/plugins/wasm-module-import.ts
/**
* vinext:wasm-module-import — handle `import x from '*.wasm?module'`.
*
* Resolutions marked external by Vite or a target adapter are preserved. For
* non-external resolutions, this plugin reads the WASM file, inlines it as
* base64, and exports a compiled WebAssembly.Module.
*
* Fixes #1351.
*/
function createWasmModuleImportPlugin() {
	return {
		name: "vinext:wasm-module-import",
		enforce: "pre",
		resolveId: {
			filter: { id: /\.wasm\?module$/ },
			async handler(source, importer) {
				if (this.environment?.name === "client") return null;
				if ((importer ? (importer.startsWith("\0") ? importer.slice(1) : importer).split("?")[0] : "").includes("@vercel/og")) return null;
				const resolved = await this.resolve(source, importer, { skipSelf: true });
				if (!resolved) return null;
				if (resolved.external) return resolved;
				return `\0vinext-wasm-module:${stripViteModuleQuery(resolved.id)}`;
			}
		},
		load: {
			filter: { id: /^\u0000vinext-wasm-module:/ },
			handler(id) {
				const filePath = id.replace(/^\u0000vinext-wasm-module:/, "");
				this.addWatchFile(filePath);
				let bytes;
				try {
					bytes = fs.readFileSync(filePath);
				} catch {
					return this.error(`[vinext] Could not read WASM file: ${filePath}`);
				}
				const base64 = bytes.toString("base64");
				return [
					`const _b64 = ${JSON.stringify(base64)};`,
					`const _buf = Uint8Array.from(atob(_b64), c => c.charCodeAt(0));`,
					`export default await WebAssembly.compile(_buf.buffer);`
				].join("\n");
			}
		}
	};
}
//#endregion
export { createWasmModuleImportPlugin };
