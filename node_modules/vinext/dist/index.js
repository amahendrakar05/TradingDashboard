import path, { toSlash } from "./deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { detectPackageManager, formatMissingCloudflarePluginError, hasWranglerConfig } from "./utils/project.js";
import { normalizePathnameForRouteMatchStrict } from "./routing/utils.js";
import { buildViteResolveExtensions, createValidFileMatcher, findFileWithExts, normalizeViteResolveExtensions } from "./routing/file-matcher.js";
import { hasBasePath, stripBasePath } from "./utils/base-path.js";
import { apiRouter, invalidateRouteCache, matchRoute, pagesRouter } from "./routing/pages-router.js";
import { VINEXT_MW_CTX_HEADER } from "./utils/protocol-headers.js";
import { INTERNAL_HEADERS, NEXTJS_DEPLOYMENT_ID_HEADER, VINEXT_INTERNAL_HEADERS, VINEXT_TIMING_HEADER } from "./server/headers.js";
import { normalizePath as normalizePath$1 } from "./server/normalize-path.js";
import { matchesRewriteSource, proxyExternalRequest } from "./config/config-matchers.js";
import { validateMiddlewareMatcherPatterns } from "./server/middleware-matcher-pattern.js";
import { isOpenRedirectShaped } from "./server/open-redirect.js";
import { canonicalizeRequestUrlPathname, filterInternalHeaders, normalizeTrailingSlash } from "./server/request-pipeline.js";
import { findMiddlewareFile, isProxyFile, runMiddleware } from "./server/middleware.js";
import { extractMiddlewareMatcherConfig, extractMiddlewareMatcherConfigValue, hasExportedName } from "./build/report.js";
import { generateServerEntry } from "./entries/pages-server-entry.js";
import { generateClientEntry } from "./entries/pages-client-entry.js";
import { appRouteGraph, appRouter, invalidateAppRouteCache, matchAppRoute } from "./routing/app-router.js";
import { findInstrumentationClientFile, findInstrumentationFile, runInstrumentation } from "./server/instrumentation.js";
import { isUnknownRecord } from "./utils/record.js";
import { logRequest, now } from "./server/request-log.js";
import { resolvePagesI18nRequest, stripI18nLocaleForApiRoute } from "./server/pages-i18n.js";
import { encodeUrlParserIgnoredCharacters, isNextDataPathname, normalizeNextDataPagePathname, parseNextDataPathname, urlParserCreatesPagesDataPath } from "./server/pages-data-route.js";
import { resolveAssetsDir } from "./utils/asset-prefix.js";
import { getPagesPreviewModeId } from "./server/pages-preview.js";
import { createSSRHandler } from "./server/dev-server.js";
import { handleApiRoute } from "./server/api-handler.js";
import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, isImageOptimizationPath, resolveDevImageRedirect } from "./server/image-optimization.js";
import { installSocketErrorBackstop } from "./server/socket-error-backstop.js";
import { invalidateMetadataFileCache, scanMetadataFiles } from "./server/metadata-routes.js";
import { shouldInvalidateAppRouteFile } from "./server/dev-route-files.js";
import { createDirectRunner } from "./server/dev-module-runner.js";
import { validateDevRequest } from "./server/dev-origin-check.js";
import { generateRscEntry } from "./entries/app-rsc-entry.js";
import { generateSsrEntry } from "./entries/app-ssr-entry.js";
import { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VIRTUAL_CACHE_ADAPTERS, generateCacheAdaptersModule } from "./cache/cache-adapters-virtual.js";
import { VIRTUAL_IMAGE_ADAPTERS, generateImageAdaptersModule } from "./image/image-adapters-virtual.js";
import { generateBrowserEntry, isLinkPrefetchRoute, toDocumentOnlyAppRoute, toLinkPrefetchRoute } from "./entries/app-browser-entry.js";
import { collectRouteClassificationManifest } from "./build/route-classification-manifest.js";
import { planRouteClassificationInjection } from "./build/route-classification-injector.js";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "./shims/constants.js";
import { RESOLVED_VIRTUAL_GOOGLE_FONTS, VIRTUAL_GOOGLE_FONTS, createGoogleFontsPlugin, createLocalFontsPlugin, generateGoogleFontsVirtualModule, parseStaticObjectLiteral } from "./plugins/fonts.js";
import { VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY, createRscCompatibilityId, findNextConfigPath, loadNextConfig, resolveNextConfig, resolveNextConfigInput } from "./config/next-config.js";
import { mergeServerExternalPackages } from "./config/server-external-packages.js";
import { precompressAssets } from "./build/precompress.js";
import { ensureAssetsIgnore } from "./build/assets-ignore.js";
import { emitNextClientRuntimeManifests } from "./build/next-client-runtime-manifests.js";
import { collectInlineCssManifest, injectInlineCssManifestGlobal } from "./build/inline-css.js";
import { installDevStackSourcemapMiddleware } from "./server/dev-stack-sourcemap.js";
import { runPagesRequest } from "./server/pages-request-pipeline.js";
import { pagesRouteHasPriorityOverAppRoute, validateHybridRouteConflicts } from "./server/hybrid-route-priority.js";
import { VIRTUAL_MODULE_ID_RE } from "./utils/virtual-module.js";
import { renderVinextBuiltUrl } from "./utils/built-asset-url.js";
import { asyncHooksStubPlugin } from "./plugins/async-hooks-stub.js";
import { clientReferenceDedupPlugin } from "./plugins/client-reference-dedup.js";
import { dataUrlCssPlugin } from "./plugins/css-data-url.js";
import { createCssModuleImportCompatibilityPlugin } from "./plugins/css-module-imports.js";
import { createRscClientReferenceLoadersPlugin } from "./plugins/rsc-client-reference-loaders.js";
import { createRscReferenceValidationNormalizerPlugin } from "./plugins/rsc-reference-validation-normalizer.js";
import { createInstrumentationClientTransformPlugin } from "./plugins/instrumentation-client.js";
import { createStyledJsxPlugin } from "./plugins/styled-jsx.js";
import { INSTRUMENTATION_CLIENT_EMPTY_MODULE, generateInstrumentationClientInjectModule } from "./client/instrumentation-client-inject.js";
import { createMiddlewareServerOnlyPlugin } from "./plugins/middleware-server-only.js";
import { stripJsExtension, stripViteModuleQuery } from "./utils/path.js";
import { validateMiddlewareModuleExports } from "./plugins/middleware-export-validation.js";
import { createOptimizeImportsPlugin } from "./plugins/optimize-imports.js";
import { augmentSsrManifestFromBundle, relativeWithinRoot, tryRealpathSync } from "./build/ssr-manifest.js";
import { createDynamicPreloadMetadataPlugin } from "./plugins/dynamic-preload-metadata.js";
import { createOgAssetsPlugin, createOgInlineFetchAssetsPlugin } from "./plugins/og-assets.js";
import { generateRouteTypes } from "./typegen.js";
import { SSR_EXTERNAL_REACT_ENTRIES, VINEXT_OPTIMIZE_DEPS_EXCLUDE, mergeOptimizeDepsExclude } from "./plugins/rsc-client-shim-excludes.js";
import { createServerExternalsManifestPlugin } from "./plugins/server-externals-manifest.js";
import public_shim_map_default from "./shims/public-shim-map.json.js";
import { VINEXT_CLIENT_ENTRY_MANIFEST } from "./utils/client-entry-manifest.js";
import { computeClientRuntimeMetadata } from "./utils/client-runtime-metadata.js";
import { PAGES_CLIENT_ASSETS_MODULE, buildPagesClientAssetsModule, setPagesClientAssetsBuildMetadata, takePagesClientAssetsBuildMetadata, writePagesClientAssetsModuleIfMissing } from "./build/pages-client-assets-module.js";
import { createPreviewBuildCredentials, getPreviewBuildCredentials } from "./build/preview-credentials.js";
import { createModuleDependencyCache } from "./build/module-dependency-cache.js";
import { resolvePostcssStringPlugins } from "./plugins/postcss.js";
import { markCssUrlAssetReferences, restoreDedupedCssAssetReferences } from "./build/css-url-assets.js";
import { buildSassPreprocessorOptions, createSassAwareFileSystemLoader, createSassCssUrlAssetImporter, createSassTildeImporter } from "./plugins/sass.js";
import { createClientAssetFileNames, createClientCodeSplittingConfig, createClientFileNameConfig, createClientManualChunks, createRscFrameworkChunkOutputConfig, getBuildBundlerOptions, getClientTreeshakeConfig, withBuildBundlerOptions } from "./build/client-build-config.js";
import { hasExportAllCandidate, stripServerExports, validatePageExports } from "./plugins/strip-server-exports.js";
import { removeConsoleCalls } from "./plugins/remove-console.js";
import { createImportMetaUrlPlugin } from "./plugins/import-meta-url.js";
import { createRequireContextPlugin } from "./plugins/require-context.js";
import { createExtensionlessDynamicImportPlugin } from "./plugins/extensionless-dynamic-import.js";
import { createWasmModuleImportPlugin } from "./plugins/wasm-module-import.js";
import { getTypeofWindowReplacement, replaceTypeofWindow } from "./plugins/typeof-window.js";
import { hasMdxFiles } from "./utils/mdx-scan.js";
import { scanPublicFileRoutes } from "./utils/public-routes.js";
import { createIgnoreDynamicRequestsPlugin } from "./plugins/ignore-dynamic-requests.js";
import { assertSupportedViteVersion, getDepOptimizeNodeEnvOptions, serializeViteDefine } from "./utils/vite-version.js";
import { VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY, VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY, normalizeVinextPrerenderConfig } from "./config/prerender.js";
import { staticExportApp, staticExportPages } from "./build/static-export.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import { createLogger, loadEnv, parseAst, transformWithOxc } from "vite";
import { pathToFileURL } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import commonjs from "vite-plugin-commonjs";
import MagicString from "magic-string";
//#region src/index.ts
const PAGES_CLOUDFLARE_WORKER_OPTIMIZE_DEPS_EXCLUDE = Object.freeze(["vinext/server/fetch-handler", "vinext/server/pages-router-entry"]);
const PAGES_CLOUDFLARE_WORKER_OPTIMIZE_DEPS_INCLUDE = Object.freeze([
	"react",
	"react-dom",
	"react-dom/server.edge",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
	"use-sync-external-store/with-selector"
]);
const OPTIONAL_OPTIMIZE_DEPS_WARNING_RE = /Failed to resolve dependency: .*use-sync-external-store\/with-selector.*present in .* 'optimizeDeps\.include'/;
const VINEXT_FILTERED_OPTIMIZE_DEPS_WARN = Symbol.for("vinext.filteredOptimizeDepsWarn");
const ANSI_ESCAPE_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
installSocketErrorBackstop();
function isInsideDirectory(dir, filePath) {
	const relativePath = path.relative(dir, filePath);
	return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
function hasServerOnlyMarkerImport(code) {
	if (!code.includes("server-only")) return false;
	let ast;
	try {
		ast = parseAst(code);
	} catch {
		return false;
	}
	function walk(node) {
		if (!node) return false;
		if (Array.isArray(node)) return node.some((child) => walk(child));
		if (typeof node !== "object") return false;
		if (node.type === "ImportDeclaration") {
			if (node.source?.value === "server-only") return true;
		}
		if (node.type === "CallExpression") {
			const call = node;
			if (call.callee?.type === "Identifier" && call.callee.name === "require" && call.arguments?.[0]?.type === "Literal" && call.arguments[0].value === "server-only") return true;
		}
		for (const key of Object.keys(node)) {
			if (key === "type" || key === "start" || key === "end" || key === "loc" || key === "parent") continue;
			const value = node[key];
			if (Array.isArray(value)) {
				if (value.some((child) => child && typeof child === "object" && walk(child))) return true;
			} else if (value && typeof value === "object" && "type" in value) {
				if (walk(value)) return true;
			}
		}
		return false;
	}
	return walk(ast.body);
}
const __dirname = import.meta.dirname;
function resolveOptionalDependency(projectRoot, specifier) {
	try {
		return createRequire(path.join(projectRoot, "package.json")).resolve(specifier);
	} catch {}
	try {
		return createRequire(import.meta.url).resolve(specifier);
	} catch {}
	return null;
}
function resolveShimModulePath(shimsDir, moduleName) {
	for (const ext of [
		".ts",
		".tsx",
		".js"
	]) {
		const candidate = path.join(shimsDir, `${moduleName}${ext}`);
		if (fs.existsSync(candidate)) return candidate;
	}
	return path.join(shimsDir, `${moduleName}.js`);
}
function isVercelOgImport(id) {
	return id === "@vercel/og" || id === "@vercel/og.js";
}
function isVinextOgShimImporter(importer) {
	if (!importer) return false;
	const cleanImporter = (importer.startsWith("\0") ? importer.slice(1) : importer).split("?")[0];
	const normalizedImporter = toSlash(cleanImporter);
	return normalizedImporter.endsWith("/shims/og.tsx") || normalizedImporter.endsWith("/shims/og.js") || normalizedImporter.endsWith("/dist/shims/og.js");
}
function toRelativeFileEntry(root, absPath) {
	return path.relative(root, absPath);
}
const DEV_PAGES_CLIENT_ENTRY = "/@id/__x00__virtual:vinext-client-entry";
const STYLESHEET_IMPORT_RE = /\.(?:css|scss|sass)$/i;
const STYLESHEET_FILE_RE = /\.(?:css|scss|sass)$/i;
const SCRIPT_IMPORT_RE = /\.(?:[cm]?[jt]sx?)$/i;
const GLOBAL_NOT_FOUND_CSS_QUERY = "?vinext-global-not-found-css";
function toMagicStringTransformResult(output) {
	return {
		code: output.toString(),
		map: output.generateMap({ hires: "boundary" })
	};
}
function parserLanguageForScript(id) {
	const cleanId = stripViteModuleQuery(id).toLowerCase();
	return cleanId.endsWith(".ts") || cleanId.endsWith(".mts") || cleanId.endsWith(".cts") ? "ts" : "tsx";
}
function isStylesheetSpecifier(specifier) {
	if (specifier.includes("?") || specifier.includes("#")) return false;
	return STYLESHEET_IMPORT_RE.test(specifier.toLowerCase());
}
function isMdxModuleId(id) {
	return stripViteModuleQuery(id).toLowerCase().endsWith(".mdx");
}
function isolateMdxStylesheetImports(code) {
	const importRe = /(^|[;\n])(\s*import\s*)(["'])([^"'\n;]+)(\3)/g;
	let output = null;
	for (const match of code.matchAll(importRe)) {
		const specifier = match[4];
		if (!isStylesheetSpecifier(specifier)) continue;
		const specifierStart = match.index + match[1].length + match[2].length + match[3].length;
		const specifierEnd = specifierStart + specifier.length;
		output ??= new MagicString(code);
		output.overwrite(specifierStart, specifierEnd, specifier + GLOBAL_NOT_FOUND_CSS_QUERY);
	}
	return output ? toMagicStringTransformResult(output) : null;
}
function isolateGlobalNotFoundStylesheetImports(code, id) {
	if (isMdxModuleId(id)) return isolateMdxStylesheetImports(code);
	let ast;
	try {
		ast = parseAst(code, { lang: parserLanguageForScript(id) });
	} catch {
		return null;
	}
	let output = null;
	for (const statement of ast.body) {
		if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
		if (statement.specifiers && statement.specifiers.length > 0) continue;
		if (statement.attributes && statement.attributes.length > 0) continue;
		const source = statement.source;
		const specifier = source?.value;
		if (typeof specifier !== "string" || !isStylesheetSpecifier(specifier)) continue;
		const range = source;
		if (typeof range.start !== "number" || typeof range.end !== "number") continue;
		output ??= new MagicString(code);
		output.overwrite(range.start, range.end, JSON.stringify(specifier + GLOBAL_NOT_FOUND_CSS_QUERY));
	}
	return output ? toMagicStringTransformResult(output) : null;
}
function isScriptModuleId(id) {
	return SCRIPT_IMPORT_RE.test(stripViteModuleQuery(id).toLowerCase());
}
function skipCommonjsForLocalCjs(id) {
	const cleanId = toSlash(stripViteModuleQuery(id));
	return /\.c[jt]s$/i.test(cleanId) && !cleanId.includes("node_modules") ? false : void 0;
}
function hasOnlyTypeSpecifiers(statement) {
	return statement.specifiers !== void 0 && statement.specifiers.length > 0 && statement.specifiers.every((specifier) => specifier.importKind === "type" || specifier.exportKind === "type");
}
function resolvedStylesheetToDevManifestAsset(root, resolvedId) {
	const cleanId = stripViteModuleQuery(resolvedId);
	if (!path.isAbsolute(cleanId)) return null;
	const rootForRelative = tryRealpathSync(root) ?? root;
	const fileForRelative = tryRealpathSync(cleanId) ?? cleanId;
	const relativePath = path.relative(rootForRelative, fileForRelative);
	if (relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) return relativePath;
	return `@fs/${toSlash(cleanId).replace(/^\/+/, "")}`;
}
async function collectDevPagesAppStylesheetAssets(appFilePath, getModuleDependencies) {
	const stylesheetAssets = [];
	const seenAssets = /* @__PURE__ */ new Set();
	const seenModules = /* @__PURE__ */ new Set();
	async function visitModule(modulePath) {
		if (seenModules.has(modulePath)) return;
		seenModules.add(modulePath);
		for (const dependency of await getModuleDependencies(modulePath)) if (dependency.type === "stylesheet") {
			if (seenAssets.has(dependency.asset)) continue;
			seenAssets.add(dependency.asset);
			stylesheetAssets.push(dependency.asset);
		} else await visitModule(dependency.id);
	}
	await visitModule(appFilePath);
	return stylesheetAssets;
}
function createDevPagesModuleDependencyReader(root, resolve) {
	return createModuleDependencyCache(collectModuleDependencies);
	async function collectModuleDependencies(modulePath) {
		const cleanModulePath = stripViteModuleQuery(modulePath);
		if (!path.isAbsolute(cleanModulePath) || !fs.existsSync(cleanModulePath)) return [];
		let ast;
		try {
			ast = parseAst(fs.readFileSync(cleanModulePath, "utf-8"), { lang: parserLanguageForScript(cleanModulePath) });
		} catch {
			return [];
		}
		const dependencies = [];
		for (const statement of ast.body) {
			if (statement.type !== "ImportDeclaration" && statement.type !== "ExportNamedDeclaration" && statement.type !== "ExportAllDeclaration") continue;
			if (statement.importKind === "type") continue;
			if (statement.exportKind === "type") continue;
			if (hasOnlyTypeSpecifiers(statement)) continue;
			if (statement.attributes && statement.attributes.length > 0) continue;
			const specifier = statement.source?.value;
			if (typeof specifier !== "string") continue;
			const resolved = await resolve(specifier, cleanModulePath, { skipSelf: true });
			if (!resolved?.id) continue;
			if (isStylesheetSpecifier(specifier)) {
				const asset = resolvedStylesheetToDevManifestAsset(root, resolved.id);
				if (asset) dependencies.push({
					type: "stylesheet",
					asset
				});
			} else if (!specifier.includes("?") && !specifier.includes("#") && isScriptModuleId(resolved.id)) dependencies.push({
				type: "script",
				id: resolved.id
			});
		}
		return dependencies;
	}
}
const TSCONFIG_FILES = ["tsconfig.json", "jsconfig.json"];
function resolveTsconfigPathCandidate(candidate) {
	const candidates = candidate.endsWith(".json") ? [candidate] : [
		candidate,
		`${candidate}.json`,
		path.join(candidate, "tsconfig.json")
	];
	for (const item of candidates) if (fs.existsSync(item) && fs.statSync(item).isFile()) return item;
	return null;
}
/**
* Normalize a tsconfig `extends` field into a list of specifier strings.
*
* TypeScript 5.0+ allows `extends` to be either a string or an array of
* strings. Matches Next.js's handling in
* packages/next/src/build/next-config-ts/transpile-config.ts, where parents
* are iterated in order and later entries override earlier ones.
*/
function normalizeTsconfigExtends(extendsField) {
	if (typeof extendsField === "string") return [extendsField];
	if (Array.isArray(extendsField)) return extendsField.filter((value) => typeof value === "string");
	return [];
}
function resolveTsconfigExtends(configPath, specifier) {
	const fromDir = path.dirname(configPath);
	if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("\\")) return resolveTsconfigPathCandidate(path.resolve(fromDir, specifier));
	const requireFromConfig = createRequire(configPath);
	const candidates = [
		specifier,
		`${specifier}.json`,
		path.join(specifier, "tsconfig.json")
	];
	for (const item of candidates) try {
		return requireFromConfig.resolve(item);
	} catch {}
	return null;
}
function materializeTsconfigPathAliases(pathsConfig, baseUrl, projectRoot) {
	const aliases = {};
	for (const [find, rawTargets] of Object.entries(pathsConfig)) {
		const target = Array.isArray(rawTargets) ? rawTargets.find((value) => typeof value === "string") : typeof rawTargets === "string" ? rawTargets : null;
		if (!target) continue;
		if (find.includes("*") || target.includes("*")) {
			if (!find.endsWith("/*") || !target.endsWith("/*")) continue;
			if (find.indexOf("*") !== find.length - 1 || target.indexOf("*") !== target.length - 1) continue;
			const aliasKey = find.slice(0, -2);
			const targetDir = target.slice(0, -2);
			if (!aliasKey || !targetDir) continue;
			aliases[aliasKey] = toViteAliasReplacement(path.resolve(baseUrl, targetDir), projectRoot);
			continue;
		}
		aliases[find] = toViteAliasReplacement(path.resolve(baseUrl, target), projectRoot);
	}
	return aliases;
}
function toViteAliasReplacement(absolutePath, projectRoot) {
	const normalizedPath = toSlash(absolutePath);
	const rootCandidates = /* @__PURE__ */ new Set([projectRoot]);
	const realRoot = tryRealpathSync(projectRoot);
	if (realRoot) rootCandidates.add(realRoot);
	const pathCandidates = /* @__PURE__ */ new Set([absolutePath]);
	const realPath = tryRealpathSync(absolutePath);
	if (realPath) pathCandidates.add(realPath);
	for (const rootCandidate of rootCandidates) for (const pathCandidate of pathCandidates) {
		if (pathCandidate === rootCandidate) return normalizedPath;
		const relativeId = relativeWithinRoot(rootCandidate, pathCandidate);
		if (relativeId) return "/" + relativeId;
	}
	return normalizedPath;
}
function resolveSwcHelpersAlias(root) {
	const rootRequire = createRequire(path.join(root, "package.json"));
	const resolvers = [];
	try {
		const nextPackageJson = rootRequire.resolve("next/package.json");
		const realNextPackageJson = tryRealpathSync(nextPackageJson) ?? nextPackageJson;
		resolvers.push(createRequire(realNextPackageJson));
	} catch {}
	resolvers.push(rootRequire, createRequire(import.meta.url));
	for (const resolver of resolvers) try {
		const packageJsonPath = resolver.resolve("@swc/helpers/package.json");
		return path.join(path.dirname(packageJsonPath), "_");
	} catch {}
}
function loadTsconfigPathAliases(configPath, projectRoot, seen = /* @__PURE__ */ new Set()) {
	const normalizedPath = tryRealpathSync(configPath) ?? configPath;
	if (seen.has(normalizedPath)) return {};
	seen.add(normalizedPath);
	let parsed = null;
	try {
		parsed = parseStaticObjectLiteral(fs.readFileSync(normalizedPath, "utf-8"));
	} catch {
		return {};
	}
	if (!parsed) return {};
	let aliases = {};
	for (const extendsSpecifier of normalizeTsconfigExtends(parsed.extends)) {
		const extendedPath = resolveTsconfigExtends(normalizedPath, extendsSpecifier);
		if (extendedPath) aliases = {
			...aliases,
			...loadTsconfigPathAliases(extendedPath, projectRoot, seen)
		};
	}
	const compilerOptions = isUnknownRecord(parsed.compilerOptions) ? parsed.compilerOptions : null;
	const pathsConfig = compilerOptions && isUnknownRecord(compilerOptions.paths) ? compilerOptions.paths : null;
	if (!pathsConfig) return aliases;
	const baseUrl = compilerOptions && typeof compilerOptions.baseUrl === "string" ? compilerOptions.baseUrl : ".";
	const resolvedBaseUrl = path.resolve(path.dirname(normalizedPath), baseUrl);
	return {
		...aliases,
		...materializeTsconfigPathAliases(pathsConfig, resolvedBaseUrl, projectRoot)
	};
}
/**
* Read the vinext package version once at plugin load. Surfaced via
* `process.env.__NEXT_VERSION` define so `window.next.version` lands a
* real string instead of the `"vinext"` fallback. Resolved relative to
* this module's own `package.json`, not the project root.
*
* Defaults to `"vinext"` on read failure so a malformed install never
* breaks the build — only the diagnostic global loses fidelity.
*/
let _vinextVersionCache = null;
function getVinextVersion() {
	if (_vinextVersionCache !== null) return _vinextVersionCache;
	try {
		const pkgUrl = new URL("../package.json", import.meta.url);
		const pkg = JSON.parse(fs.readFileSync(pkgUrl, "utf-8"));
		_vinextVersionCache = typeof pkg.version === "string" ? pkg.version : "vinext";
	} catch {
		_vinextVersionCache = "vinext";
	}
	return _vinextVersionCache;
}
function mergeStringArrayValues(value, additions) {
	return [.../* @__PURE__ */ new Set([...value === void 0 ? [] : Array.isArray(value) ? value : [value], ...additions])];
}
function stripAnsi(value) {
	return value.replace(ANSI_ESCAPE_RE, "");
}
function suppressOptionalOptimizeDepsWarnings(logger) {
	const marker = logger;
	if (marker[VINEXT_FILTERED_OPTIMIZE_DEPS_WARN]) return;
	const warn = logger.warn.bind(logger);
	logger.warn = (msg, options) => {
		if (OPTIONAL_OPTIMIZE_DEPS_WARNING_RE.test(stripAnsi(msg))) return;
		warn(msg, options);
	};
	marker[VINEXT_FILTERED_OPTIMIZE_DEPS_WARN] = true;
}
const _tsconfigAliasCache = /* @__PURE__ */ new Map();
/**
* Order materialized tsconfig path aliases by descending prefix length.
*
* TypeScript (and Next.js) match `paths` patterns by longest matched prefix,
* regardless of declaration order, while Vite's alias plugin picks the first
* matching entry. Overlapping patterns like `@/*` + `@/public/*` must
* therefore be materialized longest-first or the general pattern shadows the
* specific one (`@/public/foo.svg` would resolve into `src/public/`).
*/
function sortTsconfigAliasesBySpecificity(aliases) {
	return Object.fromEntries(Object.entries(aliases).sort((a, b) => b[0].length - a[0].length));
}
function resolveTsconfigAliases(projectRoot) {
	if (_tsconfigAliasCache.has(projectRoot)) return _tsconfigAliasCache.get(projectRoot);
	let aliases = {};
	for (const name of TSCONFIG_FILES) {
		const candidate = path.join(projectRoot, name);
		if (!fs.existsSync(candidate)) continue;
		aliases = sortTsconfigAliasesBySpecificity(loadTsconfigPathAliases(candidate, projectRoot));
		break;
	}
	_tsconfigAliasCache.set(projectRoot, aliases);
	return aliases;
}
/**
* Stylesheet importer contexts as seen by Vite's internal CSS resolvers.
*
* Vite resolves CSS `@import`/`composes`/`url()` specifiers through a
* dedicated resolver container that only runs the alias plugin plus Vite's
* own resolver — user plugins never participate. The importer is either the
* stylesheet's own path (sass, CSS modules `composes`, url() rewriting) or a
* synthetic `<basedir>/*` (postcss-import, less).
*/
const STYLESHEET_IMPORTER_RE = /\.(?:css|scss|sass|less|styl|stylus|pcss|sss)$/i;
function isStylesheetImporter(importer) {
	if (!importer) return false;
	if (importer.endsWith("/*") || importer.endsWith("\\*")) return true;
	return STYLESHEET_IMPORTER_RE.test(stripViteModuleQuery(importer));
}
/**
* Alias resolver for tsconfig-derived path aliases that keeps them out of
* stylesheet resolution.
*
* TypeScript `paths` never apply to CSS in Next.js — `@import` specifiers in
* stylesheets use standard bundler resolution, including package.json
* `exports` maps. A blind prefix-replacement alias breaks that: with
* `"@scope/ui/*": ["../../packages/ui/src/*"]` in tsconfig, an
* `@import "@scope/ui/globals.css"` whose real target is `exports`-mapped
* gets rewritten to a nonexistent source path and fails with ENOENT.
*
* Returning `null` for stylesheet importers makes the alias plugin fall
* through, so Vite's own resolver handles the original specifier. JS/TS
* importers keep the default alias behavior (Next.js applies `paths` there,
* including for `import "@/styles/globals.css"` from a layout), and Vite's
* glob/dynamic-import transforms — which require blind prefix replacement
* because their patterns never exist on disk — keep working.
*/
const tsconfigAliasCustomResolver = async function(updatedId, importer, options) {
	if (isStylesheetImporter(importer)) return null;
	return await this.resolve(updatedId, importer, {
		...options,
		skipSelf: true
	}) ?? { id: updatedId };
};
/**
* Convert the merged alias map into Vite alias entries, attaching the
* stylesheet-scoping resolver to entries that came from tsconfig `paths`.
* Array order preserves the map's first-match ordering.
*/
function buildResolveAliasEntries(aliasMap, tsconfigPathAliases) {
	return Object.entries(aliasMap).map(([find, replacement]) => tsconfigPathAliases[find] === replacement ? {
		find,
		replacement,
		customResolver: tsconfigAliasCustomResolver
	} : {
		find,
		replacement
	});
}
const ALIAS_CUSTOM_RESOLVER_DEPRECATION_RE = /`resolve\.alias` contains an alias with `customResolver` option/;
const VINEXT_FILTERED_ALIAS_DEPRECATION_WARN = Symbol.for("vinext.filteredAliasDeprecationWarn");
function suppressAliasCustomResolverDeprecationWarning(logger) {
	const marker = logger;
	if (marker[VINEXT_FILTERED_ALIAS_DEPRECATION_WARN]) return logger;
	const warn = logger.warn.bind(logger);
	logger.warn = (msg, warnOptions) => {
		if (ALIAS_CUSTOM_RESOLVER_DEPRECATION_RE.test(stripAnsi(msg))) return;
		warn(msg, warnOptions);
	};
	marker[VINEXT_FILTERED_ALIAS_DEPRECATION_WARN] = true;
	return logger;
}
const VIRTUAL_WORKER_ENTRY = "virtual:vinext-worker-entry";
const RESOLVED_WORKER_ENTRY = "\0virtual:vinext-worker-entry";
const VIRTUAL_SERVER_ENTRY = "virtual:vinext-server-entry";
const RESOLVED_SERVER_ENTRY = "\0virtual:vinext-server-entry";
const VIRTUAL_CLIENT_ENTRY = "virtual:vinext-client-entry";
const RESOLVED_CLIENT_ENTRY = "\0virtual:vinext-client-entry";
const VIRTUAL_PAGES_CLIENT_ASSETS = "virtual:vinext-pages-client-assets";
const RESOLVED_PAGES_CLIENT_ASSETS = "\0virtual:vinext-pages-client-assets";
const VIRTUAL_RSC_ENTRY = "virtual:vinext-rsc-entry";
const RESOLVED_RSC_ENTRY = "\0virtual:vinext-rsc-entry";
const VIRTUAL_APP_SSR_ENTRY = "virtual:vinext-app-ssr-entry";
const RESOLVED_APP_SSR_ENTRY = "\0virtual:vinext-app-ssr-entry";
const VIRTUAL_APP_BROWSER_ENTRY = "virtual:vinext-app-browser-entry";
const RESOLVED_APP_BROWSER_ENTRY = "\0virtual:vinext-app-browser-entry";
const VIRTUAL_APP_CAPABILITIES = "virtual:vinext-app-capabilities";
const RESOLVED_APP_CAPABILITIES = "\0virtual:vinext-app-capabilities";
const RESOLVED_ROOT_PARAMS = "\0virtual:vinext-root-params";
/** Virtual module that registers config-driven cache adapters (see VinextOptions.cache). */
const RESOLVED_CACHE_ADAPTERS = "\0" + VIRTUAL_CACHE_ADAPTERS;
/** Virtual module that registers the config-driven image optimizer (see VinextOptions.images). */
const RESOLVED_IMAGE_ADAPTERS = "\0" + VIRTUAL_IMAGE_ADAPTERS;
/** Virtual module for composed instrumentation-client bootstrap. */
const VIRTUAL_INSTRUMENTATION_CLIENT = "private-next-instrumentation-client";
const RESOLVED_INSTRUMENTATION_CLIENT = ` ${VIRTUAL_INSTRUMENTATION_CLIENT}.mjs`;
/** Image file extensions handled by the vinext:image-imports plugin.
*  Shared between the Rolldown hook filter and the transform handler regex. */
const IMAGE_EXTS = "png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?";
/** Matches a trailing image extension on an import path. Built once: `IMAGE_EXTS`
*  is constant, so there is no need to recompile this per transform invocation. */
const IMAGE_EXT_RE = new RegExp(`\\.(${IMAGE_EXTS})$`);
function createStaticImageAsset(imagePath) {
	const source = fs.readFileSync(imagePath);
	const extension = path.extname(imagePath);
	return {
		fileName: `media/${path.basename(imagePath, extension)}.${createHash("sha256").update(source).digest("hex").slice(0, 8)}${extension}`,
		source
	};
}
/**
* Absolute path to vinext's shims directory, with a trailing slash. Forward
* slashes are guaranteed by pathslash's `path.resolve`, matching the Vite
* module ids (always forward-slash) that the `id.startsWith(_shimsDir)`
* prefix checks in the font plugins and clientManualChunks compare against.
* The trailing "/" keeps those prefix checks directory-exact.
*/
const _shimsDir = path.resolve(__dirname, "shims") + "/";
const _serverDir = path.resolve(__dirname, "server");
const _fontGoogleShimPath = resolveShimModulePath(_shimsDir, "font-google");
const _appBrowserServerActionClientPath = resolveShimModulePath(_serverDir, "app-browser-server-action-client");
const _appRscHandlerPath = resolveShimModulePath(_serverDir, "app-rsc-handler");
const _pagesClientAssetsPath = resolveShimModulePath(_serverDir, "pages-client-assets");
const _canExternalizeAppRscHandler = _appRscHandlerPath.endsWith(".js");
function isValidExportIdentifier(name) {
	return /^[$A-Z_a-z][$\w]*$/.test(name);
}
function isVirtualEntryFacade(id, virtualId) {
	if (!id) return false;
	const cleanId = toSlash(id.startsWith("\0") ? id.slice(1) : id);
	return cleanId === virtualId || cleanId.endsWith("/" + virtualId);
}
/**
* Returns the leading React `"use client"` or `"use server"` directive after
* stripping leading comments, hashbang, and whitespace.
*
* Used by `vinext:jsx-in-js` to opt `.js` files inside `node_modules` into the
* JSX transform. We mirror `@vitejs/plugin-rsc`'s detection by looking at the
* directive prologue rather than scanning the whole file — `code.includes`
* alone would match incidental occurrences in template literals or comments.
*/
function getLeadingReactDirective(code) {
	let i = 0;
	const len = code.length;
	if (code.charCodeAt(0) === 65279) i = 1;
	if (code[i] === "#" && code[i + 1] === "!") {
		const nl = code.indexOf("\n", i);
		if (nl === -1) return null;
		i = nl + 1;
	}
	while (i < len) {
		while (i < len && /\s/.test(code[i] ?? "")) i++;
		if (i >= len) return null;
		if (code[i] === "/" && code[i + 1] === "/") {
			const nl = code.indexOf("\n", i + 2);
			if (nl === -1) return null;
			i = nl + 1;
			continue;
		}
		if (code[i] === "/" && code[i + 1] === "*") {
			const end = code.indexOf("*/", i + 2);
			if (end === -1) return null;
			i = end + 2;
			continue;
		}
		const quote = code[i];
		if (quote !== "\"" && quote !== "'") return null;
		const closing = code.indexOf(quote, i + 1);
		if (closing === -1) return null;
		const directive = code.slice(i + 1, closing);
		if (directive === "use client" || directive === "use server") return directive;
		i = closing + 1;
		while (i < len && (code[i] === ";" || code[i] === " " || code[i] === "	")) i++;
		if (code[i] === "\n") i++;
	}
	return null;
}
function hasReactDirective(code) {
	return getLeadingReactDirective(code) !== null;
}
function generateRootParamsModule(rootParamNames) {
	const names = Array.from(new Set(rootParamNames)).filter(isValidExportIdentifier).sort();
	if (names.length === 0) return "export {};\n";
	const rootParamsShimPath = resolveShimModulePath(_shimsDir, "root-params");
	const exports = names.map((name) => `export function ${name}() { return getRootParam(${JSON.stringify(name)}); }`).join("\n");
	return `import { getRootParam } from ${JSON.stringify(rootParamsShimPath)};\n${exports}\n`;
}
const _publicNextShimMap = public_shim_map_default;
const _reactServerShims = /* @__PURE__ */ new Map();
for (const [specifier, definition] of Object.entries(_publicNextShimMap)) {
	if (!definition.reactServer) continue;
	_reactServerShims.set(specifier, definition.shim);
	_reactServerShims.set(`${specifier}.js`, definition.shim);
}
_reactServerShims.set("next/dist/client/components/navigation", "navigation");
const clientCodeSplittingConfig = createClientCodeSplittingConfig(createClientManualChunks(_shimsDir));
const appClientCodeSplittingConfig = createClientCodeSplittingConfig(createClientManualChunks(_shimsDir, true));
function getClientOutputConfig(assetsDir, preserveAppRouteBoundaries = false) {
	const codeSplitting = preserveAppRouteBoundaries ? appClientCodeSplittingConfig : clientCodeSplittingConfig;
	return {
		...createClientFileNameConfig(assetsDir),
		assetFileNames: createClientAssetFileNames(assetsDir),
		codeSplitting
	};
}
function vinext(options = {}) {
	const { supportsNativeTypeofWindowFolding: useNativeTypeofWindowFolding } = assertSupportedViteVersion();
	const prerenderConfig = normalizeVinextPrerenderConfig(options.prerender);
	let root;
	let pagesDir;
	let canonicalPagesDir;
	let appDir;
	let hasAppDir = false;
	let hasPagesDir = false;
	let nextConfig;
	let fileMatcher;
	let middlewarePath = null;
	let instrumentationPath = null;
	let instrumentationClientPath = null;
	let clientInjectModule = null;
	let globalNotFoundCssIsolationPath = null;
	let clientAssetsInlineLimit = 0;
	let hasCloudflarePlugin = false;
	let warnedInlineNextConfigOverride = false;
	let hasNitroPlugin = false;
	let nitroTraceDepsFromServerExternals = [];
	let isServeCommand = false;
	let pagesOptimizeEntries = [];
	const pagesClientAssetsOutputDirs = /* @__PURE__ */ new Set();
	let pagesClientAssetsModule = null;
	let rscCompatibilityId;
	let draftModeSecret = getPagesPreviewModeId();
	let previewBuildCredentials;
	const sassComposesLoader = createSassAwareFileSystemLoader();
	let rscClassificationManifest = null;
	const shimsDir = path.resolve(__dirname, "shims");
	const canonicalize = (p) => toSlash(tryRealpathSync(p) ?? p);
	const pageTransformCanonicalPaths = /* @__PURE__ */ new Map();
	const canonicalizePageTransformPath = (modulePath) => {
		const cached = pageTransformCanonicalPaths.get(modulePath);
		if (cached) return cached;
		const canonicalPath = canonicalize(modulePath);
		pageTransformCanonicalPaths.set(modulePath, canonicalPath);
		return canonicalPath;
	};
	const isWithinPagesDirectory = (modulePath) => modulePath === pagesDir || modulePath.startsWith(`${pagesDir}/`) || modulePath === canonicalPagesDir || modulePath.startsWith(`${canonicalPagesDir}/`);
	const isApiPage = (canonicalId) => {
		const relativePath = fileMatcher.stripExtension(canonicalId.slice(canonicalPagesDir.length));
		return relativePath === "/api" || relativePath.startsWith("/api/");
	};
	const dynamicShimPaths = new Set([
		resolveShimModulePath(shimsDir, "headers"),
		resolveShimModulePath(shimsDir, "server"),
		resolveShimModulePath(shimsDir, "cache")
	].map(canonicalize));
	let nextShimMap = {};
	/**
	* Generate the virtual SSR server entry module.
	* This is the entry point for `vite build --ssr`.
	*/
	async function generateServerEntry$1() {
		return generateServerEntry(pagesDir, nextConfig, fileMatcher, middlewarePath, instrumentationPath);
	}
	/**
	* Generate the virtual client hydration entry module.
	* This is the entry point for `vite build` (client bundle).
	*
	* It maps route patterns to dynamic imports of page modules so Vite
	* code-splits each page into its own chunk. At runtime it reads
	* __NEXT_DATA__ to determine which page to hydrate.
	*/
	async function generateClientEntry$1() {
		const appPrefetchRoutes = hasAppDir ? (await appRouter(appDir, nextConfig?.pageExtensions, fileMatcher)).map((route) => isLinkPrefetchRoute(route) ? toLinkPrefetchRoute(route) : toDocumentOnlyAppRoute(route)) : [];
		return generateClientEntry(pagesDir, nextConfig, fileMatcher, {
			appPrefetchRoutes,
			instrumentationClientPath,
			middlewareMatcher: middlewarePath ? extractMiddlewareMatcherConfig(middlewarePath) : void 0,
			reactPreamble: options.react !== false
		});
	}
	async function writeRouteTypes() {
		await generateRouteTypes({
			root,
			appDir: hasAppDir ? appDir : null,
			pageExtensions: nextConfig.pageExtensions
		});
	}
	const autoRsc = options.rsc !== false;
	const earlyBaseDir = options.appDir ?? process.cwd();
	const earlyAppDirExists = !options.disableAppRouter && (fs.existsSync(path.join(earlyBaseDir, "app")) || fs.existsSync(path.join(earlyBaseDir, "src", "app")));
	let resolvedReactPath = null;
	let resolvedRscPath = null;
	let resolvedRscTransformsPath = null;
	let rscPluginModulePromise = null;
	resolvedReactPath = resolveOptionalDependency(earlyBaseDir, "@vitejs/plugin-react");
	resolvedRscPath = resolveOptionalDependency(earlyBaseDir, "@vitejs/plugin-rsc");
	resolvedRscTransformsPath = resolveOptionalDependency(earlyBaseDir, "@vitejs/plugin-rsc/transforms");
	let rscPluginPromise = null;
	if (earlyAppDirExists && autoRsc) {
		if (!resolvedRscPath) throw new Error("vinext: App Router detected but @vitejs/plugin-rsc is not installed.\nRun: " + detectPackageManager(process.cwd()) + " @vitejs/plugin-rsc");
		const rscImport = import(pathToFileURL(resolvedRscPath).href);
		rscPluginModulePromise = rscImport;
		rscPluginPromise = rscImport.then((mod) => {
			const rsc = mod.default;
			return rsc({ entries: {
				rsc: VIRTUAL_RSC_ENTRY,
				ssr: VIRTUAL_APP_SSR_ENTRY,
				client: VIRTUAL_APP_BROWSER_ENTRY
			} });
		}).catch((cause) => {
			throw new Error("vinext: Failed to load @vitejs/plugin-rsc.", { cause });
		});
	}
	async function resolveHasServerActions(config) {
		if (config.command !== "build" || !rscPluginModulePromise) return true;
		const { getPluginApi } = await rscPluginModulePromise;
		const pluginApi = getPluginApi(config);
		if (!pluginApi || pluginApi.manager.isScanBuild) return true;
		return Object.keys(pluginApi.manager.serverReferenceMetaMap).length > 0;
	}
	const configuredReactOptions = options.react && options.react !== true ? options.react : void 0;
	const reactOptions = configuredReactOptions;
	let reactPluginPromise = null;
	if (options.react !== false) {
		if (!resolvedReactPath) throw new Error("vinext: @vitejs/plugin-react is not installed.\nRun: " + detectPackageManager(process.cwd()) + " @vitejs/plugin-react");
		reactPluginPromise = import(pathToFileURL(resolvedReactPath).href).then((mod) => {
			const react = mod.default;
			const limitToCommand = (plugin, command) => {
				const originalApply = plugin.apply;
				return {
					...plugin,
					apply(config, env) {
						if (env.command !== command) return false;
						if (!originalApply) return true;
						if (typeof originalApply === "function") return originalApply(config, env);
						return originalApply === env.command;
					}
				};
			};
			const buildPlugins = react(reactOptions).map((plugin) => limitToCommand(plugin, "build"));
			const servePlugins = react(configuredReactOptions !== void 0 && Object.prototype.hasOwnProperty.call(configuredReactOptions, "include") ? reactOptions : {
				...reactOptions,
				include: /\.(?:[tj]sx?|mdx)$/i
			}).map((plugin) => limitToCommand(plugin, "serve"));
			return [...buildPlugins, ...servePlugins];
		}).catch((cause) => {
			throw new Error("vinext: Failed to load @vitejs/plugin-react.", { cause });
		});
	}
	const imageImportDimCache = /* @__PURE__ */ new Map();
	const staticImageAssets = /* @__PURE__ */ new Map();
	const staticImageImportsByModule = /* @__PURE__ */ new Map();
	const writtenStaticImageFiles = /* @__PURE__ */ new Set();
	let mdxDelegate = null;
	let mdxDelegatePromise = null;
	let hasUserMdxPlugin = false;
	let warnedMissingMdxPlugin = false;
	async function ensureMdxDelegate(reason) {
		if (mdxDelegate || hasUserMdxPlugin) return mdxDelegate;
		if (!mdxDelegatePromise) mdxDelegatePromise = (async () => {
			try {
				const mdxRollup = await import("@mdx-js/rollup");
				const mdxFactory = mdxRollup.default ?? mdxRollup;
				const mdxOpts = {};
				if (nextConfig.mdx) {
					if (nextConfig.mdx.remarkPlugins) mdxOpts.remarkPlugins = nextConfig.mdx.remarkPlugins;
					if (nextConfig.mdx.rehypePlugins) mdxOpts.rehypePlugins = nextConfig.mdx.rehypePlugins;
					if (nextConfig.mdx.recmaPlugins) mdxOpts.recmaPlugins = nextConfig.mdx.recmaPlugins;
				}
				const delegate = mdxFactory(mdxOpts);
				mdxDelegate = delegate;
				if (reason === "detected") if (nextConfig.mdx) console.log("[vinext] Auto-injected @mdx-js/rollup with remark/rehype plugins from next.config");
				else console.log("[vinext] Auto-injected @mdx-js/rollup for MDX support");
				else console.log("[vinext] Auto-injected @mdx-js/rollup for on-demand MDX support");
				return delegate;
			} catch {
				if (reason === "detected" && !warnedMissingMdxPlugin) {
					warnedMissingMdxPlugin = true;
					console.warn("[vinext] MDX files detected but @mdx-js/rollup is not installed. Install it with: " + detectPackageManager(process.cwd()) + " @mdx-js/rollup");
				}
				return null;
			}
		})();
		return mdxDelegatePromise;
	}
	const mdxProxyPlugin = {
		name: "vinext:mdx",
		enforce: "pre",
		transform: {
			filter: { id: {
				include: /\.mdx$/i,
				exclude: /\?/
			} },
			async handler(code, id, options) {
				const delegate = mdxDelegate ?? await ensureMdxDelegate("on-demand");
				if (delegate?.transform) {
					const hook = delegate.transform;
					return (typeof hook === "function" ? hook : hook.handler).call(this, code, id, options);
				}
				if (!hasUserMdxPlugin) throw new Error(`[vinext] Encountered MDX module ${id} but no MDX plugin is configured. Install @mdx-js/rollup or register an MDX plugin manually.`);
			}
		}
	};
	const mdxConfigProxyPlugin = {
		name: "vinext:mdx-config",
		enforce: "pre",
		config(config, env) {
			if (!mdxDelegate?.config) return;
			const hook = mdxDelegate.config;
			return (typeof hook === "function" ? hook : hook.handler).call(this, config, env);
		}
	};
	const plugins = [
		createStyledJsxPlugin(earlyBaseDir),
		mdxProxyPlugin,
		reactPluginPromise,
		createIgnoreDynamicRequestsPlugin(() => nextConfig?.turbopackTranspilePackages ?? []),
		commonjs({ filter: skipCommonjsForLocalCjs }),
		{
			name: "vinext:global-not-found-css-isolation",
			apply: "build",
			enforce: "pre",
			transform: {
				filter: {
					id: /(?:^|[/\\])global-not-found(?:\.[^./?\\]+)+(?:\?.*)?$/,
					code: /\.(?:css|scss|sass)['"]/
				},
				handler(code, id) {
					const cleanId = toSlash(stripViteModuleQuery(id));
					if (!globalNotFoundCssIsolationPath || canonicalize(cleanId) !== canonicalize(globalNotFoundCssIsolationPath)) return null;
					return isolateGlobalNotFoundStylesheetImports(code, cleanId);
				}
			}
		},
		{
			name: "vinext:jsx-in-js",
			enforce: "pre",
			transform: {
				filter: { id: /\.m?js(?:\?.*)?$/ },
				async handler(code, id) {
					const cleanId = id.split("?")[0];
					if (isInsideDirectory(__dirname, cleanId)) return;
					if (cleanId.includes("/node_modules/")) {
						if (!code.includes("use client") && !code.includes("use server")) return;
						if (!hasReactDirective(code)) return;
					}
					const result = await transformWithOxc(code, id, {
						lang: "jsx",
						jsx: { runtime: "automatic" },
						sourcemap: true
					});
					return {
						code: result.code,
						map: result.map
					};
				}
			}
		},
		createMiddlewareServerOnlyPlugin({
			getMiddlewarePath: () => middlewarePath,
			getCanonicalMiddlewarePath: () => middlewarePath ? tryRealpathSync(middlewarePath) ?? middlewarePath : null,
			isNeutralServerModule: (id) => {
				const canonicalId = canonicalizePageTransformPath(id);
				return isWithinPagesDirectory(canonicalId) && isApiPage(canonicalId);
			},
			serverOnlyShimPath: resolveShimModulePath(shimsDir, "server-only")
		}),
		dataUrlCssPlugin(),
		createCssModuleImportCompatibilityPlugin(),
		{
			name: "vinext:config",
			enforce: "pre",
			[VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY]: prerenderConfig,
			[VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY]: options.nextConfig ?? null,
			[VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY]: {
				appDir: options.appDir,
				disableAppRouter: options.disableAppRouter,
				rscOutDir: options.rscOutDir,
				ssrOutDir: options.ssrOutDir
			},
			[VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY]: options.cache ?? null,
			async config(config, env) {
				isServeCommand = env.command === "serve";
				root = toSlash(config.root ?? process.cwd());
				const shouldEnableNativeTsconfigPaths = config.resolve?.tsconfigPaths === void 0;
				const tsconfigPathAliases = resolveTsconfigAliases(root);
				const swcHelpersAlias = resolveSwcHelpersAlias(root);
				if (Object.keys(tsconfigPathAliases).length > 0) config.customLogger = suppressAliasCustomResolverDeprecationWarning(config.customLogger ?? createLogger(config.logLevel, { allowClearScreen: config.clearScreen }));
				const mode = env?.mode ?? "development";
				const dotenvVars = loadEnv(mode, config.envDir ?? root, "");
				for (const [key, value] of Object.entries(dotenvVars)) if (process.env[key] === void 0) process.env[key] = value;
				let resolvedNodeEnv;
				if (mode === "test") resolvedNodeEnv = "test";
				else if (env?.command === "build" || env?.isPreview === true) resolvedNodeEnv = "production";
				else resolvedNodeEnv = "development";
				if (process.env.NODE_ENV !== resolvedNodeEnv) Reflect.set(process.env, "NODE_ENV", resolvedNodeEnv);
				if (env?.command === "build") previewBuildCredentials = getPreviewBuildCredentials() ?? createPreviewBuildCredentials();
				draftModeSecret = previewBuildCredentials?.id ?? getPagesPreviewModeId();
				let baseDir;
				if (options.appDir) baseDir = toSlash(path.isAbsolute(options.appDir) ? options.appDir : path.resolve(root, options.appDir));
				else {
					const hasRootApp = fs.existsSync(path.join(root, "app"));
					const hasRootPages = fs.existsSync(path.join(root, "pages"));
					const hasSrcApp = fs.existsSync(path.join(root, "src", "app"));
					const hasSrcPages = fs.existsSync(path.join(root, "src", "pages"));
					if (hasRootApp || hasRootPages) baseDir = root;
					else if (hasSrcApp || hasSrcPages) baseDir = path.join(root, "src");
					else baseDir = root;
				}
				pagesDir = path.join(baseDir, "pages");
				canonicalPagesDir = canonicalize(pagesDir);
				appDir = path.join(baseDir, "app");
				hasPagesDir = fs.existsSync(pagesDir);
				hasAppDir = !options.disableAppRouter && fs.existsSync(appDir);
				invalidateRouteCache(pagesDir);
				invalidateAppRouteCache();
				if (!nextConfig) {
					const phase = env?.command === "build" ? PHASE_PRODUCTION_BUILD : PHASE_DEVELOPMENT_SERVER;
					let rawConfig;
					if (options.nextConfig) {
						const diskConfigPath = findNextConfigPath(root);
						if (diskConfigPath && !warnedInlineNextConfigOverride) {
							warnedInlineNextConfigOverride = true;
							console.warn(`[vinext] vinext({ nextConfig }) overrides ${path.basename(diskConfigPath)}. Remove one of the config sources to avoid drift.`);
						}
						rawConfig = await resolveNextConfigInput(options.nextConfig, phase);
					} else rawConfig = await loadNextConfig(root, phase);
					nextConfig = await resolveNextConfig(rawConfig, root, { dev: env?.command === "serve" && env?.isPreview !== true });
					const sharedBuildId = process.env.__VINEXT_SHARED_BUILD_ID;
					if (sharedBuildId && sharedBuildId.length > 0) nextConfig = {
						...nextConfig,
						buildId: sharedBuildId
					};
				}
				if (rscCompatibilityId === void 0) {
					const sharedRscCompatibilityId = process.env.__VINEXT_SHARED_RSC_COMPATIBILITY_ID;
					rscCompatibilityId = sharedRscCompatibilityId && sharedRscCompatibilityId.length > 0 ? sharedRscCompatibilityId : createRscCompatibilityId(nextConfig);
				}
				fileMatcher = createValidFileMatcher(nextConfig.pageExtensions);
				globalNotFoundCssIsolationPath = env?.command === "build" && nextConfig.globalNotFound ? findFileWithExts(appDir, "global-not-found", fileMatcher) : null;
				instrumentationPath = findInstrumentationFile(root, fileMatcher);
				instrumentationClientPath = findInstrumentationClientFile(root, fileMatcher);
				const middlewareConventionDir = canonicalize(baseDir) === canonicalize(path.join(root, "src")) ? path.join(root, "src") : root;
				middlewarePath = findMiddlewareFile(root, fileMatcher, middlewareConventionDir);
				if (middlewarePath) {
					const staticMatcher = extractMiddlewareMatcherConfigValue(middlewarePath);
					if (staticMatcher !== void 0) validateMiddlewareMatcherPatterns(staticMatcher);
				}
				const instrumentationClientInjects = nextConfig.instrumentationClientInject.map((spec) => spec.startsWith("./") || spec.startsWith("../") ? path.resolve(root, spec) : spec);
				clientInjectModule = instrumentationClientInjects.length ? generateInstrumentationClientInjectModule(instrumentationClientInjects, instrumentationClientPath, INSTRUMENTATION_CLIENT_EMPTY_MODULE) : null;
				if (env?.command === "build") await writeRouteTypes();
				const defines = getNextPublicEnvDefines();
				const userNodeEnvDefine = config.define?.["process.env.NODE_ENV"];
				const hasUserNodeEnvDefine = Object.hasOwn(config.define ?? {}, "process.env.NODE_ENV");
				const nodeEnvDefine = hasUserNodeEnvDefine ? serializeViteDefine(userNodeEnvDefine) : JSON.stringify(resolvedNodeEnv);
				if (!hasUserNodeEnvDefine) defines["process.env.NODE_ENV"] = nodeEnvDefine;
				for (const [key, value] of Object.entries(nextConfig.env)) {
					if (key === "NODE_ENV") continue;
					defines[`process.env.${key}`] = JSON.stringify(value);
				}
				defines["process.env.__NEXT_ROUTER_BASEPATH"] = JSON.stringify(nextConfig.basePath);
				defines["process.env.__VINEXT_HAS_PAGES_ROUTER"] = JSON.stringify(String(hasPagesDir));
				defines["process.env.__VINEXT_HAS_CLIENT_REWRITES"] = JSON.stringify(String(nextConfig.rewrites.beforeFiles.length > 0 || nextConfig.rewrites.afterFiles.length > 0 || nextConfig.rewrites.fallback.length > 0));
				defines["process.env.__VINEXT_HAS_CONFIG_HEADERS"] = JSON.stringify(String(nextConfig.headers.length > 0));
				defines["process.env.__VINEXT_HAS_CONFIG_REDIRECTS"] = JSON.stringify(String(nextConfig.redirects.length > 0));
				defines["process.env.__VINEXT_HAS_CONFIG_REWRITES"] = JSON.stringify(String(nextConfig.rewrites.beforeFiles.length > 0 || nextConfig.rewrites.afterFiles.length > 0 || nextConfig.rewrites.fallback.length > 0));
				defines["process.env.__NEXT_CLIENT_ROUTER_DYNAMIC_STALETIME"] = JSON.stringify(String(nextConfig.staleTimes.dynamic));
				defines["process.env.__NEXT_CLIENT_ROUTER_STATIC_STALETIME"] = JSON.stringify(String(nextConfig.staleTimes.static));
				defines["process.env.__VINEXT_PREFETCH_INLINING"] = JSON.stringify(nextConfig.prefetchInlining ? "true" : "false");
				defines["process.env.__NEXT_GESTURE_TRANSITION"] = JSON.stringify(nextConfig.gestureTransition);
				defines["process.env.__NEXT_APP_NAV_FAIL_HANDLING"] = JSON.stringify(nextConfig.appNavFailHandling);
				defines["process.env.__NEXT_SCROLL_RESTORATION"] = JSON.stringify(nextConfig.scrollRestoration ? "true" : "false");
				defines["process.env.__VINEXT_TRAILING_SLASH"] = JSON.stringify(nextConfig.trailingSlash ? "true" : "false");
				defines["process.env.__VINEXT_IMAGE_REMOTE_PATTERNS"] = JSON.stringify(JSON.stringify(nextConfig.images?.remotePatterns ?? []));
				defines["process.env.__VINEXT_IMAGE_DOMAINS"] = JSON.stringify(JSON.stringify(nextConfig.images?.domains ?? []));
				{
					const deviceSizes = nextConfig.images?.deviceSizes ?? [
						640,
						750,
						828,
						1080,
						1200,
						1920,
						2048,
						3840
					];
					const imageSizes = nextConfig.images?.imageSizes ?? [
						16,
						32,
						48,
						64,
						96,
						128,
						256,
						384
					];
					defines["process.env.__VINEXT_IMAGE_DEVICE_SIZES"] = JSON.stringify(JSON.stringify(deviceSizes));
					defines["process.env.__VINEXT_IMAGE_SIZES"] = JSON.stringify(JSON.stringify(imageSizes));
					defines["process.env.__VINEXT_IMAGE_QUALITIES"] = JSON.stringify(JSON.stringify(nextConfig.images?.qualities ?? null));
				}
				defines["process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_SVG"] = JSON.stringify(String(nextConfig.images?.dangerouslyAllowSVG ?? false));
				defines["process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_LOCAL_IP"] = JSON.stringify(String(nextConfig.images?.dangerouslyAllowLocalIP ?? false));
				defines["process.env.__VINEXT_IMAGE_UNOPTIMIZED"] = JSON.stringify(String(nextConfig.images?.unoptimized === true));
				defines["process.env.__VINEXT_BUILD_ID"] = JSON.stringify(nextConfig.buildId);
				defines["process.env.__VINEXT_RSC_COMPATIBILITY_ID"] = JSON.stringify(rscCompatibilityId);
				defines["process.env.__VINEXT_DEPLOYMENT_ID"] = JSON.stringify(nextConfig.deploymentId ?? "");
				defines["process.env.NEXT_DEPLOYMENT_ID"] = nextConfig.deploymentId ? JSON.stringify(nextConfig.deploymentId) : "false";
				defines["process.env.NEXT_RUNTIME"] = "\"\"";
				defines["process.env.__NEXT_VERSION"] = JSON.stringify(getVinextVersion());
				defines["process.env.__NEXT_APP_SHELLS"] = JSON.stringify(nextConfig.appShells);
				defines["process.env.__NEXT_CACHE_COMPONENTS"] = JSON.stringify(nextConfig.cacheComponents ?? false);
				for (const [key, value] of Object.entries(nextConfig.compilerDefine)) {
					if (key in defines) throw new Error(`The \`compiler.define\` option is configured to replace the \`${key}\` variable. This variable is either part of a built-in or is already configured.`);
					defines[key] = value;
				}
				for (const key of Object.keys(nextConfig.compilerDefineServer)) if (key in defines) throw new Error(`The \`compiler.defineServer\` option is configured to replace the \`${key}\` variable. This variable is either part of a built-in or is already configured.`);
				nextShimMap = Object.fromEntries(Object.entries({
					...Object.fromEntries(Object.entries(_publicNextShimMap).filter(([, definition]) => !definition.reactServer).map(([specifier, definition]) => [specifier, path.join(shimsDir, definition.shim)])),
					"next/dist/shared/lib/app-router-context.shared-runtime": path.join(shimsDir, "internal", "app-router-context"),
					"next/dist/shared/lib/app-router-context": path.join(shimsDir, "internal", "app-router-context"),
					"next/dist/shared/lib/router-context.shared-runtime": path.join(shimsDir, "internal", "router-context"),
					"next/dist/shared/lib/utils": path.join(shimsDir, "internal", "utils"),
					"next/dist/server/api-utils": path.join(shimsDir, "internal", "api-utils"),
					"next/dist/server/web/spec-extension/cookies": path.join(shimsDir, "internal", "cookies"),
					"next/dist/compiled/@edge-runtime/cookies": path.join(shimsDir, "internal", "cookies"),
					"next/dist/server/app-render/work-unit-async-storage.external": path.join(shimsDir, "internal", "work-unit-async-storage"),
					"next/dist/client/components/work-unit-async-storage.external": path.join(shimsDir, "internal", "work-unit-async-storage"),
					"next/dist/client/components/request-async-storage.external": path.join(shimsDir, "internal", "work-unit-async-storage"),
					"next/dist/client/components/request-async-storage": path.join(shimsDir, "internal", "work-unit-async-storage"),
					"next/dist/server/request/root-params": path.join(shimsDir, "root-params"),
					"next/dist/server/config-shared": path.join(shimsDir, "internal", "utils"),
					"server-only": path.join(shimsDir, "server-only"),
					"client-only": path.join(shimsDir, "client-only"),
					"vinext/error-boundary": path.join(shimsDir, "error-boundary"),
					"vinext/layout-segment-context": path.join(shimsDir, "layout-segment-context"),
					"vinext/metadata": path.join(shimsDir, "metadata"),
					"vinext/fetch-cache": path.join(shimsDir, "fetch-cache"),
					"vinext/cache-runtime": path.join(shimsDir, "cache-runtime"),
					"vinext/navigation-state": path.join(shimsDir, "navigation-state"),
					"vinext/unified-request-context": path.join(shimsDir, "unified-request-context"),
					"vinext/pages-router-runtime": path.join(shimsDir, "pages-router-runtime"),
					"vinext/router-state": path.join(shimsDir, "router-state"),
					"vinext/head-state": path.join(shimsDir, "head-state"),
					"vinext/i18n-state": path.join(shimsDir, "i18n-state"),
					"vinext/i18n-context": path.join(shimsDir, "i18n-context"),
					"vinext/cache": path.resolve(__dirname, "cache"),
					"vinext/instrumentation": path.resolve(__dirname, "server", "instrumentation"),
					"vinext/instrumentation-client": path.resolve(__dirname, "client", "instrumentation-client"),
					"vinext/dev-error-overlay": path.resolve(__dirname, "client", "dev-error-overlay"),
					"vinext/html": path.resolve(__dirname, "server", "html"),
					...clientInjectModule === null ? { "private-next-instrumentation-client": instrumentationClientPath ?? INSTRUMENTATION_CLIENT_EMPTY_MODULE } : {}
				}).flatMap(([k, v]) => k.startsWith("next/") ? [[k, v], [`${k}.js`, v]] : [[k, v]]));
				const pluginsFlat = [];
				function flattenPlugins(arr) {
					for (const p of arr) if (Array.isArray(p)) flattenPlugins(p);
					else if (p) pluginsFlat.push(p);
				}
				flattenPlugins(config.plugins ?? []);
				hasCloudflarePlugin = pluginsFlat.some((p) => p && typeof p === "object" && "name" in p && typeof p.name === "string" && (p.name === "vite-plugin-cloudflare" || p.name.startsWith("vite-plugin-cloudflare:")));
				hasNitroPlugin = pluginsFlat.some((p) => p && typeof p === "object" && "name" in p && typeof p.name === "string" && (p.name === "nitro" || p.name.startsWith("nitro:")));
				let postcssOverride;
				if (!config.css?.postcss || typeof config.css.postcss === "string") postcssOverride = await resolvePostcssStringPlugins(root);
				const sassPreprocessorOptions = buildSassPreprocessorOptions(nextConfig.sassOptions);
				hasUserMdxPlugin = pluginsFlat.some((p) => p && typeof p === "object" && "name" in p && typeof p.name === "string" && (p.name === "@mdx-js/rollup" || p.name === "mdx"));
				if (!hasUserMdxPlugin && hasMdxFiles(root, hasAppDir ? appDir : null, hasPagesDir ? pagesDir : null)) await ensureMdxDelegate("detected");
				const isSSR = !!config.build?.ssr;
				const serverTranspilePackages = [...nextConfig?.turbopackTranspilePackages ?? [], ...nextConfig?.optimizePackageImports ?? []];
				const nextServerExternal = mergeServerExternalPackages(nextConfig?.serverExternalPackages, serverTranspilePackages);
				nitroTraceDepsFromServerExternals = nextServerExternal;
				const isMultiEnv = hasAppDir || hasCloudflarePlugin || hasNitroPlugin;
				const hasBuildInput = getBuildBundlerOptions(config.build)?.input !== void 0;
				const shouldInjectPlainPagesEnvironments = !hasAppDir && !hasCloudflarePlugin && !isSSR && !hasBuildInput;
				const hasClientBuildEnvironment = hasAppDir || hasCloudflarePlugin || hasNitroPlugin || shouldInjectPlainPagesEnvironments;
				const clientAssetsDir = resolveAssetsDir(nextConfig.assetPrefix ?? "");
				clientAssetsInlineLimit = config.build?.assetsInlineLimit ?? 0;
				const devHmrConfig = config.server?.hmr === false ? false : {
					...typeof config.server?.hmr === "object" ? config.server.hmr : {},
					overlay: false
				};
				const cssModulesOverride = config.css?.modules === false || typeof config.css?.modules === "object" && "Loader" in config.css.modules ? {} : { modules: { Loader: sassComposesLoader.Loader } };
				const viteConfig = {
					appType: "custom",
					build: {
						ssrEmitAssets: true,
						cssTarget: [
							"chrome111",
							"edge111",
							"firefox114",
							"safari15"
						],
						assetsDir: clientAssetsDir,
						...!isSSR && !hasClientBuildEnvironment ? { assetsInlineLimit: clientAssetsInlineLimit } : {},
						...withBuildBundlerOptions({
							onwarn: (() => {
								const userOnwarn = getBuildBundlerOptions(config.build)?.onwarn;
								return (warning, defaultHandler) => {
									if (warning.code === "MODULE_LEVEL_DIRECTIVE" && (warning.message?.includes("\"use client\"") || warning.message?.includes("\"use server\""))) return;
									if (warning.code === "IMPORT_IS_UNDEFINED" && warning.message?.includes("generateStaticParams")) return;
									if (warning.code === "IMPORT_IS_UNDEFINED" && /Import `(?:default|proxy|middleware)` will always be undefined/.test(warning.message ?? "") && /\b(?:proxy|middleware)\.\w+\b/.test(warning.message ?? "") && (warning.message?.includes("virtual:vinext-rsc-entry") || warning.message?.includes("virtual:vinext-server-entry"))) return;
									if (userOnwarn) userOnwarn(warning, defaultHandler);
									else defaultHandler(warning);
								};
							})(),
							...!isSSR && !isMultiEnv ? { treeshake: getClientTreeshakeConfig() } : {},
							...!isSSR && !isMultiEnv ? { output: getClientOutputConfig(clientAssetsDir) } : {}
						})
					},
					server: {
						cors: {
							preflightContinue: true,
							origin: /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/
						},
						hmr: devHmrConfig
					},
					...hasCloudflarePlugin || hasNitroPlugin ? {} : config.ssr?.external === true ? { ssr: { external: true } } : { ssr: {
						external: [
							"react",
							"react-dom",
							"react-dom/server",
							"ipaddr.js",
							...Array.isArray(config.ssr?.external) ? config.ssr.external : [],
							...nextServerExternal
						],
						noExternal: true
					} },
					resolve: {
						alias: buildResolveAliasEntries({
							...swcHelpersAlias ? { "@swc/helpers/_": swcHelpersAlias } : {},
							...tsconfigPathAliases,
							...nextConfig.aliases,
							...nextShimMap,
							"vinext/server/pages-client-assets": _pagesClientAssetsPath
						}, tsconfigPathAliases),
						dedupe: [
							"react",
							"react-dom",
							"react/jsx-runtime",
							"react/jsx-dev-runtime"
						],
						...shouldEnableNativeTsconfigPaths ? { tsconfigPaths: true } : {}
					},
					oxc: {
						jsx: { runtime: "automatic" },
						typescript: { onlyRemoveTypeImports: false }
					},
					define: defines,
					...nextConfig.basePath ? { base: nextConfig.basePath + "/" } : {},
					...nextConfig.assetPrefix || nextConfig.deploymentId ? { experimental: { renderBuiltUrl: (filename, context) => renderVinextBuiltUrl(filename, nextConfig.assetPrefix, nextConfig.deploymentId, context.hostType) } } : {},
					css: {
						...nextConfig.useLightningcss ? {
							transformer: "lightningcss",
							lightningcss: {
								...nextConfig.lightningCssFeatures.include ? { include: nextConfig.lightningCssFeatures.include } : {},
								...nextConfig.lightningCssFeatures.exclude ? { exclude: nextConfig.lightningCssFeatures.exclude } : {}
							}
						} : {},
						...postcssOverride ? { postcss: postcssOverride } : {},
						preprocessorOptions: (() => {
							const tildeImporter = createSassTildeImporter(root);
							const cssUrlAssetImporter = env.command === "build" ? createSassCssUrlAssetImporter() : null;
							const userAdditionalData = sassPreprocessorOptions?.additionalData;
							const baseOpts = {
								...sassPreprocessorOptions,
								...cssUrlAssetImporter ? { additionalData: async (source, filename) => {
									const withUserData = typeof userAdditionalData === "function" ? await userAdditionalData(source, filename) : typeof userAdditionalData === "string" ? `${userAdditionalData}${source}` : source;
									return cssUrlAssetImporter.rewriteImports(withUserData, filename);
								} } : {},
								importers: [
									tildeImporter,
									...cssUrlAssetImporter ? [cssUrlAssetImporter] : [],
									...sassPreprocessorOptions?.importers ?? []
								]
							};
							return {
								scss: baseOpts,
								sass: baseOpts
							};
						})(),
						...cssModulesOverride
					}
				};
				const userSsrExternal = Array.isArray(config.ssr?.external) ? [...config.ssr.external, ...nextServerExternal] : config.ssr?.external === true ? true : nextServerExternal;
				const externalizeSsrReactInDev = env.command === "serve" && !hasCloudflarePlugin && !hasNitroPlugin;
				const incomingExclude = config.optimizeDeps?.exclude ?? [];
				const incomingInclude = config.optimizeDeps?.include ?? [];
				const depOptimizeAliasPlugin = {
					name: "vinext:dep-optimize-alias",
					resolveId(id) {
						const shimBase = _reactServerShims.get(id);
						if (shimBase !== void 0) return resolveShimModulePath(shimsDir, shimBase);
					}
				};
				const depOptimizeNodeEnvOptions = getDepOptimizeNodeEnvOptions(nodeEnvDefine);
				viteConfig.optimizeDeps = {
					exclude: mergeOptimizeDepsExclude(incomingExclude, VINEXT_OPTIMIZE_DEPS_EXCLUDE, ["@tailwindcss/oxide"]),
					...incomingInclude.length > 0 ? { include: incomingInclude } : {},
					...depOptimizeNodeEnvOptions,
					rolldownOptions: {
						...depOptimizeNodeEnvOptions.rolldownOptions,
						plugins: [depOptimizeAliasPlugin]
					}
				};
				pagesOptimizeEntries = !hasAppDir ? [...hasPagesDir ? [toRelativeFileEntry(root, pagesDir) + "/**/*.{tsx,ts,jsx,js}"] : [], ...[instrumentationPath, instrumentationClientPath].flatMap((entry) => entry ? [toRelativeFileEntry(root, entry)] : [])] : [];
				if (hasAppDir) {
					const appEntries = [`${path.relative(root, appDir)}/**/*.{tsx,ts,jsx,js}`];
					const explicitInstrumentationEntries = [instrumentationPath, instrumentationClientPath].flatMap((entry) => entry ? [toRelativeFileEntry(root, entry)] : []);
					const optimizeEntries = [.../* @__PURE__ */ new Set([...appEntries, ...explicitInstrumentationEntries])];
					const appClientInput = { index: VIRTUAL_APP_BROWSER_ENTRY };
					if (hasPagesDir) appClientInput["vinext-client-entry"] = VIRTUAL_CLIENT_ENTRY;
					viteConfig.environments = {
						rsc: {
							...hasCloudflarePlugin || hasNitroPlugin ? {} : { resolve: {
								external: userSsrExternal === true ? true : [
									"satori",
									"@resvg/resvg-js",
									"yoga-wasm-web",
									...env?.command === "serve" && _canExternalizeAppRscHandler ? ["vinext/server/app-rsc-handler"] : [],
									...userSsrExternal
								],
								...userSsrExternal === true ? {} : { noExternal: true }
							} },
							optimizeDeps: {
								exclude: mergeOptimizeDepsExclude(incomingExclude, VINEXT_OPTIMIZE_DEPS_EXCLUDE),
								entries: optimizeEntries,
								include: [.../* @__PURE__ */ new Set([...incomingInclude, "react-server-dom-webpack/static.edge"])],
								...depOptimizeNodeEnvOptions
							},
							build: {
								outDir: options.rscOutDir ?? "dist/server",
								...withBuildBundlerOptions({
									input: { index: VIRTUAL_RSC_ENTRY },
									output: createRscFrameworkChunkOutputConfig()
								})
							}
						},
						ssr: {
							...hasCloudflarePlugin || hasNitroPlugin ? {} : { resolve: {
								external: userSsrExternal === true ? true : [
									...userSsrExternal,
									"ipaddr.js",
									...externalizeSsrReactInDev ? SSR_EXTERNAL_REACT_ENTRIES : []
								],
								...userSsrExternal === true ? {} : { noExternal: true }
							} },
							optimizeDeps: {
								exclude: mergeOptimizeDepsExclude(incomingExclude, VINEXT_OPTIMIZE_DEPS_EXCLUDE, ["ipaddr.js"], userSsrExternal === true || externalizeSsrReactInDev ? SSR_EXTERNAL_REACT_ENTRIES : []),
								entries: optimizeEntries,
								...depOptimizeNodeEnvOptions
							},
							build: {
								outDir: options.ssrOutDir ?? "dist/server/ssr",
								...withBuildBundlerOptions({ input: { index: VIRTUAL_APP_SSR_ENTRY } })
							}
						},
						client: {
							consumer: "client",
							optimizeDeps: {
								exclude: mergeOptimizeDepsExclude(incomingExclude, VINEXT_OPTIMIZE_DEPS_EXCLUDE, nextServerExternal),
								entries: optimizeEntries,
								include: [.../* @__PURE__ */ new Set([
									...incomingInclude,
									"react",
									"react-dom",
									"react-dom/client",
									"react/jsx-runtime",
									"react/jsx-dev-runtime"
								])],
								...depOptimizeNodeEnvOptions
							},
							build: {
								manifest: true,
								...hasPagesDir ? { ssrManifest: true } : {},
								assetsInlineLimit: clientAssetsInlineLimit,
								...withBuildBundlerOptions({
									input: appClientInput,
									output: getClientOutputConfig(clientAssetsDir, true),
									treeshake: getClientTreeshakeConfig()
								})
							}
						}
					};
				} else if (hasCloudflarePlugin) viteConfig.environments = { client: {
					consumer: "client",
					optimizeDeps: {
						...pagesOptimizeEntries.length > 0 ? { entries: pagesOptimizeEntries } : {},
						...depOptimizeNodeEnvOptions
					},
					build: {
						manifest: true,
						ssrManifest: true,
						assetsInlineLimit: clientAssetsInlineLimit,
						...withBuildBundlerOptions({
							input: { index: VIRTUAL_CLIENT_ENTRY },
							output: getClientOutputConfig(clientAssetsDir),
							treeshake: getClientTreeshakeConfig()
						})
					}
				} };
				else if (shouldInjectPlainPagesEnvironments) viteConfig.environments = {
					client: {
						consumer: "client",
						optimizeDeps: {
							...pagesOptimizeEntries.length > 0 ? { entries: pagesOptimizeEntries } : {},
							...depOptimizeNodeEnvOptions
						},
						build: {
							outDir: "dist/client",
							manifest: true,
							ssrManifest: true,
							assetsInlineLimit: clientAssetsInlineLimit,
							...withBuildBundlerOptions({
								input: { index: VIRTUAL_CLIENT_ENTRY },
								output: getClientOutputConfig(clientAssetsDir),
								treeshake: getClientTreeshakeConfig()
							})
						}
					},
					ssr: {
						resolve: {
							external: [
								"react",
								"react-dom",
								"react-dom/server",
								"ipaddr.js",
								...nextServerExternal
							],
							noExternal: true
						},
						optimizeDeps: {
							exclude: ["ipaddr.js"],
							...depOptimizeNodeEnvOptions
						},
						build: {
							outDir: "dist/server",
							...withBuildBundlerOptions({
								input: { index: VIRTUAL_SERVER_ENTRY },
								output: { entryFileNames: "entry.js" }
							})
						}
					}
				};
				if (pagesOptimizeEntries.length > 0 && !hasCloudflarePlugin) viteConfig.optimizeDeps = {
					...viteConfig.optimizeDeps,
					entries: pagesOptimizeEntries
				};
				return viteConfig;
			},
			configEnvironment(name, config) {
				if (isServeCommand && hasCloudflarePlugin && hasPagesDir && !hasAppDir && name !== "client") {
					config.optimizeDeps ??= {};
					config.optimizeDeps.entries = mergeStringArrayValues(config.optimizeDeps.entries, pagesOptimizeEntries);
					config.optimizeDeps.include = mergeStringArrayValues(config.optimizeDeps.include, PAGES_CLOUDFLARE_WORKER_OPTIMIZE_DEPS_INCLUDE);
					config.optimizeDeps.exclude = mergeOptimizeDepsExclude(config.optimizeDeps.exclude ?? [], VINEXT_OPTIMIZE_DEPS_EXCLUDE, PAGES_CLOUDFLARE_WORKER_OPTIMIZE_DEPS_EXCLUDE);
				}
				const configuredExtensions = name === "client" ? nextConfig.resolveExtensions : nextConfig.serverResolveExtensions;
				const extensions = configuredExtensions === null ? buildViteResolveExtensions(config.resolve?.extensions) : normalizeViteResolveExtensions(configuredExtensions);
				config.resolve ??= {};
				config.resolve.extensions = extensions;
				return null;
			},
			async configResolved(config) {
				if (isServeCommand && hasCloudflarePlugin && hasPagesDir && !hasAppDir) suppressOptionalOptimizeDepsWarnings(config.logger);
				sassComposesLoader.setResolvedConfig(config);
				if (config.command === "build" && hasAppDir && hasPagesDir) {
					const [appRoutes, pageRoutes, apiRoutes] = await Promise.all([
						appRouter(appDir, nextConfig?.pageExtensions, fileMatcher),
						pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher),
						apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher)
					]);
					validateHybridRouteConflicts([...pageRoutes, ...apiRoutes].map((route) => ({
						...route,
						sourcePath: path.relative(root, route.filePath)
					})), appRoutes.filter((route) => route.pagePath !== null || route.routePath !== null).map((route) => ({
						...route,
						sourcePath: path.relative(root, route.pagePath ?? route.routePath)
					})));
				}
				if (hasAppDir) {
					const ssrEnv = config.environments?.ssr;
					if (ssrEnv?.resolve?.external === true && Array.isArray(ssrEnv.resolve.noExternal)) ssrEnv.resolve.noExternal = ssrEnv.resolve.noExternal.filter((entry) => typeof entry !== "string" || !SSR_EXTERNAL_REACT_ENTRIES.includes(entry));
				}
				// @vitejs/plugin-react AND the user also registers it manually, the
				if (reactPluginPromise) {
					const reactRootPlugins = config.plugins.filter((p) => p && typeof p === "object" && "name" in p && typeof p.name === "string" && p.name.startsWith("vite:react"));
					const counts = /* @__PURE__ */ new Map();
					for (const plugin of reactRootPlugins) counts.set(plugin.name, (counts.get(plugin.name) ?? 0) + 1);
					if ([...counts.values()].some((count) => count > 1)) throw new Error("[vinext] Duplicate @vitejs/plugin-react detected.\n         vinext auto-registers @vitejs/plugin-react by default.\n         Your config also registers it manually, which duplicates React transforms.\n\n         Fix: remove the explicit react() call from your plugins array.\n         Or: pass react: false to vinext() if you want to configure react() yourself.");
				}
				// @vitejs/plugin-rsc AND the user also registers it manually, the
				if (rscPluginPromise) {
					if (config.plugins.filter((p) => p && typeof p === "object" && "name" in p && p.name === "rsc").length > 1) throw new Error("[vinext] Duplicate @vitejs/plugin-rsc detected.\n         vinext auto-registers @vitejs/plugin-rsc when app/ is detected.\n         Your config also registers it manually, which doubles build time.\n\n         Fix: remove the explicit rsc() call from your plugins array.\n         Or: pass rsc: false to vinext() if you want to configure rsc() yourself.");
				}
				if (config.command === "build" && !hasCloudflarePlugin && !hasNitroPlugin && hasWranglerConfig(root) && !options.disableAppRouter) throw new Error(formatMissingCloudflarePluginError({
					isAppRouter: hasAppDir,
					configFile: config.configFile
				}));
			},
			resolveId: {
				filter: { id: /(?:next\/|vinext\/(?:shims\/|server\/app-rsc-handler)|virtual:vinext-|@vercel\/og(?:\.js)?$)/ },
				handler(id, importer) {
					const cleanId = toSlash(id.startsWith("\0") ? id.slice(1) : id);
					if (cleanId === "vinext/server/app-rsc-handler") {
						if (_canExternalizeAppRscHandler && this.environment?.name === "rsc" && this.environment.config?.command === "serve") return {
							id: _appRscHandlerPath,
							external: true
						};
						return _appRscHandlerPath;
					}
					if (isVercelOgImport(cleanId) && !isVinextOgShimImporter(importer)) return resolveShimModulePath(_shimsDir, "og");
					if (cleanId.startsWith("vinext/shims/")) return resolveShimModulePath(_shimsDir, stripJsExtension(stripViteModuleQuery(cleanId.slice(13))));
					if (cleanId === VIRTUAL_WORKER_ENTRY) return RESOLVED_WORKER_ENTRY;
					if (cleanId.endsWith("/virtual:vinext-worker-entry")) return RESOLVED_WORKER_ENTRY;
					if (cleanId === VIRTUAL_SERVER_ENTRY) return RESOLVED_SERVER_ENTRY;
					if (cleanId === VIRTUAL_CLIENT_ENTRY) return RESOLVED_CLIENT_ENTRY;
					if (cleanId.endsWith("/virtual:vinext-server-entry")) return RESOLVED_SERVER_ENTRY;
					if (cleanId.endsWith("/virtual:vinext-client-entry")) return RESOLVED_CLIENT_ENTRY;
					if (cleanId === VIRTUAL_RSC_ENTRY) return RESOLVED_RSC_ENTRY;
					if (cleanId === VIRTUAL_APP_SSR_ENTRY) return RESOLVED_APP_SSR_ENTRY;
					if (cleanId === VIRTUAL_APP_BROWSER_ENTRY) return RESOLVED_APP_BROWSER_ENTRY;
					if (cleanId === VIRTUAL_APP_CAPABILITIES) return RESOLVED_APP_CAPABILITIES;
					if (cleanId === "next/root-params" || cleanId === "next/root-params.js") return RESOLVED_ROOT_PARAMS;
					if (cleanId === "virtual:vinext-cache-adapters" || cleanId.endsWith("/virtual:vinext-cache-adapters")) return RESOLVED_CACHE_ADAPTERS;
					if (cleanId === "virtual:vinext-image-adapters" || cleanId.endsWith("/virtual:vinext-image-adapters")) return RESOLVED_IMAGE_ADAPTERS;
					if (cleanId.startsWith("virtual:vinext-google-fonts?")) return RESOLVED_VIRTUAL_GOOGLE_FONTS + cleanId.slice(VIRTUAL_GOOGLE_FONTS.length);
					if (cleanId.endsWith("/virtual:vinext-rsc-entry")) return RESOLVED_RSC_ENTRY;
					if (cleanId.endsWith("/virtual:vinext-app-ssr-entry")) return RESOLVED_APP_SSR_ENTRY;
					if (cleanId.endsWith("/virtual:vinext-app-browser-entry")) return RESOLVED_APP_BROWSER_ENTRY;
					if (cleanId.includes("/virtual:vinext-google-fonts?")) {
						const queryIndex = cleanId.indexOf(VIRTUAL_GOOGLE_FONTS + "?");
						return RESOLVED_VIRTUAL_GOOGLE_FONTS + cleanId.slice(queryIndex + VIRTUAL_GOOGLE_FONTS.length);
					}
					const reactServerShim = _reactServerShims.get(cleanId);
					if (reactServerShim !== void 0) {
						const shimName = this.environment?.name === "rsc" ? `${reactServerShim}.react-server` : reactServerShim;
						return resolveShimModulePath(_shimsDir, shimName);
					}
				}
			},
			load: {
				filter: { id: /virtual:vinext-/ },
				async handler(id) {
					if (id === RESOLVED_WORKER_ENTRY) return `export { default } from ${JSON.stringify(hasAppDir ? "vinext/server/app-router-entry" : "vinext/server/pages-router-entry")};`;
					if (id === RESOLVED_SERVER_ENTRY) return await generateServerEntry$1();
					if (id === RESOLVED_CLIENT_ENTRY) return await generateClientEntry$1();
					if (id === RESOLVED_PAGES_CLIENT_ASSETS) {
						const metadata = { clientEntry: DEV_PAGES_CLIENT_ENTRY };
						const ssrManifest = {};
						const appFilePath = findFileWithExts(pagesDir, "_app", fileMatcher);
						const pagesRoutes = await pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
						const moduleFilePaths = [...appFilePath ? [appFilePath] : [], ...pagesRoutes.map((route) => route.filePath)];
						const getModuleDependencies = createDevPagesModuleDependencyReader(root, this.resolve.bind(this));
						for (const moduleFilePath of moduleFilePaths) {
							const stylesheetAssets = await collectDevPagesAppStylesheetAssets(moduleFilePath, getModuleDependencies);
							if (stylesheetAssets.length > 0) ssrManifest[toSlash(moduleFilePath)] = stylesheetAssets;
						}
						if (Object.keys(ssrManifest).length > 0) metadata.ssrManifest = ssrManifest;
						return `export default ${JSON.stringify(metadata)};`;
					}
					if (id === RESOLVED_RSC_ENTRY && hasAppDir) {
						const routes = await appRouter(appDir, nextConfig?.pageExtensions, fileMatcher);
						const metaRoutes = scanMetadataFiles(appDir);
						const hasServerActions = await resolveHasServerActions(this.environment.config);
						const globalErrorPath = findFileWithExts(appDir, "global-error", fileMatcher);
						const globalNotFoundPath = nextConfig?.globalNotFound ? findFileWithExts(appDir, "global-not-found", fileMatcher) : null;
						rscClassificationManifest = collectRouteClassificationManifest(routes);
						return generateRscEntry(appDir, routes, middlewarePath, metaRoutes, globalErrorPath, nextConfig?.basePath, nextConfig?.trailingSlash, {
							redirects: nextConfig?.redirects,
							rewrites: nextConfig?.rewrites,
							headers: nextConfig?.headers,
							allowedOrigins: nextConfig?.serverActionsAllowedOrigins,
							allowedDevOrigins: nextConfig?.allowedDevOrigins,
							bodySizeLimit: nextConfig?.serverActionsBodySizeLimit,
							bodySizeLimitLabel: nextConfig?.serverActionsBodySizeLimitLabel,
							htmlLimitedBots: nextConfig?.htmlLimitedBots,
							clientTraceMetadata: nextConfig?.clientTraceMetadata,
							assetPrefix: nextConfig?.assetPrefix,
							expireTime: nextConfig?.expireTime,
							reactMaxHeadersLength: nextConfig?.reactMaxHeadersLength,
							cacheMaxMemorySize: nextConfig?.cacheMaxMemorySize,
							inlineCss: nextConfig?.inlineCss,
							globalNotFound: nextConfig?.globalNotFound,
							cacheComponents: nextConfig?.cacheComponents,
							prefetchInlining: nextConfig?.prefetchInlining,
							hasServerActions,
							i18n: nextConfig?.i18n,
							imageConfig: {
								deviceSizes: nextConfig?.images?.deviceSizes,
								imageSizes: nextConfig?.images?.imageSizes,
								qualities: nextConfig?.images?.qualities,
								dangerouslyAllowSVG: nextConfig?.images?.dangerouslyAllowSVG,
								dangerouslyAllowLocalIP: nextConfig?.images?.dangerouslyAllowLocalIP,
								contentDispositionType: nextConfig?.images?.contentDispositionType,
								contentSecurityPolicy: nextConfig?.images?.contentSecurityPolicy
							},
							hasPagesDir,
							publicFiles: scanPublicFileRoutes(root),
							globalNotFoundPath,
							draftModeSecret
						}, instrumentationPath);
					}
					if (id === RESOLVED_ROOT_PARAMS) return generateRootParamsModule((hasAppDir ? await appRouter(appDir, nextConfig?.pageExtensions, fileMatcher) : []).flatMap((route) => route.rootParamNames ?? []));
					if (id === RESOLVED_CACHE_ADAPTERS) return generateCacheAdaptersModule(options.cache);
					if (id === RESOLVED_IMAGE_ADAPTERS) return generateImageAdaptersModule(options.images);
					if (id === RESOLVED_APP_SSR_ENTRY && hasAppDir) return generateSsrEntry(hasPagesDir);
					if (id === RESOLVED_APP_BROWSER_ENTRY && hasAppDir) {
						const graph = await appRouteGraph(appDir, nextConfig?.pageExtensions, fileMatcher);
						const pagesPrefetchRoutes = hasPagesDir ? [...(await pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher)).map((route) => ({
							canPrefetchLoadingShell: false,
							isDynamic: route.isDynamic,
							patternParts: [...route.patternParts]
						})), ...(await apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher)).map((route) => ({
							canPrefetchLoadingShell: false,
							documentOnly: true,
							isDynamic: route.isDynamic,
							patternParts: [...route.patternParts]
						}))] : [];
						return generateBrowserEntry(graph.routes, graph.routeManifest, pagesPrefetchRoutes, nextConfig.rewrites);
					}
					if (id === RESOLVED_APP_CAPABILITIES && hasAppDir) {
						const hasServerActions = await resolveHasServerActions(this.environment.config);
						return `
export const hasServerActions = ${JSON.stringify(hasServerActions)};
export const loadServerActionClient = ${hasServerActions ? `() => import(${JSON.stringify(_appBrowserServerActionClientPath)})` : "null"};
`;
					}
					if (id.startsWith("\0virtual:vinext-google-fonts?")) return generateGoogleFontsVirtualModule(id, _fontGoogleShimPath);
				}
			},
			// @vitejs/plugin-rsc runs the RSC environment build in two phases:
			renderChunk: {
				order: "pre",
				handler(code, chunk) {
					if (this.environment?.name !== "rsc") return null;
					if (!rscClassificationManifest) return null;
					if (!code.includes("__VINEXT_CLASS")) return null;
					const enableClassificationDebug = Boolean(process.env.VINEXT_DEBUG_CLASSIFICATION);
					const patchPlan = planRouteClassificationInjection({
						canonicalizeLayoutPath: canonicalize,
						chunks: [{
							code,
							fileName: chunk.fileName
						}],
						dynamicShimPaths,
						enableDebugReasons: enableClassificationDebug,
						manifest: rscClassificationManifest,
						moduleInfo: { getModuleInfo: (moduleId) => {
							const info = this.getModuleInfo(moduleId);
							if (!info) return null;
							return {
								importedIds: info.importedIds ?? [],
								dynamicImportedIds: info.dynamicallyImportedIds ?? []
							};
						} }
					});
					if (patchPlan.kind === "skip") return null;
					rscClassificationManifest = null;
					return {
						code: patchPlan.code,
						map: patchPlan.map
					};
				}
			}
		},
		{
			name: "vinext:pages-client-assets-resolver",
			sharedDuringBuild: true,
			resolveId: {
				filter: { id: /virtual:vinext-pages-client-assets$/ },
				handler(id) {
					const cleanId = toSlash(id.startsWith("\0") ? id.slice(1) : id);
					if (cleanId !== VIRTUAL_PAGES_CLIENT_ASSETS && !cleanId.endsWith("/virtual:vinext-pages-client-assets")) return;
					if (this.environment?.config.command !== "build") return RESOLVED_PAGES_CLIENT_ASSETS;
					const buildRoot = this.environment.config.root ?? process.cwd();
					const environmentOutDir = path.resolve(buildRoot, this.environment.config.build.outDir);
					const sidecarDir = !hasAppDir && this.environment.name === "ssr" ? path.dirname(environmentOutDir) : environmentOutDir;
					let externalId = path.relative(environmentOutDir, path.join(sidecarDir, PAGES_CLIENT_ASSETS_MODULE));
					if (!externalId.startsWith(".")) externalId = `./${externalId}`;
					pagesClientAssetsOutputDirs.add(sidecarDir);
					return {
						id: externalId,
						external: true
					};
				}
			}
		},
		{
			name: "vinext:css-url-assets-mark",
			enforce: "pre",
			apply: "build",
			transform: {
				filter: {
					id: /\.(?:css|scss|sass|less|styl|stylus)(?:\?|$)/i,
					code: "url("
				},
				handler(code, id) {
					const marked = markCssUrlAssetReferences(code, id);
					if (marked === null) return null;
					return {
						code: marked,
						map: null
					};
				}
			}
		},
		{
			name: "vinext:css-url-assets-defaults",
			apply: "build",
			configEnvironment(name, config) {
				if (name === "client") return { build: { assetsInlineLimit: clientAssetsInlineLimit } };
				if (!hasAppDir || name !== "rsc" && name !== "ssr") return null;
				const output = getBuildBundlerOptions(config.build)?.output;
				if (Array.isArray(output) || output?.assetFileNames !== void 0) return null;
				return { build: { ...withBuildBundlerOptions({ output: { assetFileNames: createClientAssetFileNames(resolveAssetsDir(nextConfig.assetPrefix ?? "")) } }) } };
			}
		},
		{
			name: "vinext:server-minify-defaults",
			apply: "build",
			configEnvironment(name, config) {
				if (name === "client") return null;
				if (config.build?.minify !== void 0) return null;
				return { build: { minify: true } };
			}
		},
		{
			name: "vinext:css-url-assets-restore",
			enforce: "post",
			apply: "build",
			generateBundle(_options, bundle) {
				restoreDedupedCssAssetReferences(bundle, (asset) => {
					this.emitFile({
						type: "asset",
						fileName: asset.fileName,
						source: asset.source
					});
				});
			}
		},
		{
			name: "vinext:client-entry-manifest",
			apply: "build",
			generateBundle(_options, bundle) {
				if (this.environment?.name !== "client") return;
				const manifest = {};
				for (const chunk of Object.values(bundle)) {
					if (chunk.type !== "chunk" || !chunk.isEntry) continue;
					if (isVirtualEntryFacade(chunk.facadeModuleId, VIRTUAL_CLIENT_ENTRY)) manifest.pagesClientEntry = chunk.fileName;
					else if (isVirtualEntryFacade(chunk.facadeModuleId, VIRTUAL_APP_BROWSER_ENTRY)) manifest.appBrowserEntry = chunk.fileName;
				}
				if (!manifest.pagesClientEntry && !manifest.appBrowserEntry) return;
				this.emitFile({
					type: "asset",
					fileName: VINEXT_CLIENT_ENTRY_MANIFEST,
					source: JSON.stringify(manifest, null, 2) + "\n"
				});
			}
		},
		asyncHooksStubPlugin,
		createInstrumentationClientTransformPlugin(() => instrumentationClientPath),
		{
			name: "vinext:instrumentation-client-inject",
			enforce: "pre",
			resolveId: {
				filter: { id: /^private-next-instrumentation-client$/ },
				handler(id) {
					if (id !== VIRTUAL_INSTRUMENTATION_CLIENT) return null;
					return clientInjectModule !== null ? RESOLVED_INSTRUMENTATION_CLIENT : null;
				}
			},
			load: {
				filter: { id: /private-next-instrumentation-client\.mjs$/ },
				handler(id) {
					if (id !== RESOLVED_INSTRUMENTATION_CLIENT) return null;
					return clientInjectModule;
				}
			}
		},
		...options.experimental?.clientReferenceDedup ? [clientReferenceDedupPlugin()] : [],
		mdxConfigProxyPlugin,
		createCssModuleImportCompatibilityPlugin({ compiledMdx: true }),
		{
			name: "vinext:react-canary",
			enforce: "pre",
			resolveId: {
				filter: { id: /^virtual:vinext-react-canary$/ },
				handler(id) {
					if (id === "virtual:vinext-react-canary") return "\0virtual:vinext-react-canary";
				}
			},
			load: {
				filter: { id: /^\u0000virtual:vinext-react-canary$/ },
				handler(id) {
					if (id === "\0virtual:vinext-react-canary") return [
						`export * from "react";`,
						`export { default } from "react";`,
						`import * as _React from "react";`,
						`export const ViewTransition = _React.ViewTransition || function ViewTransition({ children }) { return children; };`,
						`export const addTransitionType = _React.addTransitionType || function addTransitionType() {};`
					].join("\n");
				}
			},
			transform: {
				filter: {
					id: {
						include: /\.(tsx?|jsx?|mjs)$/,
						exclude: [/node_modules/, VIRTUAL_MODULE_ID_RE]
					},
					code: /import\s*\{[^}]*(ViewTransition|addTransitionType)[^}]*\}\s*from\s*['"]react['"]/
				},
				handler(code) {
					return {
						code: code.replace(/from\s*['"]react['"]/g, "from \"virtual:vinext-react-canary\""),
						map: null
					};
				}
			}
		},
		{
			name: "vinext:pages-router",
			// @vitejs/plugin-react to handle normal module updates. Next.js preserves
			hotUpdate: {
				order: "post",
				handler(options) {
					if (!hasPagesDir) return;
					const isPagesAppFile = (filePath) => {
						const relativePath = path.relative(pagesDir, filePath);
						return !relativePath.includes("/") && relativePath.startsWith("_app.") && fileMatcher.extensionRegex.test(filePath);
					};
					const isPotentialPagesAssetGraphScript = (filePath) => {
						const cleanPath = stripViteModuleQuery(filePath);
						if (!path.isAbsolute(cleanPath)) return false;
						if (!isScriptModuleId(cleanPath) || cleanPath.endsWith(".d.ts")) return false;
						const relativeRootPath = path.relative(root, cleanPath);
						if (relativeRootPath.startsWith("..") || path.isAbsolute(relativeRootPath)) return false;
						if (relativeRootPath.includes("/node_modules/") || relativeRootPath.startsWith("node_modules/")) return false;
						const relativeAppPath = path.relative(appDir, cleanPath);
						return relativeAppPath.startsWith("..") || path.isAbsolute(relativeAppPath);
					};
					const pagesAppChanged = isPagesAppFile(options.file);
					const pagesAssetGraphScriptChanged = isPotentialPagesAssetGraphScript(options.file);
					if (pagesAppChanged || STYLESHEET_FILE_RE.test(options.file) || pagesAssetGraphScriptChanged) for (const env of Object.values(options.server.environments)) {
						const mod = env.moduleGraph.getModuleById(RESOLVED_PAGES_CLIENT_ASSETS);
						if (mod) env.moduleGraph.invalidateModule(mod);
					}
					if (this.environment?.name === "ssr" && pagesAssetGraphScriptChanged) {
						for (const mod of options.modules) this.environment.moduleGraph.invalidateModule(mod, /* @__PURE__ */ new Set(), options.timestamp, true);
						return [];
					}
				}
			},
			configureServer(server) {
				server.middlewares.use((req, _res, next) => {
					req.__vinextOriginalEncodedUrl ??= req.url;
					next();
				});
				const pageExtensions = fileMatcher.extensionRegex;
				let pagesRunner = null;
				let cachedSSRHandler = null;
				function getPagesRunner() {
					if (!pagesRunner) pagesRunner = createDirectRunner(server.environments["ssr"] ?? Object.values(server.environments).find((e) => e !== server.environments["rsc"]) ?? Object.values(server.environments)[0]);
					return pagesRunner;
				}
				/**
				* Invalidate the virtual RSC entry module in Vite's module graph.
				*
				* The App Router route table is baked into the virtual RSC entry
				* at generation time. When routes are added or removed, clearing
				* the route cache alone is not enough: the virtual module must
				* also be invalidated so Vite re-calls the load() hook to
				* regenerate the entry with the updated route table.
				*/
				function invalidateRscEntryModule() {
					const rscEnv = server.environments["rsc"];
					if (!rscEnv) return;
					const mod = rscEnv.moduleGraph.getModuleById(RESOLVED_RSC_ENTRY);
					if (mod) {
						rscEnv.moduleGraph.invalidateModule(mod);
						rscEnv.hot.send({ type: "full-reload" });
					}
				}
				function invalidateRootParamsModule() {
					for (const env of Object.values(server.environments)) {
						const mod = env.moduleGraph.getModuleById(RESOLVED_ROOT_PARAMS);
						if (mod) env.moduleGraph.invalidateModule(mod);
					}
				}
				function invalidateHybridClientEntries() {
					if (!hasAppDir || !hasPagesDir) return;
					for (const env of Object.values(server.environments)) for (const id of [RESOLVED_CLIENT_ENTRY, RESOLVED_APP_BROWSER_ENTRY]) {
						const mod = env.moduleGraph.getModuleById(id);
						if (mod) env.moduleGraph.invalidateModule(mod);
					}
					server.ws.send({ type: "full-reload" });
				}
				function invalidatePagesServerEntry() {
					for (const env of Object.values(server.environments)) {
						const mod = env.moduleGraph.getModuleById(RESOLVED_SERVER_ENTRY);
						if (mod) env.moduleGraph.invalidateModule(mod);
					}
					pagesRunner?.clearCache();
				}
				function invalidatePagesClientAssetsModule() {
					for (const env of Object.values(server.environments)) {
						const mod = env.moduleGraph.getModuleById(RESOLVED_PAGES_CLIENT_ASSETS);
						if (mod) env.moduleGraph.invalidateModule(mod);
					}
					pagesRunner?.clearCache();
				}
				function invalidateAppRoutingModules() {
					invalidateAppRouteCache();
					invalidateMetadataFileCache();
					invalidateRscEntryModule();
					invalidateRootParamsModule();
				}
				let hybridRouteValidation = Promise.resolve();
				let hybridRouteValidationError = null;
				function sendHybridRouteValidationError(error) {
					server.ws.send({
						type: "error",
						err: {
							message: error.message,
							stack: error.stack ?? error.message
						}
					});
				}
				server.ws.on("connection", () => {
					if (hybridRouteValidationError) sendHybridRouteValidationError(hybridRouteValidationError);
				});
				function revalidateHybridRoutes() {
					if (!hasAppDir || !hasPagesDir) return;
					hybridRouteValidation = hybridRouteValidation.catch(() => {}).then(async () => {
						const [appRoutes, pageRoutes, apiRoutes] = await Promise.all([
							appRouter(appDir, nextConfig?.pageExtensions, fileMatcher),
							pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher),
							apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher)
						]);
						validateHybridRouteConflicts([...pageRoutes, ...apiRoutes].map((route) => ({
							...route,
							sourcePath: path.relative(root, route.filePath)
						})), appRoutes.filter((route) => route.pagePath !== null || route.routePath !== null).map((route) => ({
							...route,
							sourcePath: path.relative(root, route.pagePath ?? route.routePath)
						})));
						if (hybridRouteValidationError) {
							hybridRouteValidationError = null;
							server.ws.send({ type: "full-reload" });
						}
					}).catch((error) => {
						const err = error instanceof Error ? error : new Error(String(error));
						hybridRouteValidationError = err;
						sendHybridRouteValidationError(err);
					});
				}
				let appRouteTypeGeneration = null;
				let appRouteTypeGenerationPending = false;
				function isPagesAppFile(filePath) {
					const relativePath = path.relative(pagesDir, filePath);
					return !relativePath.includes("/") && relativePath.startsWith("_app.") && fileMatcher.extensionRegex.test(filePath);
				}
				function isPotentialPagesAssetGraphScript(filePath) {
					const cleanPath = stripViteModuleQuery(filePath);
					if (!path.isAbsolute(cleanPath)) return false;
					if (!isScriptModuleId(cleanPath) || cleanPath.endsWith(".d.ts")) return false;
					const relativeRootPath = path.relative(root, cleanPath);
					if (relativeRootPath.startsWith("..") || path.isAbsolute(relativeRootPath)) return false;
					if (relativeRootPath.includes("/node_modules/") || relativeRootPath.startsWith("node_modules/")) return false;
					const relativeAppPath = path.relative(appDir, cleanPath);
					return relativeAppPath.startsWith("..") || path.isAbsolute(relativeAppPath);
				}
				function warnRouteTypeGenerationFailure(error) {
					server.config.logger.warn(`[vinext] Failed to regenerate route types: ${error instanceof Error ? error.message : String(error)}`);
				}
				async function drainAppRouteTypeGeneration() {
					while (appRouteTypeGenerationPending) {
						appRouteTypeGenerationPending = false;
						try {
							await writeRouteTypes();
						} catch (error) {
							warnRouteTypeGenerationFailure(error);
						}
					}
				}
				function regenerateAppRouteTypes() {
					appRouteTypeGenerationPending = true;
					if (appRouteTypeGeneration) return;
					appRouteTypeGeneration = drainAppRouteTypeGeneration().finally(() => {
						appRouteTypeGeneration = null;
						if (appRouteTypeGenerationPending) regenerateAppRouteTypes();
					});
				}
				regenerateAppRouteTypes();
				revalidateHybridRoutes();
				server.httpServer?.on("connection", (socket) => {
					socket.on("error", () => {});
				});
				server.watcher.on("add", (filePath) => {
					let routeChanged = false;
					const pagesAppChanged = isPagesAppFile(filePath);
					const pagesAssetGraphScriptChanged = isPotentialPagesAssetGraphScript(filePath);
					if (hasPagesDir && (pagesAppChanged || STYLESHEET_FILE_RE.test(filePath) || pagesAssetGraphScriptChanged)) invalidatePagesClientAssetsModule();
					if (hasPagesDir && toSlash(filePath).startsWith(pagesDir) && pageExtensions.test(filePath)) {
						invalidateRouteCache(pagesDir);
						routeChanged = true;
					}
					if (hasAppDir && shouldInvalidateAppRouteFile(appDir, filePath, fileMatcher)) {
						invalidateAppRoutingModules();
						regenerateAppRouteTypes();
						routeChanged = true;
					}
					if (routeChanged) {
						invalidatePagesServerEntry();
						if (!hasAppDir) server.ws.send({ type: "full-reload" });
						invalidateHybridClientEntries();
						revalidateHybridRoutes();
					}
				});
				server.watcher.on("change", (filePath) => {
					const pagesAppChanged = isPagesAppFile(filePath);
					const pagesAssetGraphScriptChanged = isPotentialPagesAssetGraphScript(filePath);
					if (hasPagesDir && (pagesAppChanged || STYLESHEET_FILE_RE.test(filePath) || pagesAssetGraphScriptChanged)) invalidatePagesClientAssetsModule();
				});
				server.watcher.on("unlink", (filePath) => {
					let routeChanged = false;
					const pagesAppChanged = isPagesAppFile(filePath);
					const pagesAssetGraphScriptChanged = isPotentialPagesAssetGraphScript(filePath);
					if (hasPagesDir && (pagesAppChanged || STYLESHEET_FILE_RE.test(filePath) || pagesAssetGraphScriptChanged)) invalidatePagesClientAssetsModule();
					if (hasPagesDir && toSlash(filePath).startsWith(pagesDir) && pageExtensions.test(filePath)) {
						invalidateRouteCache(pagesDir);
						routeChanged = true;
					}
					if (hasAppDir && shouldInvalidateAppRouteFile(appDir, filePath, fileMatcher)) {
						invalidateAppRoutingModules();
						regenerateAppRouteTypes();
						routeChanged = true;
					}
					if (routeChanged) {
						invalidatePagesServerEntry();
						if (!hasAppDir) server.ws.send({ type: "full-reload" });
						invalidateHybridClientEntries();
						revalidateHybridRoutes();
					}
				});
				server.middlewares.use((req, res, next) => {
					const blockReason = validateDevRequest({
						origin: req.headers.origin,
						host: req.headers.host,
						"x-forwarded-host": req.headers["x-forwarded-host"],
						"sec-fetch-site": req.headers["sec-fetch-site"],
						"sec-fetch-mode": req.headers["sec-fetch-mode"]
					}, nextConfig?.allowedDevOrigins);
					if (blockReason) {
						console.warn(`[vinext] Blocked dev request: ${blockReason} (${req.url})`);
						res.writeHead(403, { "Content-Type": "text/plain" });
						res.end("Forbidden");
						return;
					}
					next();
				});
				installDevStackSourcemapMiddleware(server);
				return () => {
					const viteFilesystemMiddlewares = server.middlewares.stack.filter(({ handle }) => {
						const name = typeof handle === "function" ? handle.name : "";
						return name === "viteServePublicMiddleware" || name === "viteServeStaticMiddleware";
					}).map(({ handle }) => handle).filter((handle) => typeof handle === "function");
					const serveRewrittenViteFilesystemRoute = async (req, res, requestPathname, stagedHeaders) => {
						const originalUrl = req.url;
						const originalStatusCode = res.statusCode;
						const originalStatusMessage = res.statusMessage;
						const originalHeaders = res.getHeaders();
						req.url = requestPathname;
						for (const [key, value] of Object.entries(stagedHeaders)) res.setHeader(key, value);
						const restore = () => {
							req.url = originalUrl;
							res.statusCode = originalStatusCode;
							res.statusMessage = originalStatusMessage;
							for (const key of Object.keys(res.getHeaders())) res.removeHeader(key);
							for (const [key, value] of Object.entries(originalHeaders)) if (value !== void 0) res.setHeader(key, value);
						};
						try {
							for (const middleware of viteFilesystemMiddlewares) if (await new Promise((resolve, reject) => {
								let settled = false;
								const settle = (value, error) => {
									if (settled) return;
									settled = true;
									res.off("finish", onServed);
									res.off("close", onServed);
									if (error) reject(error);
									else resolve(value);
								};
								const onServed = () => settle("served");
								res.once("finish", onServed);
								res.once("close", onServed);
								middleware(req, res, (error) => settle("next", error));
								if (res.writableEnded) settle("served");
							}) === "served") {
								req.url = originalUrl;
								return true;
							}
						} catch (error) {
							restore();
							throw error;
						}
						restore();
						return false;
					};
					if (instrumentationPath && !hasAppDir) runInstrumentation(getPagesRunner(), instrumentationPath).catch((err) => {
						console.error("[vinext] Instrumentation error:", err);
					});
					if (hasAppDir) server.middlewares.use((req, res, next) => {
						const url = req.url ?? "/";
						const [pathname] = url.split("?");
						if (url.startsWith("/@") || url.startsWith("/__vite") || url.startsWith("/node_modules") || url.includes(".") && !pathname.endsWith(".html") && !pathname.endsWith(".rsc")) return next();
						const _reqStart = now();
						let _compileMs;
						let _renderMs;
						function _parseTiming(raw) {
							const [handlerStart, inHandlerCompileMs, renderMs] = String(raw).split(",").map((v) => Number(v));
							if (!Number.isNaN(handlerStart) && !Number.isNaN(inHandlerCompileMs) && inHandlerCompileMs !== -1) _compileMs = Math.max(0, Math.round(handlerStart - _reqStart)) + inHandlerCompileMs;
							if (!Number.isNaN(renderMs) && renderMs !== -1) _renderMs = renderMs;
						}
						const _origSetHeader = res.setHeader.bind(res);
						res.setHeader = function(name, value) {
							if (name.toLowerCase() === "x-vinext-timing") {
								_parseTiming(value);
								return res;
							}
							return _origSetHeader(name, value);
						};
						const _origWriteHead = res.writeHead.bind(res);
						res.writeHead = function(statusCode, ...args) {
							let headers;
							const [reasonOrHeaders, maybeHeaders] = args;
							if (typeof reasonOrHeaders === "string") headers = maybeHeaders;
							else headers = reasonOrHeaders;
							if (headers && typeof headers === "object" && !Array.isArray(headers)) {
								const timingKey = Object.keys(headers).find((k) => k.toLowerCase() === VINEXT_TIMING_HEADER);
								if (timingKey) {
									_parseTiming(headers[timingKey]);
									delete headers[timingKey];
								}
							}
							return _origWriteHead(statusCode, ...args);
						};
						res.on("finish", () => {
							const logUrl = url.replace(/\.rsc(\?|$)/, "$1");
							const totalMs = now() - _reqStart;
							const resolvedRenderMs = _renderMs !== void 0 ? _renderMs : _compileMs !== void 0 ? Math.max(0, Math.round(totalMs - _compileMs)) : void 0;
							logRequest({
								method: req.method ?? "GET",
								url: logUrl,
								status: res.statusCode,
								totalMs,
								compileMs: _compileMs,
								renderMs: resolvedRenderMs
							});
						});
						next();
					});
					const handlePagesMiddleware = async (req, res, next) => {
						try {
							let url = req.url ?? "/";
							const originalRequestUrl = url;
							if (!hasPagesDir) return next();
							if (url.startsWith("/@") || url.startsWith("/__vite") || url.startsWith("/node_modules")) return next();
							if (url.split("?")[0].endsWith(".rsc")) return next();
							const blockReason = validateDevRequest({
								origin: req.headers.origin,
								host: req.headers.host,
								"x-forwarded-host": req.headers["x-forwarded-host"],
								"sec-fetch-site": req.headers["sec-fetch-site"],
								"sec-fetch-mode": req.headers["sec-fetch-mode"]
							}, nextConfig?.allowedDevOrigins);
							if (blockReason) {
								console.warn(`[vinext] Blocked dev request: ${blockReason} (${url})`);
								res.writeHead(403, { "Content-Type": "text/plain" });
								res.end("Forbidden");
								return;
							}
							const requestHost = (Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host) || "localhost";
							const requestOrigin = `http://${requestHost}`;
							const getUrlHostname = (requestUrl) => new URL(requestUrl).hostname;
							if (isImageOptimizationPath(url.split("?")[0])) {
								const encodedLocation = resolveDevImageRedirect(new URL(url, requestOrigin), [...nextConfig.images?.deviceSizes ?? DEFAULT_DEVICE_SIZES, ...nextConfig.images?.imageSizes ?? DEFAULT_IMAGE_SIZES], nextConfig.images?.qualities);
								if (!encodedLocation) {
									res.writeHead(400);
									res.end("Invalid image optimization parameters");
									return;
								}
								res.writeHead(302, { Location: encodedLocation });
								res.end();
								return;
							}
							const originalEncodedUrl = req.__vinextOriginalEncodedUrl ?? url;
							const originalEncodedPathname = originalEncodedUrl.split("?")[0];
							if (isOpenRedirectShaped(originalEncodedPathname)) {
								res.writeHead(404);
								res.end("This page could not be found");
								return;
							}
							const canonicalOriginalUrl = canonicalizeRequestUrlPathname(originalEncodedUrl);
							url = canonicalizeRequestUrlPathname(url);
							const rawPathname = url.split("?")[0];
							if (rawPathname.endsWith("/index.html")) url = url.replace("/index.html", "/");
							else if (rawPathname.endsWith(".html")) url = url.replace(/\.html(?=\?|$)/, "");
							let middlewareUrl = canonicalOriginalUrl;
							let routeUrl = middlewareUrl;
							{
								const routePathname = routeUrl.split("?")[0];
								if (routePathname.endsWith("/index.html")) routeUrl = routeUrl.replace("/index.html", "/");
								else if (routePathname.endsWith(".html")) routeUrl = routeUrl.replace(/\.html(?=\?|$)/, "");
							}
							let pathname = url.split("?")[0];
							if (isOpenRedirectShaped(pathname)) {
								res.writeHead(404);
								res.end("This page could not be found");
								return;
							}
							pathname = pathname.replaceAll("\\", "/");
							try {
								pathname = normalizePath$1(normalizePathnameForRouteMatchStrict(pathname));
							} catch {
								res.writeHead(400);
								res.end("Bad Request");
								return;
							}
							if (urlParserCreatesPagesDataPath(pathname)) {
								res.writeHead(404);
								res.end("This page could not be found");
								return;
							}
							pathname = encodeUrlParserIgnoredCharacters(pathname);
							{
								const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
								url = pathname + qs;
							}
							const capturedMiddlewarePath = middlewarePath;
							const bp = nextConfig?.basePath ?? "";
							const viteBase = server.config.base;
							const viteBasePath = viteBase.startsWith("/") && viteBase !== "/" ? viteBase.replace(/\/+$/, "") : "";
							const routingBasePath = bp || viteBasePath;
							if (routingBasePath) {
								if (hasBasePath(pathname, routingBasePath)) {
									const stripped = stripBasePath(pathname, routingBasePath);
									url = stripped + (url.includes("?") ? url.slice(url.indexOf("?")) : "");
									pathname = stripped;
								}
								const middlewarePathname = middlewareUrl.split("?")[0];
								if (hasBasePath(middlewarePathname, routingBasePath)) {
									const middlewareQs = middlewareUrl.includes("?") ? middlewareUrl.slice(middlewareUrl.indexOf("?")) : "";
									middlewareUrl = stripBasePath(middlewarePathname, routingBasePath) + middlewareQs;
								}
								const routePathname = routeUrl.split("?")[0];
								if (hasBasePath(routePathname, routingBasePath)) {
									const routeQs = routeUrl.includes("?") ? routeUrl.slice(routeUrl.indexOf("?")) : "";
									routeUrl = stripBasePath(routePathname, routingBasePath) + routeQs;
								}
							}
							let configMatchPathname = stripBasePath(middlewareUrl.split("?")[0], routingBasePath);
							if (nextConfig) {
								const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
								const trailingSlashRedirect = normalizeTrailingSlash(routeUrl.split("?")[0], bp, nextConfig.trailingSlash, qs);
								if (trailingSlashRedirect) {
									const location = trailingSlashRedirect.headers.get("Location");
									res.writeHead(trailingSlashRedirect.status, location ? { Location: location } : void 0);
									res.end();
									return;
								}
							}
							if (hasCloudflarePlugin) return next();
							let isDataReq = false;
							if (isNextDataPathname(pathname)) {
								const devBuildId = nextConfig?.buildId ?? process.env.__VINEXT_BUILD_ID ?? "development";
								const dataMatch = parseNextDataPathname(pathname, devBuildId);
								if (dataMatch) {
									isDataReq = true;
									const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
									const pagePathname = normalizeNextDataPagePathname(dataMatch.pagePathname, capturedMiddlewarePath !== null && nextConfig?.trailingSlash === true);
									url = pagePathname + qs;
									middlewareUrl = url;
									routeUrl = url;
									pathname = pagePathname;
									configMatchPathname = pagePathname;
									req.url = url;
								} else {
									const deploymentId = process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
									const notFoundHeaders = { "Content-Type": "application/json" };
									if (deploymentId) notFoundHeaders[NEXTJS_DEPLOYMENT_ID_HEADER] = deploymentId;
									res.writeHead(404, notFoundHeaders);
									res.end("{}");
									return;
								}
							}
							const filePathMatchesRewrite = [
								...nextConfig?.rewrites.beforeFiles ?? [],
								...nextConfig?.rewrites.afterFiles ?? [],
								...nextConfig?.rewrites.fallback ?? []
							].some((rewrite) => matchesRewriteSource(pathname, rewrite, {
								basePath: bp,
								hadBasePath: true
							}));
							const isFilePathRequest = pathname.includes(".") && !pathname.endsWith(".html");
							let filePathMatchesPagesRoute = false;
							const requestHostname = getUrlHostname(requestOrigin);
							if (isFilePathRequest && !filePathMatchesRewrite) {
								const [pageRoutes, apiRoutes] = await Promise.all([pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher), apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher)]);
								const pageRouteUrl = nextConfig?.i18n ? resolvePagesI18nRequest(pathname, nextConfig.i18n, req.headers, requestHostname, bp, nextConfig.trailingSlash ?? false).url : pathname;
								const apiRouteUrl = stripI18nLocaleForApiRoute(pathname, nextConfig?.i18n ?? null);
								filePathMatchesPagesRoute = matchRoute(pageRouteUrl, pageRoutes) !== null || matchRoute(apiRouteUrl, apiRoutes) !== null;
							}
							if (isFilePathRequest && !filePathMatchesRewrite && !filePathMatchesPagesRoute) return next();
							const rawHeaders = new Headers(Object.fromEntries(Object.entries(req.headers).filter(([k, v]) => v !== void 0 && !k.startsWith(":")).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)])));
							const isDataRequest = isDataReq;
							const nodeRequestHeaders = filterInternalHeaders(rawHeaders);
							for (const header of INTERNAL_HEADERS) delete req.headers[header];
							for (const header of VINEXT_INTERNAL_HEADERS) delete req.headers[header];
							const method = req.method ?? "GET";
							const webRequest = new Request(new URL(routeUrl, requestOrigin), {
								method,
								headers: nodeRequestHeaders
							});
							const applyRequestHeadersToNodeRequest = (nextRequestHeaders) => {
								for (const key of Object.keys(req.headers)) delete req.headers[key];
								for (const [key, value] of nextRequestHeaders) req.headers[key] = value;
							};
							const devRunMiddlewareAdapter = capturedMiddlewarePath ? async (_request, _ctx, opts) => {
								const rawProto = process.env.VINEXT_TRUST_PROXY === "1" || (process.env.VINEXT_TRUSTED_HOSTS ?? "").split(",").some((h) => h.trim()) ? String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() : "";
								const mwOrigin = `${rawProto === "https" || rawProto === "http" ? rawProto : "http"}://${requestHost}`;
								const middlewareRequest = new Request(new URL(middlewareUrl, mwOrigin), {
									method: req.method,
									headers: nodeRequestHeaders
								});
								const result = await runMiddleware(getPagesRunner(), capturedMiddlewarePath, middlewareRequest, nextConfig?.i18n, nextConfig?.basePath, nextConfig?.trailingSlash, opts.isDataRequest, pathname);
								if (hasAppDir && result.continue) {
									const mwCtxEntries = [];
									if (result.responseHeaders) {
										for (const [key, value] of result.responseHeaders) if (key !== "x-middleware-next" && key !== "x-middleware-rewrite") mwCtxEntries.push([key, value]);
									}
									const mwStatus = result.status ?? result.rewriteStatus;
									req.headers[VINEXT_MW_CTX_HEADER] = JSON.stringify({
										h: mwCtxEntries,
										s: mwStatus ?? null,
										r: result.rewriteUrl ?? null
									});
								}
								return result;
							} : null;
							const devPageRoutes = await pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
							const devPageRouteDataKinds = /* @__PURE__ */ new Map();
							const classifyDevPageRoute = (route) => {
								const cached = devPageRouteDataKinds.get(route.filePath);
								if (cached) return cached;
								let dataKind = "none";
								try {
									const source = fs.readFileSync(route.filePath, "utf8");
									dataKind = hasExportedName(source, "getStaticProps") ? "static" : hasExportedName(source, "getServerSideProps") ? "server" : "none";
								} catch {}
								devPageRouteDataKinds.set(route.filePath, dataKind);
								return dataKind;
							};
							const pipelineResult = await runPagesRequest(webRequest, {
								basePath: bp,
								trailingSlash: nextConfig?.trailingSlash ?? false,
								i18nConfig: nextConfig?.i18n ?? null,
								configRedirects: nextConfig?.redirects ?? [],
								configRewrites: nextConfig?.rewrites ?? {
									beforeFiles: [],
									afterFiles: [],
									fallback: []
								},
								configHeaders: nextConfig?.headers ?? [],
								hadBasePath: true,
								isDataReq,
								isDataRequest,
								hasMiddleware: capturedMiddlewarePath !== null,
								rawSearch: url.includes("?") ? url.slice(url.indexOf("?")) : "",
								configMatchPathname,
								runMiddleware: devRunMiddlewareAdapter,
								matchPageRoute: (resolvedPathname, request) => {
									const m = matchRoute(nextConfig?.i18n ? resolvePagesI18nRequest(resolvedPathname, nextConfig.i18n, request.headers, getUrlHostname(request.url), bp, nextConfig.trailingSlash ?? false).url : resolvedPathname, devPageRoutes);
									return m ? { route: {
										dataKind: classifyDevPageRoute(m.route),
										isDynamic: m.route.isDynamic,
										pattern: m.route.pattern
									} } : null;
								},
								proxyExternal: async (currentRequest, externalUrl) => {
									const externalMethod = req.method ?? "GET";
									const hasBody = externalMethod !== "GET" && externalMethod !== "HEAD";
									const externalInit = {
										method: externalMethod,
										headers: currentRequest.headers
									};
									if (hasBody) {
										const { Readable } = await import("node:stream");
										externalInit.body = Readable.toWeb(req);
										externalInit.duplex = "half";
									}
									return proxyExternalRequest(new Request(new URL(url, requestOrigin), externalInit), externalUrl);
								},
								serveFilesystemRoute: async (requestPathname, stagedHeaders, phase) => {
									if (phase === "direct" || req.method !== "GET" && req.method !== "HEAD" || requestPathname === "/" || requestPathname === "/api" || requestPathname.startsWith("/api/")) return false;
									return serveRewrittenViteFilesystemRoute(req, res, requestPathname, stagedHeaders);
								}
							});
							if (pipelineResult.type === "response") {
								await writeWebResponseToNodeRes(res, pipelineResult.response);
								return;
							}
							if (pipelineResult.type === "next") return next();
							if (pipelineResult.type === "handled") return;
							const flushStagedHeaders = () => {
								for (const [key, value] of Object.entries(pipelineResult.stagedHeaders)) if (Array.isArray(value)) for (const v of value) res.appendHeader(key, v);
								else res.appendHeader(key, value);
							};
							const flushRequestHeaders = () => {
								applyRequestHeadersToNodeRequest(pipelineResult.requestHeaders);
							};
							if (pipelineResult.type === "api") {
								const apiRoutes = await apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
								const apiMatch = matchRoute(pipelineResult.apiUrl, apiRoutes);
								if (apiMatch && hasAppDir && appDir) {
									const appRoutes = await appRouter(appDir, nextConfig?.pageExtensions, fileMatcher);
									const appMatch = matchAppRoute(pipelineResult.apiUrl, appRoutes);
									if (appMatch && !pagesRouteHasPriorityOverAppRoute(apiMatch.route, appMatch.route)) return next();
								}
								if (apiMatch) {
									flushStagedHeaders();
									flushRequestHeaders();
									if (pipelineResult.middlewareStatus !== void 0) req.__vinextMiddlewareStatus = pipelineResult.middlewareStatus;
								}
								if (await handleApiRoute(getPagesRunner(), req, res, pipelineResult.apiUrl, apiRoutes, {
									basePath: nextConfig?.basePath,
									i18n: nextConfig?.i18n,
									trailingSlash: nextConfig?.trailingSlash
								})) return;
								if (hasAppDir) return next();
								res.statusCode = 404;
								res.end("404 - API route not found");
								return;
							}
							{
								const routes = await pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
								const resolvedPathname = pipelineResult.resolvedUrl.split("#", 1)[0].split("?", 1)[0];
								const renderMatch = matchRoute(resolvedPathname, routes);
								if (hasAppDir && appDir) {
									if (!renderMatch) return next();
									const appMatch = matchAppRoute(resolvedPathname, await appRouter(appDir, nextConfig?.pageExtensions, fileMatcher));
									if (appMatch && !pagesRouteHasPriorityOverAppRoute(renderMatch.route, appMatch.route)) return next();
								}
								if (!cachedSSRHandler || cachedSSRHandler.routes !== routes) cachedSSRHandler = {
									routes,
									handler: createSSRHandler(server, getPagesRunner(), routes, pagesDir, nextConfig?.i18n, fileMatcher, nextConfig?.basePath ?? "", nextConfig?.trailingSlash ?? false, middlewarePath !== null, (nextConfig?.rewrites.beforeFiles.length ?? 0) > 0 || (nextConfig?.rewrites.afterFiles.length ?? 0) > 0 || (nextConfig?.rewrites.fallback.length ?? 0) > 0, nextConfig?.clientTraceMetadata, nextConfig?.htmlLimitedBots, nextConfig?.reactStrictMode === true)
								};
								flushStagedHeaders();
								flushRequestHeaders();
								if (pipelineResult.middlewareStatus !== void 0) req.__vinextMiddlewareStatus = pipelineResult.middlewareStatus;
								req.url = pipelineResult.resolvedUrl;
								await cachedSSRHandler.handler(req, res, pipelineResult.resolvedUrl, req.__vinextMiddlewareStatus, pipelineResult.isDataReq, originalRequestUrl);
							}
						} catch (e) {
							next(e);
						}
					};
					server.middlewares.use((req, res, next) => {
						handlePagesMiddleware(req, res, next);
					});
				};
			}
		},
		{
			name: "vinext:validate-middleware-exports",
			enforce: "pre",
			transform(code, id) {
				if (!middlewarePath) return null;
				const modulePath = stripViteModuleQuery(id);
				if (canonicalize(modulePath) !== canonicalize(middlewarePath)) return null;
				validateMiddlewareModuleExports(code, modulePath, middlewarePath, isProxyFile(middlewarePath));
				return null;
			}
		},
		{
			name: "vinext:validate-page-exports",
			transform: {
				filter: {
					id: { exclude: VIRTUAL_MODULE_ID_RE },
					code: /\bexport\b[\s\S]*\*/
				},
				handler(code, id) {
					if (this.environment?.name !== "client") return null;
					if (!hasPagesDir || !hasExportAllCandidate(code)) return null;
					const modulePath = stripViteModuleQuery(id);
					if (!isWithinPagesDirectory(modulePath)) return null;
					const canonicalId = canonicalizePageTransformPath(modulePath);
					if (!isWithinPagesDirectory(canonicalId)) return null;
					if (!fileMatcher.isPageFile(canonicalId)) return null;
					if (isApiPage(canonicalId)) return null;
					validatePageExports(code);
					return null;
				}
			}
		},
		{
			name: "vinext:strip-server-exports",
			transform: {
				filter: {
					id: { exclude: VIRTUAL_MODULE_ID_RE },
					code: /getServerSideProps|getStaticProps|getStaticPaths|unstable_getServerProps|unstable_getServerSideProps|unstable_getStaticProps|unstable_getStaticPaths/
				},
				handler(code, id) {
					if (this.environment?.name !== "client") return null;
					if (!hasPagesDir) return null;
					const modulePath = stripViteModuleQuery(id);
					if (!isWithinPagesDirectory(modulePath)) return null;
					const canonicalId = canonicalizePageTransformPath(modulePath);
					if (!isWithinPagesDirectory(canonicalId)) return null;
					if (!fileMatcher.isPageFile(canonicalId)) return null;
					const relativePath = canonicalId.slice(canonicalPagesDir.length);
					if (isApiPage(canonicalId)) return null;
					if (/^\/(?:_app|_document|_error)(?:\.[^/]*)?$/.test(relativePath)) return null;
					return stripServerExports(code);
				}
			}
		},
		{
			name: "vinext:validate-server-only-client-imports",
			transform: {
				filter: {
					id: {
						include: /\.(tsx?|jsx?|mjs)$/,
						exclude: VIRTUAL_MODULE_ID_RE
					},
					code: "server-only"
				},
				handler(code) {
					if (this.environment?.name !== "client") return null;
					if (getLeadingReactDirective(code) === "use server") return null;
					if (!hasServerOnlyMarkerImport(code)) return null;
					throw new Error(`You're importing a module that depends on "server-only". This API is only available in Server Components in the App Router, but this module is reachable from a client bundle.`);
				}
			}
		},
		{
			name: "vinext:remove-console",
			apply: "build",
			transform: {
				filter: {
					id: {
						include: /\.(tsx?|jsx?|mjs)$/,
						exclude: /\/node_modules\//
					},
					code: /\bconsole\b/
				},
				handler(code) {
					if (this.environment?.name !== "client") return null;
					if (!nextConfig.removeConsole) return null;
					return removeConsoleCalls(code, nextConfig.removeConsole);
				}
			}
		},
		{
			name: "vinext:typeof-window",
			configEnvironment(_name, environment) {
				if (!useNativeTypeofWindowFolding) return null;
				return { define: { "typeof window": environment.consumer === "client" ? "\"object\"" : "\"undefined\"" } };
			}
		},
		{
			name: "vinext:typeof-window-scan",
			apply(_config, environment) {
				return !useNativeTypeofWindowFolding || environment.command === "build";
			},
			enforce: "post",
			transform: {
				filter: { code: /\btypeof\s+window\b/ },
				handler(code, id) {
					if (useNativeTypeofWindowFolding && this.environment.config.build.write !== false) return null;
					const cacheDir = `${toSlash(this.environment.config.cacheDir).replace(/\/$/, "")}/`;
					if (toSlash(id).startsWith(cacheDir)) return null;
					return replaceTypeofWindow(code, getTypeofWindowReplacement(this.environment), id);
				}
			}
		},
		{
			name: "vinext:compiler-define-server",
			configEnvironment(name) {
				if (name === "client") return null;
				const serverDefines = { ...nextConfig.compilerDefineServer };
				serverDefines["process.env.NEXT_RUNTIME"] = JSON.stringify("nodejs");
				const sharedRevalidateSecret = process.env.__VINEXT_SHARED_REVALIDATE_SECRET;
				if (sharedRevalidateSecret) serverDefines["process.env.__VINEXT_REVALIDATE_SECRET"] = JSON.stringify(sharedRevalidateSecret);
				if (previewBuildCredentials) {
					serverDefines["process.env.__VINEXT_PREVIEW_MODE_ID"] = JSON.stringify(previewBuildCredentials.id);
					serverDefines["process.env.__VINEXT_PREVIEW_MODE_SIGNING_KEY"] = JSON.stringify(previewBuildCredentials.signingKey);
					serverDefines["process.env.__VINEXT_PREVIEW_MODE_ENCRYPTION_KEY"] = JSON.stringify(previewBuildCredentials.encryptionKey);
				}
				return { define: serverDefines };
			}
		},
		{
			name: "vinext:client-global-define",
			configEnvironment(name) {
				if (name !== "client") return null;
				if (Object.hasOwn(nextConfig.compilerDefine, "global")) return null;
				const define = { global: "globalThis" };
				return {
					define,
					optimizeDeps: { rolldownOptions: { transform: { define } } }
				};
			}
		},
		{
			name: "vinext:image-imports",
			enforce: "pre",
			_dimCache: imageImportDimCache,
			buildStart() {
				imageImportDimCache.clear();
				staticImageAssets.clear();
			},
			watchChange(id) {
				const key = toSlash(id);
				imageImportDimCache.delete(key);
				staticImageAssets.delete(key);
				staticImageImportsByModule.delete(key);
			},
			resolveId: {
				filter: { id: /\?vinext-(?:image-url|meta)$/ },
				handler(source, _importer) {
					if (source.endsWith("?vinext-image-url")) return `\0vinext-image-url:${source.slice(0, -17)}`;
					if (source.endsWith("?vinext-meta")) return `\0vinext-image-meta:${source.slice(0, -12)}`;
					return null;
				}
			},
			async load(id) {
				if (id.startsWith("\0vinext-image-url:")) {
					const imagePath = id.replace("\0vinext-image-url:", "");
					this.addWatchFile(imagePath);
					if (this.environment.config.command === "serve") return `import url from ${JSON.stringify(imagePath + "?url")}; export default url;`;
					const asset = createStaticImageAsset(imagePath);
					staticImageAssets.set(imagePath, asset);
					const builtFileName = `${resolveAssetsDir(nextConfig.assetPrefix)}/${asset.fileName}`;
					return `export default ${JSON.stringify(renderVinextBuiltUrl(builtFileName, nextConfig.assetPrefix, nextConfig.deploymentId))};`;
				}
				if (!id.startsWith("\0vinext-image-meta:")) return null;
				const imagePath = id.replace("\0vinext-image-meta:", "");
				this.addWatchFile(imagePath);
				const cache = imageImportDimCache;
				let dims = cache.get(imagePath);
				if (!dims) try {
					const { imageSize } = await import("image-size");
					const result = imageSize(fs.readFileSync(imagePath));
					dims = {
						width: result.width ?? 0,
						height: result.height ?? 0
					};
					cache.set(imagePath, dims);
				} catch {
					dims = {
						width: 0,
						height: 0
					};
				}
				return `export default ${JSON.stringify(dims)};`;
			},
			transform: {
				filter: {
					id: {
						include: /\.(tsx?|jsx?|mjs)$/,
						exclude: [/node_modules/, VIRTUAL_MODULE_ID_RE]
					},
					code: new RegExp(`import\\s+\\w+\\s+from\\s+['"][^'"]+\\.(${IMAGE_EXTS})['"]`)
				},
				async handler(code, id) {
					const lang = id.endsWith(".ts") ? "ts" : "tsx";
					let ast;
					try {
						ast = parseAst(code, { lang });
					} catch {
						return null;
					}
					const s = new MagicString(code);
					let hasChanges = false;
					const imageImports = /* @__PURE__ */ new Set();
					for (const node of ast.body) {
						if (node.type !== "ImportDeclaration") continue;
						const importNode = node;
						const importPath = importNode.source?.value;
						if (typeof importPath !== "string") continue;
						if (!IMAGE_EXT_RE.test(importPath)) continue;
						const specifiers = importNode.specifiers ?? [];
						if (specifiers.length !== 1) continue;
						const specifier = specifiers[0];
						if (specifier.type !== "ImportDefaultSpecifier") continue;
						const varName = specifier.local?.name;
						if (!varName) continue;
						const dir = path.dirname(id);
						const resolvedImage = importPath.startsWith(".") ? path.resolve(dir, importPath) : (await this.resolve(importPath, id, { skipSelf: true }))?.id;
						if (!resolvedImage) continue;
						const absImagePath = toSlash(resolvedImage.split("?", 1)[0]);
						if (!fs.existsSync(absImagePath)) continue;
						imageImports.add(absImagePath);
						const urlVar = `__vinext_img_url_${varName}`;
						const metaVar = `__vinext_img_meta_${varName}`;
						const replacement = `import ${urlVar} from ${JSON.stringify(absImagePath + "?vinext-image-url")};\nimport ${metaVar} from ${JSON.stringify(absImagePath + "?vinext-meta")};\nvar ${varName} = { src: ${urlVar}, width: ${metaVar}.width, height: ${metaVar}.height };`;
						s.overwrite(importNode.start, importNode.end, replacement);
						hasChanges = true;
					}
					if (!hasChanges) {
						staticImageImportsByModule.delete(id);
						return null;
					}
					staticImageImportsByModule.set(id, imageImports);
					return {
						code: s.toString(),
						map: s.generateMap({ hires: "boundary" })
					};
				}
			},
			writeBundle: {
				sequential: true,
				order: "post",
				handler(outputOptions) {
					if (this.environment?.name !== "client") return;
					const clientOutDir = outputOptions.dir ? path.resolve(root, outputOptions.dir) : path.resolve(root, options.clientOutDir ?? "dist/client");
					const assetsDir = resolveAssetsDir(nextConfig.assetPrefix);
					const activeImagePaths = new Set(Array.from(staticImageImportsByModule.values()).flatMap((imports) => [...imports]));
					const nextWrittenFiles = /* @__PURE__ */ new Set();
					for (const imagePath of activeImagePaths) {
						if (!fs.existsSync(imagePath)) continue;
						const asset = staticImageAssets.get(imagePath) ?? createStaticImageAsset(imagePath);
						const outputPath = path.join(clientOutDir, assetsDir, asset.fileName);
						fs.mkdirSync(path.dirname(outputPath), { recursive: true });
						fs.writeFileSync(outputPath, asset.source);
						nextWrittenFiles.add(outputPath);
					}
					for (const outputPath of writtenStaticImageFiles) if (!nextWrittenFiles.has(outputPath)) fs.rmSync(outputPath, { force: true });
					writtenStaticImageFiles.clear();
					for (const outputPath of nextWrittenFiles) writtenStaticImageFiles.add(outputPath);
				}
			}
		},
		createGoogleFontsPlugin(_fontGoogleShimPath, _shimsDir),
		createLocalFontsPlugin(_shimsDir),
		createOptimizeImportsPlugin(() => nextConfig, () => root),
		createDynamicPreloadMetadataPlugin(),
		{
			name: "vinext:use-cache",
			transform: {
				filter: {
					id: {
						include: /\.(tsx?|jsx?|mjs)$/,
						exclude: [/node_modules/, VIRTUAL_MODULE_ID_RE]
					},
					code: "use cache"
				},
				async handler(code, id) {
					const ast = parseAst(code);
					const cacheDirective = ast.body.find((node) => node.type === "ExpressionStatement" && node.expression?.type === "Literal" && typeof node.expression.value === "string" && node.expression.value.startsWith("use cache"));
					function nodeHasInlineCacheDirective(node) {
						if (!node || typeof node !== "object") return false;
						const fn = node.type === "MethodDefinition" ? node.value : node;
						const stmts = fn?.body?.type === "BlockStatement" ? fn.body.body : null;
						if (Array.isArray(stmts)) {
							for (const stmt of stmts) if (stmt?.type === "ExpressionStatement" && stmt.expression?.type === "Literal" && typeof stmt.expression?.value === "string" && /^use cache(:\s*\w+)?$/.test(stmt.expression.value)) return true;
						}
						return false;
					}
					function astHasInlineCache(nodes) {
						for (const node of nodes) {
							if (!node || typeof node !== "object") continue;
							if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression" || node.type === "MethodDefinition") && nodeHasInlineCacheDirective(node)) return true;
							for (const key of Object.keys(node)) {
								if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
								const child = node[key];
								if (Array.isArray(child) && child.some((c) => c && typeof c === "object")) {
									if (astHasInlineCache(child)) return true;
								} else if (child && typeof child === "object" && child.type) {
									if (astHasInlineCache([child])) return true;
								}
							}
						}
						return false;
					}
					const hasInlineCache = !cacheDirective && astHasInlineCache(ast.body);
					if (!cacheDirective && !hasInlineCache) return null;
					if (!resolvedRscTransformsPath) throw new Error("vinext: 'use cache' requires @vitejs/plugin-rsc to be installed.\nRun: " + detectPackageManager(process.cwd()) + " @vitejs/plugin-rsc");
					const { transformWrapExport, transformHoistInlineDirective } = await import(pathToFileURL(resolvedRscTransformsPath).href);
					if (cacheDirective) {
						const directiveValue = cacheDirective.expression.value;
						const variant = directiveValue === "use cache" ? "" : directiveValue.replace("use cache:", "").trim();
						const isLayoutOrTemplate = /\/(layout|template)\.(tsx?|jsx?|mjs)$/.test(id);
						const modulePath = stripViteModuleQuery(id);
						const moduleFileName = path.basename(modulePath);
						const isAppPageModule = hasAppDir && isInsideDirectory(appDir, modulePath) && path.parse(moduleFileName).name === "page" && fileMatcher.extensionRegex.test(moduleFileName);
						const runtimeModuleUrl = pathToFileURL(resolveShimModulePath(shimsDir, "cache-runtime")).href;
						const result = transformWrapExport(code, ast, {
							runtime: (value, name) => {
								const pageOptions = name === "default" && isAppPageModule ? `, { appPageDefaultExport: true }` : "";
								return `(await import(${JSON.stringify(runtimeModuleUrl)})).registerCachedFunction(${value}, ${JSON.stringify(id + ":" + name)}, ${JSON.stringify(variant)}${pageOptions})`;
							},
							rejectNonAsyncFunction: false,
							filter: (name, meta) => {
								if (meta.isFunction === false) return false;
								if (isLayoutOrTemplate && name === "default") return false;
								return true;
							}
						});
						if (result.exportNames.length > 0) {
							const output = result.output;
							output.overwrite(cacheDirective.start, cacheDirective.end, `/* "use cache" — wrapped by vinext */`);
							return {
								code: output.toString(),
								map: output.generateMap({ hires: "boundary" })
							};
						}
						const output = new MagicString(code);
						output.overwrite(cacheDirective.start, cacheDirective.end, `/* "use cache" — handled by vinext */`);
						return {
							code: output.toString(),
							map: output.generateMap({ hires: "boundary" })
						};
					}
					if (hasInlineCache) {
						const runtimeModuleUrl2 = pathToFileURL(resolveShimModulePath(shimsDir, "cache-runtime")).href;
						try {
							const result = transformHoistInlineDirective(code, ast, {
								directive: /^use cache(:\s*\w+)?$/,
								runtime: (value, name, meta) => {
									const directiveMatch = meta.directiveMatch[0];
									const variant = directiveMatch === "use cache" ? "" : directiveMatch.replace("use cache:", "").trim();
									return `(await import(${JSON.stringify(runtimeModuleUrl2)})).registerCachedFunction(${value}, ${JSON.stringify(id + ":" + name)}, ${JSON.stringify(variant)})`;
								},
								rejectNonAsyncFunction: false
							});
							if (result.names.length > 0) return {
								code: result.output.toString(),
								map: result.output.generateMap({ hires: "boundary" })
							};
						} catch {}
					}
					return null;
				}
			}
		},
		createImportMetaUrlPlugin({ getRoot: () => root }),
		createExtensionlessDynamicImportPlugin(),
		createRequireContextPlugin(),
		createOgInlineFetchAssetsPlugin(),
		createOgAssetsPlugin(),
		createServerExternalsManifestPlugin(),
		(() => {
			let buildIdWritten = false;
			return {
				name: "vinext:build-id",
				apply: "build",
				enforce: "post",
				writeBundle: {
					sequential: true,
					order: "post",
					handler() {
						if (buildIdWritten) return;
						buildIdWritten = true;
						const outDir = path.join(root, "dist", "server");
						fs.mkdirSync(outDir, { recursive: true });
						fs.writeFileSync(path.join(outDir, "BUILD_ID"), nextConfig.buildId);
					}
				}
			};
		})(),
		{
			name: "vinext:hash-salt",
			apply: "build",
			augmentChunkHash() {
				if (this.environment?.name !== "client") return;
				const salt = nextConfig?.hashSalt;
				if (salt) return salt;
			}
		},
		(() => {
			const prerenderSecret = randomBytes(32).toString("hex");
			return {
				name: "vinext:server-manifest",
				apply: "build",
				enforce: "post",
				writeBundle: {
					sequential: true,
					order: "post",
					handler(options) {
						const envName = this.environment?.name;
						if (envName !== "rsc" && envName !== "ssr") return;
						const outDir = options.dir;
						if (!outDir) return;
						const manifest = { prerenderSecret };
						fs.writeFileSync(path.join(outDir, "vinext-server.json"), JSON.stringify(manifest));
					}
				}
			};
		})(),
		{
			name: "vinext:nitro-route-rules",
			nitro: { setup: async (nitro) => {
				if (!nextConfig) return;
				if (!hasAppDir && !hasPagesDir) return;
				if (nitroTraceDepsFromServerExternals.length > 0) nitro.options.traceDeps = [.../* @__PURE__ */ new Set([...nitro.options.traceDeps ?? [], ...nitroTraceDepsFromServerExternals])];
				if (nitro.options.dev) return;
				const { collectNitroRouteRules, mergeNitroRouteRules } = await import("./build/nitro-route-rules.js");
				const generatedRouteRules = await collectNitroRouteRules({
					appDir: hasAppDir ? appDir : null,
					pagesDir: hasPagesDir ? pagesDir : null,
					pageExtensions: nextConfig.pageExtensions
				});
				if (Object.keys(generatedRouteRules).length === 0) return;
				const { routeRules, skippedRoutes } = mergeNitroRouteRules(nitro.options.routeRules, generatedRouteRules);
				nitro.options.routeRules = routeRules;
				if (skippedRoutes.length > 0) (nitro.logger?.warn ?? console.warn)(`[vinext] Skipping generated Nitro routeRules for routes with existing exact cache config: ${skippedRoutes.join(", ")}`);
			} }
		},
		{
			name: "vinext:ssr-manifest-backfill",
			apply: "build",
			enforce: "post",
			writeBundle: {
				sequential: true,
				order: "post",
				handler(options, bundle) {
					const outDir = options.dir;
					if (!outDir) return;
					const viteDir = path.join(outDir, ".vite");
					const ssrManifestPath = path.join(viteDir, "ssr-manifest.json");
					if (!fs.existsSync(ssrManifestPath)) return;
					try {
						const augmentedManifest = augmentSsrManifestFromBundle(JSON.parse(fs.readFileSync(ssrManifestPath, "utf-8")), bundle, this.environment?.config.root ?? process.cwd(), this.environment?.config.base ?? "/");
						fs.writeFileSync(ssrManifestPath, JSON.stringify(augmentedManifest, null, 2));
					} catch (err) {
						console.warn("[vinext] Failed to augment SSR manifest:", err);
					}
				}
			}
		},
		{
			name: "vinext:next-client-runtime-manifests",
			apply: "build",
			enforce: "post",
			writeBundle: {
				sequential: true,
				order: "post",
				handler(outputOptions) {
					const clientDir = outputOptions.dir;
					if (!clientDir) return;
					if (!(this.environment?.name === "client")) return;
					emitNextClientRuntimeManifests({
						clientDir,
						assetsSubdir: resolveAssetsDir(nextConfig.assetPrefix),
						buildId: nextConfig.buildId,
						rewrites: nextConfig.rewrites
					});
				}
			}
		},
		(() => {
			let pendingPrecompress = null;
			let pendingPrecompressError = null;
			return {
				name: "vinext:precompress",
				apply: "build",
				enforce: "post",
				writeBundle: {
					sequential: true,
					order: "post",
					handler(outputOptions) {
						if (this.environment?.name !== "client") return;
						if (!options.precompress && process.env.VINEXT_PRECOMPRESS !== "1") return;
						const outDir = outputOptions.dir;
						if (!outDir) return;
						const assetsSubdir = resolveAssetsDir(nextConfig.assetPrefix);
						const assetsDir = path.join(outDir, assetsSubdir);
						if (!fs.existsSync(assetsDir)) return;
						const isTTY = process.stderr.isTTY;
						let lastLineLen = 0;
						pendingPrecompressError = null;
						pendingPrecompress = (async () => {
							const result = await precompressAssets(outDir, {
								assetsDir: assetsSubdir,
								onProgress: (completed, total, file) => {
									if (!isTTY) return;
									const pct = total > 0 ? Math.floor(completed / total * 100) : 0;
									const bar = `[${"█".repeat(Math.floor(pct / 5))}${" ".repeat(20 - Math.floor(pct / 5))}]`;
									const fileLabel = file.length > 30 ? "…" + file.slice(-29) : file;
									const line = `Compressing assets... ${bar} ${String(completed).padStart(String(total).length)}/${total} ${fileLabel}`;
									const padded = line.padEnd(lastLineLen);
									lastLineLen = line.length;
									process.stderr.write(`\r${padded}`);
								}
							});
							if (isTTY) process.stderr.write(`\r${" ".repeat(lastLineLen)}\r`);
							if (result.filesCompressed > 0) {
								const ratio = ((1 - result.totalBrotliBytes / result.totalOriginalBytes) * 100).toFixed(1);
								console.log(`  Precompressed ${result.filesCompressed} assets (${ratio}% smaller with brotli)`);
							}
						})().catch((error) => {
							pendingPrecompressError = error;
							console.error("[vinext] Precompression failed:", error);
						});
					}
				},
				closeBundle: {
					sequential: true,
					order: "post",
					async handler() {
						if (this.environment?.name !== "ssr") return;
						if (!pendingPrecompress) return;
						const task = pendingPrecompress;
						pendingPrecompress = null;
						await task;
						if (pendingPrecompressError) {
							const error = pendingPrecompressError;
							pendingPrecompressError = null;
							throw error;
						}
					}
				}
			};
		})(),
		{
			name: "vinext:pages-client-assets",
			apply: "build",
			enforce: "post",
			sharedDuringBuild: true,
			closeBundle: {
				sequential: true,
				order: "post",
				handler() {
					const envConfig = this.environment.config;
					if (this.environment.name === "client") {
						const buildRoot = envConfig.root ?? process.cwd();
						const clientDir = path.resolve(buildRoot, envConfig.build.outDir);
						const runtimeMetadata = computeClientRuntimeMetadata({
							clientDir,
							assetBase: envConfig.base ?? "/",
							assetPrefix: nextConfig.assetPrefix,
							includeClientEntry: !hasAppDir ? true : hasPagesDir ? "pages-client-entry" : false
						});
						let ssrManifest;
						const ssrManifestPath = path.join(clientDir, ".vite", "ssr-manifest.json");
						if (fs.existsSync(ssrManifestPath)) try {
							ssrManifest = JSON.parse(fs.readFileSync(ssrManifestPath, "utf-8"));
						} catch {}
						pagesClientAssetsModule = buildPagesClientAssetsModule({
							clientEntry: runtimeMetadata.clientEntryFile ?? void 0,
							appBootstrapPreinitModules: runtimeMetadata.appBootstrapPreinitModules,
							ssrManifest,
							lazyChunks: runtimeMetadata.lazyChunks ?? void 0,
							dynamicPreloads: runtimeMetadata.dynamicPreloads ?? void 0
						});
						const buildSession = process.env.__VINEXT_PAGES_CLIENT_ASSETS_BUILD_SESSION;
						if (hasAppDir && hasPagesDir && buildSession) setPagesClientAssetsBuildMetadata(buildSession, pagesClientAssetsModule);
					}
					if (pagesClientAssetsModule === null) {
						if (pagesClientAssetsOutputDirs.size === 0) return;
						const buildSession = process.env.__VINEXT_PAGES_CLIENT_ASSETS_BUILD_SESSION;
						if (buildSession) pagesClientAssetsModule = takePagesClientAssetsBuildMetadata(buildSession);
					}
					if (pagesClientAssetsModule === null) {
						const emptyModule = buildPagesClientAssetsModule({});
						for (const outputDir of pagesClientAssetsOutputDirs) writePagesClientAssetsModuleIfMissing(outputDir, emptyModule);
						return;
					}
					for (const outputDir of pagesClientAssetsOutputDirs) {
						fs.mkdirSync(outputDir, { recursive: true });
						fs.writeFileSync(path.join(outputDir, PAGES_CLIENT_ASSETS_MODULE), pagesClientAssetsModule);
					}
				}
			},
			buildApp() {
				if (pagesClientAssetsModule === null) return Promise.resolve();
				for (const outputDir of pagesClientAssetsOutputDirs) {
					fs.mkdirSync(outputDir, { recursive: true });
					fs.writeFileSync(path.join(outputDir, PAGES_CLIENT_ASSETS_MODULE), pagesClientAssetsModule);
				}
				return Promise.resolve();
			}
		},
		{
			name: "vinext:inline-css-manifest",
			apply: "build",
			enforce: "post",
			closeBundle: {
				sequential: true,
				order: "post",
				handler() {
					if (this.environment?.name !== "client") return;
					if (!hasAppDir || nextConfig?.inlineCss !== true) return;
					const envConfig = this.environment?.config;
					if (!envConfig) return;
					const buildRoot = envConfig.root ?? process.cwd();
					const manifest = collectInlineCssManifest(path.resolve(buildRoot, "dist", "client"), nextConfig.assetPrefix);
					const rscOutDir = path.resolve(buildRoot, options.rscOutDir ?? path.join("dist", "server"));
					for (const entryFile of ["index.js", "index.mjs"]) if (injectInlineCssManifestGlobal(path.join(rscOutDir, entryFile), manifest)) break;
				}
			}
		},
		{
			name: "vinext:cloudflare-build",
			apply: "build",
			enforce: "post",
			closeBundle: {
				sequential: true,
				order: "post",
				async handler() {
					const envName = this.environment?.name;
					if (!envName || !hasCloudflarePlugin) return;
					if (envName !== "client") return;
					const envConfig = this.environment?.config;
					if (!envConfig) return;
					const buildRoot = envConfig.root ?? process.cwd();
					const clientDir = path.resolve(buildRoot, envConfig.build.outDir);
					const headersPath = path.join(clientDir, "_headers");
					if (!fs.existsSync(headersPath)) {
						const headersContent = [
							"# Cache content-hashed assets immutably (generated by vinext)",
							`/${envConfig.build?.assetsDir ?? "_next/static"}/*`,
							"  Cache-Control: public, max-age=31536000, immutable",
							""
						].join("\n");
						fs.mkdirSync(clientDir, { recursive: true });
						fs.writeFileSync(headersPath, headersContent);
					}
					ensureAssetsIgnore(clientDir);
				}
			}
		},
		createWasmModuleImportPlugin(),
		{
			name: "vinext:og-font-patch",
			enforce: "pre",
			transform: {
				filter: { id: /@vercel\/og.*index\.edge\.js/ },
				handler(code, id) {
					let result = code;
					const yogaMatch = /H = "data:application\/octet-stream;base64,([A-Za-z0-9+/]+=*)";/.exec(result);
					if (yogaMatch) {
						const yogaBase64 = yogaMatch[1];
						const distDir = path.dirname(id);
						const yogaWasmPath = path.join(distDir, "yoga.wasm");
						if (!fs.existsSync(yogaWasmPath)) fs.writeFileSync(yogaWasmPath, Buffer.from(yogaBase64, "base64"));
						result = result.replace(yogaMatch[0], `H = "";`);
						const YOGA_CALL = `yoga_wasm_base64_esm_default()`;
						const YOGA_CALL_PATCHED = [
							`yoga_wasm_base64_esm_default({ instantiateWasm: function(imports, callback) {`,
							`  __vi_yoga_mod.then(function(mod) {`,
							`    if (mod) {`,
							`      WebAssembly.instantiate(mod, imports).then(function(inst) { callback(inst); });`,
							`    } else {`,
							`      Promise.all([import("node:fs"), import("node:url")]).then(function(mods) {`,
							`        var p = mods[1].fileURLToPath(new URL("./yoga.wasm", import.meta.url));`,
							`        return mods[0].promises.readFile(p).then(function(bytes) {`,
							`          return WebAssembly.instantiate(bytes, imports).then(function(r) { callback(r.instance); });`,
							`        });`,
							`      });`,
							`    }`,
							`  });`,
							`  return {};`,
							`} })`
						].join("\n");
						result = result.replace(YOGA_CALL, YOGA_CALL_PATCHED);
						result = [`var __vi_yoga_mod = import("./yoga.wasm?module").then(function(m) { return m.default; }).catch(function() { return null; });`].join("\n") + "\n" + result;
					}
					const resvgMatch = /import\s+resvg_wasm\s+from\s+["']\.\/resvg\.wasm\?module["']\s*;?/.exec(result);
					if (resvgMatch) {
						const resvgLoader = [
							`var resvg_wasm = import("./resvg.wasm?module").then(function(m) { return m.default; }).catch(function() {`,
							`  return Promise.all([import("node:fs"), import("node:url")]).then(function(mods) {`,
							`    var p = mods[1].fileURLToPath(new URL("./resvg.wasm", import.meta.url));`,
							`    return mods[0].promises.readFile(p).then(function(buf) { return WebAssembly.compile(buf); });`,
							`  });`,
							`});`
						].join("\n");
						result = result.replace(resvgMatch[0], resvgLoader);
					}
					if (result === code) return null;
					return {
						code: result,
						map: null
					};
				}
			}
		}
	];
	if (rscPluginPromise) {
		plugins.push(rscPluginPromise);
		plugins.push(createRscReferenceValidationNormalizerPlugin());
		plugins.push(createRscClientReferenceLoadersPlugin());
	}
	return plugins;
}
/**
* Collect all NEXT_PUBLIC_* env vars and create Vite define entries
* so they get inlined into the client bundle.
*/
function getNextPublicEnvDefines() {
	const defines = {};
	for (const [key, value] of Object.entries(process.env)) if (key.startsWith("NEXT_PUBLIC_") && value !== void 0) defines[`process.env.${key}`] = JSON.stringify(value);
	return defines;
}
/**
* Write a Web API Response to a Node.js ServerResponse.
* Handles multi-value headers (Set-Cookie) correctly.
*/
async function writeWebResponseToNodeRes(res, response) {
	const nodeHeaders = {};
	response.headers.forEach((value, key) => {
		if (key === "set-cookie") return;
		const existing = nodeHeaders[key];
		if (existing !== void 0) nodeHeaders[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
		else nodeHeaders[key] = value;
	});
	const cookies = response.headers.getSetCookie?.() ?? [];
	if (cookies.length > 0) nodeHeaders["set-cookie"] = cookies;
	if (response.statusText) res.writeHead(response.status, response.statusText, nodeHeaders);
	else res.writeHead(response.status, nodeHeaders);
	if (response.body) {
		const { Readable } = await import("node:stream");
		const nodeStream = Readable.fromWeb(response.body);
		await new Promise((resolve, reject) => {
			nodeStream.on("error", reject);
			res.on("error", reject);
			nodeStream.pipe(res);
			nodeStream.on("end", resolve);
		});
	} else res.end();
}
//#endregion
export { vinext as default, staticExportApp, staticExportPages };
