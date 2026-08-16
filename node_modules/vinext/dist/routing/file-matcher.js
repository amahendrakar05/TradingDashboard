import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { escapeRegExp } from "../utils/regex.js";
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
//#region src/routing/file-matcher.ts
const DEFAULT_PAGE_EXTENSIONS = [
	"tsx",
	"ts",
	"jsx",
	"js"
];
const DEFAULT_VINEXT_RESOLVE_EXTENSIONS = [
	".tsx",
	".ts",
	".jsx",
	".js",
	".mjs",
	".mts",
	".json"
];
function normalizePageExtensions(pageExtensions) {
	if (!Array.isArray(pageExtensions) || pageExtensions.length === 0) return [...DEFAULT_PAGE_EXTENSIONS];
	const filtered = pageExtensions.filter((ext) => typeof ext === "string").map((ext) => ext.trim().replace(/^\.+/, "")).filter((ext) => ext.length > 0);
	return filtered.length > 0 ? [...filtered] : [...DEFAULT_PAGE_EXTENSIONS];
}
function buildExtensionGlob(stem, extensions) {
	if (extensions.length === 1) return `${stem}.${extensions[0]}`;
	return `${stem}.{${extensions.join(",")}}`;
}
function includeDotDirectoryMatches(pattern) {
	if (!pattern.startsWith("**/")) return pattern;
	return `{**,**/.*/**}/${pattern.slice(3)}`;
}
/**
* Ported in spirit from Next.js createValidFileMatcher:
* packages/next/src/server/lib/find-page-file.ts
*/
function createValidFileMatcher(pageExtensions) {
	const extensions = normalizePageExtensions(pageExtensions);
	const dottedExtensions = extensions.map((ext) => `.${ext}`);
	const extPattern = `(?:${extensions.map((ext) => escapeRegExp(ext)).join("|")})`;
	const extensionRegex = new RegExp(`\\.${extPattern}$`);
	const createLeafPattern = (fileNames) => {
		const names = fileNames.length === 1 ? fileNames[0] : `(${fileNames.join("|")})`;
		return new RegExp(`(^${names}|[\\\\/]${names})\\.${extPattern}$`);
	};
	const appRouterPageRegex = createLeafPattern(["page", "route"]);
	const appRouterRouteRegex = createLeafPattern(["route"]);
	const appLayoutRegex = createLeafPattern(["layout"]);
	const appDefaultRegex = createLeafPattern(["default"]);
	return {
		extensions,
		dottedExtensions,
		extensionRegex,
		isPageFile(filePath) {
			return extensionRegex.test(filePath);
		},
		isAppRouterPage(filePath) {
			return appRouterPageRegex.test(filePath);
		},
		isAppRouterRoute(filePath) {
			return appRouterRouteRegex.test(filePath);
		},
		isAppLayoutFile(filePath) {
			return appLayoutRegex.test(filePath);
		},
		isAppDefaultFile(filePath) {
			return appDefaultRegex.test(filePath);
		},
		stripExtension(filePath) {
			return filePath.replace(extensionRegex, "");
		}
	};
}
/** Check if a file exists with any configured page extension. */
function findFileWithExtensions(basePath, matcher) {
	return matcher.dottedExtensions.some((ext) => existsSync(basePath + ext));
}
/**
* Find a file by basename and configured page extension in a directory.
* Returns the first matching absolute path, or null if not found.
*/
function findFileWithExts(dir, name, matcher) {
	for (const ext of matcher.dottedExtensions) {
		const filePath = path.join(dir, name + ext);
		if (existsSync(filePath)) return filePath;
	}
	return null;
}
/**
* Add the config extensions produced by `vinext init` to vinext's resolver.
*
* `pageExtensions` is intentionally not part of module resolution. Next.js
* uses it to discover route files; custom module extensions are configured
* separately through `turbopack.resolveExtensions` or webpack
* `resolve.extensions`.
*
* The default order preserves vinext's existing module-resolution behavior
* and matches Next.js Turbopack for overlapping JavaScript and TypeScript
* extensions.
*
* `.cjs`/`.cts` go last because `vinext init` renames CJS config files when it
* adds `"type": "module"`, and app code may import those files extensionlessly.
*/
function buildViteResolveExtensions(viteExtensions = DEFAULT_VINEXT_RESOLVE_EXTENSIONS) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const ext of [
		...viteExtensions,
		".cjs",
		".cts"
	]) {
		if (seen.has(ext)) continue;
		seen.add(ext);
		result.push(ext);
	}
	return result;
}
/**
* Normalize an explicit Next.js resolver extension list for Vite.
*
* Unlike `pageExtensions`, both Turbopack's `resolveExtensions` and webpack's
* `resolve.extensions` replace their resolver defaults. The empty string is a
* webpack/Turbopack convention for trying the import exactly as written; Vite
* already does that before appending extensions, so it must be omitted here.
*/
function normalizeViteResolveExtensions(extensions) {
	const seen = /* @__PURE__ */ new Set();
	const result = [];
	for (const extension of extensions) {
		const trimmed = extension.trim();
		if (!trimmed) continue;
		const dotted = trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
		if (seen.has(dotted)) continue;
		seen.add(dotted);
		result.push(dotted);
	}
	return result;
}
/**
* Use function-form exclude for Node < 22.14 compatibility.
*
* Yields forward-slash relative paths: node's glob emits native (backslash)
* separators on Windows, so each match goes through `toSlash` — this is the
* boundary where external fs output enters the canonical forward-slash space.
*/
async function* scanWithExtensions(stem, cwd, extensions, exclude) {
	const pattern = includeDotDirectoryMatches(buildExtensionGlob(stem, extensions));
	for await (const file of glob(pattern, {
		cwd,
		...exclude ? { exclude } : {}
	})) yield toSlash(file);
}
//#endregion
export { buildViteResolveExtensions, createValidFileMatcher, findFileWithExtensions, findFileWithExts, normalizePageExtensions, normalizeViteResolveExtensions, scanWithExtensions };
