import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { markCssUrlAssetReferences, rebaseCssUrlAssetReferences } from "../build/css-url-assets.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import { preprocessCSS } from "vite";
import { pathToFileURL } from "node:url";
//#region src/plugins/sass.ts
/**
* Map a Next.js `sassOptions` object onto Vite's
* `css.preprocessorOptions.scss` / `.sass` shape.
*
* Next.js (webpack + sass-loader) accepts:
* - `additionalData` (or legacy `prependData`) — prepended to every source
* - `includePaths` — directories searched by `@import`
* - `loadPaths`    — modern Sass equivalent of `includePaths`
* - `implementation` — Sass implementation package name (e.g. `sass-embedded`)
* - other Sass options that get forwarded as-is
*
* Reference (Next.js source — destructures the same keys before forwarding
* the rest to sass-loader):
*   .nextjs-ref/packages/next/src/build/webpack/config/blocks/css/index.ts#L150-L180
*   https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack/config/blocks/css/index.ts
*
* Vite expects:
* - `additionalData` (string or function) on the preprocessor options
* - modern Sass options (`loadPaths`, `importers`, `implementation`, …)
*   flattened next to `additionalData`
*
* @see https://vite.dev/config/shared-options.html#css-preprocessoroptions
*/
/**
* Create a Sass `FileImporter` that resolves webpack-style tilde (`~`) imports.
*
* Next.js (via sass-loader's `webpackImporter`) supports two tilde forms:
*
* 1. `~pkg/path` — resolves `pkg/path` from `node_modules`. Used for
*    third-party SCSS/CSS, e.g. `@import '~nprogress/nprogress.css'`.
*
* 2. `~/path` — resolves relative to the **project root** (the `~` acts as
*    an alias for the root). Used with Turbopack's `resolveAlias: { '~*': '*' }`
*    convention, e.g. `@use '~/styles/variables' as *`.
*
* Vite's built-in Sass resolver does not strip the `~` prefix, so any SCSS
* that uses tilde imports fails with "Can't find stylesheet to import" errors.
* This `FileImporter` runs before Vite's internal importer (added at the end
* of `importers[]` in the vite:css plugin) and canonicalises tilde URLs so
* Sass can load them from the filesystem.
*
* The returned object implements the modern Sass `FileImporter` interface:
* `findFileUrl` returns a `file://` URL and Sass automatically handles partial
* resolution (`_variables.scss` for `variables`), index files, and extensions.
*
* @param root - Absolute path to the Vite project root (used as the base for
*   `~/path` resolution and for locating `node_modules`).
*/
function createSassTildeImporter(root) {
	const rootBaseUrl = pathToFileURL(root.endsWith("/") ? root : root + "/");
	const nodeModulesBaseUrl = pathToFileURL(path.join(root, "node_modules") + "/");
	return { findFileUrl(url) {
		if (!url.startsWith("~")) return null;
		const stripped = url.slice(1);
		if (stripped.startsWith("/")) return new URL(stripped.slice(1), rootBaseUrl);
		if (!stripped) return null;
		const simpleResolved = new URL(stripped, nodeModulesBaseUrl);
		const pkgName = stripped.startsWith("@") ? stripped.split("/").slice(0, 2).join("/") : stripped.split("/")[0] ?? "";
		const directPkgDir = path.join(root, "node_modules", pkgName);
		if (pkgName && fs.existsSync(directPkgDir)) return simpleResolved;
		const req = createRequire(path.join(root, "package.json"));
		try {
			const pkgJsonPath = req.resolve(`${pkgName}/package.json`);
			const pkgDir = path.dirname(pkgJsonPath);
			const afterPkg = stripped.startsWith("@") ? stripped.split("/").slice(2).join("/") : stripped.split("/").slice(1).join("/");
			return pathToFileURL(afterPkg ? path.join(pkgDir, afterPkg) : pkgDir);
		} catch {
			return null;
		}
	} };
}
function sassStylesheetCandidates(importPath) {
	const extension = path.extname(importPath);
	const directory = path.dirname(importPath);
	const basename = path.basename(importPath, extension);
	const candidates = [];
	const extensions = extension ? [extension] : [
		".scss",
		".sass",
		".css"
	];
	for (const candidateExtension of extensions) {
		const basePath = extension ? importPath : `${importPath}${candidateExtension}`;
		candidates.push(basePath);
		candidates.push(path.join(directory, `_${basename}${candidateExtension}`));
	}
	for (const candidateExtension of extensions) {
		candidates.push(path.join(importPath, `index${candidateExtension}`));
		candidates.push(path.join(importPath, `_index${candidateExtension}`));
	}
	return candidates;
}
function deriveSassNamespace(importUrl) {
	const parts = toSlash(importUrl).replace(/\/$/, "").split("/");
	let basename = parts.pop() ?? "stylesheet";
	basename = basename.replace(/^_/, "").replace(/\..*$/, "");
	if (basename === "index" && parts.length > 0) basename = (parts.pop() ?? basename).replace(/^_/, "").replace(/\..*$/, "");
	return basename;
}
/**
* Preserve source-asset provenance for `url()` references inside imported Sass
* partials. Vite's transform hook only sees the entry stylesheet after Sass has
* flattened its imports, at which point relative URLs from a partial have lost
* the partial's source filename. Marking the partial before compilation keeps
* byte-identical assets associated with their original basenames.
*/
function createSassCssUrlAssetImporter() {
	const markedStylesheets = /* @__PURE__ */ new Map();
	const importUrlPrefix = "vinext-css-url-asset:";
	const prepareStylesheet = (filename, entryDirectory) => {
		const contents = fs.readFileSync(filename, "utf8");
		const marked = markCssUrlAssetReferences(rebaseCssUrlAssetReferences(contents, path.dirname(filename), entryDirectory) ?? contents, filename);
		if (marked === null) return null;
		const extension = path.extname(filename).toLowerCase();
		return {
			contents: rewriteImports(marked, filename, entryDirectory),
			syntax: extension === ".sass" ? "indented" : extension === ".css" ? "css" : "scss"
		};
	};
	const rewriteImports = (source, filename, entryDirectory = path.dirname(filename)) => source.replace(/(@(import|use|forward)\s+)(["'])(\.[^"']+)\3([^;]*;?)/g, (match, prefix, rule, quote, importUrl, suffix) => {
		const importPath = path.resolve(path.dirname(filename), importUrl);
		for (const candidate of sassStylesheetCandidates(importPath)) {
			if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) continue;
			const prepared = prepareStylesheet(candidate, entryDirectory);
			if (prepared === null) return match;
			const canonicalUrl = pathToFileURL(candidate);
			markedStylesheets.set(canonicalUrl.href, prepared);
			const namespace = rule === "use" && !/\bas\s+(?:\*|[-\w]+)/.test(suffix) ? ` as ${deriveSassNamespace(importUrl)}` : "";
			return `${prefix}${quote}${importUrlPrefix}${encodeURIComponent(candidate)}${quote}${namespace}${suffix}`;
		}
		return match;
	});
	return {
		canonicalize(url) {
			if (!url.startsWith(importUrlPrefix)) return null;
			return pathToFileURL(decodeURIComponent(url.slice(21)));
		},
		load(canonicalUrl) {
			return markedStylesheets.get(canonicalUrl.href) ?? null;
		},
		rewriteImports
	};
}
function buildSassPreprocessorOptions(sassOptions) {
	if (!sassOptions || typeof sassOptions !== "object") return void 0;
	const { prependData, additionalData, includePaths, loadPaths, ...rest } = sassOptions;
	const out = { ...rest };
	const data = prependData || additionalData;
	if (typeof data === "string" || typeof data === "function") out.additionalData = data;
	const mergedLoadPaths = [];
	if (Array.isArray(loadPaths)) {
		for (const p of loadPaths) if (typeof p === "string") mergedLoadPaths.push(p);
	}
	if (Array.isArray(includePaths)) {
		for (const p of includePaths) if (typeof p === "string") mergedLoadPaths.push(p);
	}
	if (mergedLoadPaths.length > 0) out.loadPaths = mergedLoadPaths;
	if (Object.keys(out).length === 0) return void 0;
	return out;
}
/**
* Sort key comparator used by postcss-modules' FileSystemLoader to determine
* the order in which dependency CSS is prepended to the output.
* Mirrors the original `traceKeySorter` from postcss-modules source.
*/
function traceKeySorter(a, b) {
	if (a.length < b.length) return a < b.substring(0, a.length) ? -1 : 1;
	if (a.length > b.length) return a.substring(0, b.length) <= b ? -1 : 1;
	return a < b ? -1 : 1;
}
/**
* Mirrors Vite's internal `cssModuleRE` (`/\.module\.(css|less|sass|scss|…)/`).
*
* postcss-modules treats *every* `composes: x from './file'` dependency as a
* CSS module regardless of its filename, but Vite's pipeline only applies
* CSS-module scoping to `*.module.*` files. When a dependency is not named
* `*.module.*` (e.g. `composes: x from './plain.css'`), we hand
* `preprocessCSS` a virtual `*.module.*` filename (same directory, so Sass
* imports and relative resolution are unaffected) so the dependency's classes
* are scoped and its export tokens extracted — matching what postcss-modules'
* built-in `FileSystemLoader` did.
*/
const CSS_MODULE_RE = /\.module\.\w+$/;
/**
* Sass-aware replacement for postcss-modules' `FileSystemLoader`.
*
* Implements the same constructor + `fetch` + `finalSource` interface that
* postcss-modules calls when resolving `composes: className from 'file'`
* dependencies.
*
* For every dependency file, Vite's `preprocessCSS` is used so that:
* - `.scss`/`.sass` files are compiled through Sass *before* CSS-module
*   scoping runs (fixing the "Invalid empty selector" LightningCSS crash).
* - `.module.css` and `.module.scss` files have their class names scoped and
*   export tokens extracted in exactly the same way as the top-level file.
*
* Failure handling: a missing Sass implementation is downgraded to a logged
* warning and an empty token map so the build continues (class composition
* will be incomplete); any other preprocessing error (e.g. a syntax error in
* the composed dependency) propagates and fails the build, matching the
* built-in `FileSystemLoader`. When no resolved config has been bound —
* only reachable if the Loader is used outside vinext's `configResolved`
* wiring — the Loader silently returns an empty token map.
*
* Recursion boundary: nested `composes` chains are handled by delegating to
* `preprocessCSS`, which re-applies postcss-modules (and therefore this
* Loader) for each dependency — every composed subtree gets its own inner
* Loader instance rather than sharing this instance's `tokensByFile`/
* `sources` state. Two intentional consequences, versus the built-in
* single-loader recursion:
* - A dependency reached from two sibling `composes` branches is inlined
*   once per subtree; the duplicate identical rules are collapsed by
*   LightningCSS during minification (bloat-free in practice, but the
*   pre-minification CSS differs from the built-in loader's single pass).
* - Circular `composes` chains are not short-circuited across the
*   `preprocessCSS` boundary (the built-in loader's shared cache caught
*   them). Cycles are invalid CSS-module inputs — webpack/Next.js errors on
*   them too — so no cycle bookkeeping is layered on here.
*
* Not exported directly: postcss-modules constructs the Loader itself with a
* fixed `(root, plugins, fileResolve)` signature, so the resolved Vite config
* cannot be a constructor argument. `createSassAwareFileSystemLoader` returns
* a subclass with the config bound per factory call (i.e. per vinext plugin
* instance) instead of a module-level singleton, so multiple builds in one
* process (monorepos, programmatic multi-build runners) each preprocess
* `composes` dependencies with their own root/sass options/scoped-name
* generator.
*/
var SassAwareFileSystemLoader = class {
	root;
	fileResolve;
	sources;
	traces;
	importNr;
	tokensByFile;
	constructor(root, _plugins, fileResolve) {
		if (root === "/" && process.platform === "win32") {
			const cwdDrive = process.cwd().slice(0, 3);
			if (!/^[A-Za-z]:\\$/.test(cwdDrive)) throw new Error(`Failed to obtain root from "${process.cwd()}".`);
			root = cwdDrive;
		}
		this.root = root;
		this.fileResolve = fileResolve;
		this.sources = {};
		this.traces = {};
		this.importNr = 0;
		this.tokensByFile = {};
	}
	/**
	* The resolved Vite config used to preprocess `composes` dependencies.
	* The base implementation has no config (`fetch` silently returns empty
	* tokens); `createSassAwareFileSystemLoader` overrides this with the
	* config bound to that factory call.
	*/
	getResolvedConfig() {
		return null;
	}
	async fetch(_newPath, relativeTo, _trace) {
		const newPath = _newPath.replace(/^["']|["']$/g, "");
		const trace = _trace ?? String.fromCharCode(this.importNr++);
		const useFileResolve = typeof this.fileResolve === "function";
		const fileResolvedPath = useFileResolve ? await this.fileResolve(newPath, relativeTo) : void 0;
		if (fileResolvedPath !== void 0 && !path.isAbsolute(fileResolvedPath)) throw new Error("The returned path from the \"fileResolve\" option must be absolute.");
		const relativeDir = path.dirname(relativeTo);
		const fileRelativePath = fileResolvedPath ?? (() => {
			let resolved = path.resolve(path.resolve(this.root, relativeDir), newPath);
			if (!useFileResolve && newPath[0] !== "." && !path.isAbsolute(newPath)) try {
				resolved = createRequire(import.meta.url).resolve(newPath);
			} catch {}
			return resolved;
		})();
		const cached = this.tokensByFile[fileRelativePath];
		if (cached) return cached;
		const config = this.getResolvedConfig();
		const rawSource = await fs.promises.readFile(fileRelativePath, "utf-8");
		if (config) try {
			const ext = path.extname(fileRelativePath);
			const result = await preprocessCSS(rawSource, CSS_MODULE_RE.test(fileRelativePath) ? fileRelativePath : ext === "" ? `${fileRelativePath}.module.css` : `${fileRelativePath.slice(0, -ext.length)}.module${ext}`, config);
			const exportTokens = result.modules ?? {};
			this.sources[fileRelativePath] = result.code;
			this.traces[trace] = fileRelativePath;
			this.tokensByFile[fileRelativePath] = exportTokens;
			return exportTokens;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes("Preprocessor dependency")) throw error;
			config.logger.warn(`[vinext] Failed to preprocess \`composes\` dependency ${fileRelativePath}: ${message}. Classes composed from this file will be missing from the build output.`);
		}
		this.sources[fileRelativePath] = "";
		this.traces[trace] = fileRelativePath;
		this.tokensByFile[fileRelativePath] = {};
		return {};
	}
	get finalSource() {
		const { traces, sources } = this;
		const written = /* @__PURE__ */ new Set();
		return Object.keys(traces).sort(traceKeySorter).map((key) => {
			const filename = traces[key];
			if (!filename || written.has(filename)) return null;
			written.add(filename);
			return sources[filename];
		}).join("");
	}
};
/**
* Create a per-build binding of {@link SassAwareFileSystemLoader}.
*
* Returns:
* - `Loader` — a class to inject as postcss-modules' `css.modules.Loader`
*   option. postcss-modules instantiates it with the fixed
*   `(root, plugins, fileResolve)` signature, so the resolved Vite config is
*   captured in this factory's closure rather than passed to the constructor.
* - `setResolvedConfig` — called from vinext's `configResolved` hook to bind
*   that build's resolved config.
*
* One binding is created per vinext plugin instance, so concurrent or
* back-to-back builds in a single process never observe another build's
* config (root, sass options, `generateScopedName`, logger, …).
*/
function createSassAwareFileSystemLoader() {
	let resolvedConfig = null;
	return {
		Loader: class extends SassAwareFileSystemLoader {
			getResolvedConfig() {
				return resolvedConfig;
			}
		},
		setResolvedConfig(config) {
			resolvedConfig = config;
		}
	};
}
//#endregion
export { buildSassPreprocessorOptions, createSassAwareFileSystemLoader, createSassCssUrlAssetImporter, createSassTildeImporter };
