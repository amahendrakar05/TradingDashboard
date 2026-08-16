import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { builtinModules } from "node:module";
import fs from "node:fs";
//#region src/plugins/server-externals-manifest.ts
const BUILTIN_MODULES = new Set(builtinModules.flatMap((name) => name.startsWith("node:") ? [name, name.slice(5)] : [name, `node:${name}`]));
/**
* Extract the npm package name from a bare module specifier.
*
* Returns null for:
*  - Relative imports ("./foo", "../bar")
*  - Absolute paths ("/abs/path")
*  - Node built-ins ("node:fs")
*  - Package self-references ("#imports")
*/
function packageNameFromSpecifier(specifier) {
	if (!specifier || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("\\") || specifier.startsWith("#")) return null;
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)) return null;
	if (specifier.startsWith("@")) {
		const parts = specifier.split("/");
		if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
		return null;
	}
	const packageName = specifier.split("/")[0] || null;
	if (!packageName || BUILTIN_MODULES.has(specifier) || BUILTIN_MODULES.has(packageName)) return null;
	return packageName;
}
/**
* vinext:server-externals-manifest
*
* A `writeBundle` plugin that collects the packages left external by the
* SSR/RSC bundler and writes them to `<outDir>/vinext-externals.json`.
*
* With `noExternal: true`, Vite bundles almost everything — only packages
* explicitly listed in `ssr.external` / `resolve.external` remain as live
* imports in the server bundle. Those packages are exactly what a standalone
* deployment needs in `node_modules/`.
*
* Using the bundler's own import graph (`chunk.imports` + `chunk.dynamicImports`)
* is authoritative: no text parsing, no regex, no guessing.
*
* The written JSON is an array of package-name strings, e.g.:
*   ["react", "react-dom", "react-dom/server"]
*
* `emitStandaloneOutput` reads this file and uses it as the seed list for the
* BFS `node_modules/` copy, replacing the old regex-scan approach.
*/
function createServerExternalsManifestPlugin() {
	const externals = /* @__PURE__ */ new Set();
	let outDir = null;
	return {
		name: "vinext:server-externals-manifest",
		apply: "build",
		enforce: "post",
		writeBundle: {
			sequential: true,
			order: "post",
			handler(options, bundle) {
				const envName = this.environment?.name;
				if (envName !== "rsc" && envName !== "ssr") return;
				const dir = options.dir;
				if (!dir) return;
				if (!outDir) outDir = path.basename(dir) === "server" ? dir : path.dirname(dir);
				const bundleFiles = new Set(Object.keys(bundle));
				for (const item of Object.values(bundle)) {
					if (item.type !== "chunk") continue;
					for (const specifier of [...item.imports, ...item.dynamicImports]) {
						if (bundleFiles.has(specifier)) continue;
						const pkg = packageNameFromSpecifier(specifier);
						if (pkg) externals.add(pkg);
					}
				}
				if (outDir && fs.existsSync(outDir)) {
					const manifestPath = path.join(outDir, "vinext-externals.json");
					fs.writeFileSync(manifestPath, JSON.stringify([...externals], null, 2) + "\n", "utf-8");
				}
			}
		}
	};
}
//#endregion
export { createServerExternalsManifestPlugin };
