import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
//#region src/entries/runtime-entry-module.ts
/**
* Resolve a sibling module path relative to a caller's `import.meta.url`,
* returning a forward-slash path safe for embedding in generated code.
*
* This is the single place that owns the
* `fileURLToPath(new URL(rel, base))` + path-separator normalization idiom so
* callers don't duplicate it.
*
* @param rel  - Relative path to the target module (e.g. `"../server/foo.js"`)
* @param base - The caller's `import.meta.url`
*/
function resolveEntryPath(rel, base) {
	return toSlash(fileURLToPath(new URL(rel, base)));
}
/**
* Resolve a real runtime module for a virtual entry generator.
*
* During local development we want to point at source files (for example `.ts`),
* while packed builds only contain emitted `.js` files in `dist/`. Probe the
* common source/build extensions and fall back to the `.js` path that exists in
* published packages.
*/
function resolveRuntimeEntryModule(name) {
	return resolveRuntimeModulePath("server", name);
}
function resolveClientRuntimeModule(name) {
	return resolveRuntimeModulePath("client", name);
}
function resolveRuntimeModulePath(directory, name) {
	for (const ext of [
		".ts",
		".js",
		".mts",
		".mjs"
	]) {
		const filePath = resolveEntryPath(`../${directory}/${name}${ext}`, import.meta.url);
		if (fs.existsSync(filePath)) return filePath;
	}
	return resolveEntryPath(`../${directory}/${name}.js`, import.meta.url);
}
//#endregion
export { resolveClientRuntimeModule, resolveEntryPath, resolveRuntimeEntryModule };
