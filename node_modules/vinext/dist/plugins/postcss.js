import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { importExportWithCommonJsFallback } from "../utils/commonjs-loader.js";
import { createRequire } from "node:module";
import fs from "node:fs";
//#region src/plugins/postcss.ts
async function loadPluginExport(resolvedPath) {
	return importExportWithCommonJsFallback(resolvedPath);
}
/**
* PostCSS config file names to search for, in priority order.
* Matches the same search order as postcss-load-config / lilconfig.
*/
const POSTCSS_CONFIG_FILES = [
	"postcss.config.js",
	"postcss.config.cjs",
	"postcss.config.mjs",
	"postcss.config.ts",
	"postcss.config.cts",
	"postcss.config.mts",
	".postcssrc",
	".postcssrc.js",
	".postcssrc.cjs",
	".postcssrc.mjs",
	".postcssrc.ts",
	".postcssrc.cts",
	".postcssrc.mts",
	".postcssrc.json",
	".postcssrc.yaml",
	".postcssrc.yml"
];
/**
* Module-level cache for resolvePostcssStringPlugins — avoids re-scanning per Vite environment.
* Stores the Promise itself so concurrent calls (RSC/SSR/Client config() hooks firing in
* parallel) all await the same in-flight scan rather than each starting their own.
*/
const postcssCache = /* @__PURE__ */ new Map();
/**
* Resolve PostCSS string plugin names in a project's PostCSS config.
*
* Next.js (via postcss-load-config) resolves string plugin names in the
* object form `{ plugins: { "pkg-name": opts } }` but NOT in the array form
* `{ plugins: ["pkg-name"] }`. Since many Next.js projects use the array
* form (particularly with Tailwind CSS v4), we detect this case and resolve
* the string names to actual plugin functions so Vite can use them.
*
* Returns the resolved PostCSS config object to inject into Vite's
* `css.postcss`, or `undefined` if no resolution is needed.
*/
function resolvePostcssStringPlugins(projectRoot) {
	if (postcssCache.has(projectRoot)) return postcssCache.get(projectRoot);
	const promise = resolvePostcssStringPluginsUncached(projectRoot);
	postcssCache.set(projectRoot, promise);
	return promise;
}
async function resolvePostcssStringPluginsUncached(projectRoot) {
	let configPath = null;
	for (const name of POSTCSS_CONFIG_FILES) {
		const candidate = path.join(projectRoot, name);
		if (fs.existsSync(candidate)) {
			configPath = candidate;
			break;
		}
	}
	if (!configPath) return;
	let config;
	try {
		if (configPath.endsWith(".json") || configPath.endsWith(".yaml") || configPath.endsWith(".yml")) return;
		if (configPath.endsWith(".postcssrc")) {
			if (fs.readFileSync(configPath, "utf-8").trim().startsWith("{")) return;
		}
		config = await importExportWithCommonJsFallback(configPath);
	} catch {
		return;
	}
	if (!config || !Array.isArray(config.plugins)) return;
	if (!config.plugins.some((p) => typeof p === "string" || Array.isArray(p) && typeof p[0] === "string")) return;
	const req = createRequire(path.join(projectRoot, "package.json"));
	try {
		return { plugins: await Promise.all(config.plugins.filter(Boolean).map(async (plugin) => {
			if (typeof plugin === "string") {
				const fn = await loadPluginExport(req.resolve(plugin));
				return typeof fn === "function" ? fn() : fn;
			}
			if (Array.isArray(plugin) && typeof plugin[0] === "string") {
				const [name, options] = plugin;
				const fn = await loadPluginExport(req.resolve(name));
				return typeof fn === "function" ? fn(options) : fn;
			}
			return plugin;
		})) };
	} catch {
		return;
	}
}
//#endregion
export { postcssCache, resolvePostcssStringPlugins };
