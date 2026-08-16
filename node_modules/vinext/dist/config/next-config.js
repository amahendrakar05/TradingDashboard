import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { normalizePageExtensions } from "../routing/file-matcher.js";
import { isExternalUrl } from "../utils/external-url.js";
import { applyLocaleToRoutes } from "./config-matchers.js";
import { isUnknownRecord } from "../utils/record.js";
import { getHtmlLimitedBotRegex } from "../utils/html-limited-bots.js";
import { flattenPluginOptions } from "../utils/plugin-options.js";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "../shims/constants.js";
import { loadTsconfigResolutionForRoot } from "./tsconfig-paths.js";
import { loadCommonJsModule, shouldRetryAsCommonJs } from "../utils/commonjs-loader.js";
import { createRequire } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import commonjs from "vite-plugin-commonjs";
//#region src/config/next-config.ts
/**
* next.config.js / next.config.mjs / next.config.ts parser
*
* Loads the Next.js config file (if present) and extracts supported options.
* Unsupported options are logged as warnings.
*/
const VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY = "__vinextNextConfig";
/**
* Parse a body size limit value (string or number) into bytes.
* Accepts Next.js-style strings like "1mb", "500kb", "10mb", bare number strings like "1048576" (bytes),
* and numeric values. Supports b, kb, mb, gb, tb, pb units.
* Returns the default 1MB if the value is not provided or invalid.
* Throws if the parsed value is less than 1.
*/
function parseBodySizeLimit(value) {
	if (value === void 0 || value === null) return 1 * 1024 * 1024;
	if (typeof value === "number") {
		if (value < 1) throw new Error(`Body size limit must be a positive number, got ${value}`);
		return value;
	}
	const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|pb)?$/i);
	if (!match) {
		console.warn(`[vinext] Invalid bodySizeLimit value: "${value}". Expected a number or a string like "1mb", "500kb". Falling back to 1MB.`);
		return 1 * 1024 * 1024;
	}
	const num = parseFloat(match[1]);
	const unit = (match[2] ?? "b").toLowerCase();
	let bytes;
	switch (unit) {
		case "b":
			bytes = Math.floor(num);
			break;
		case "kb":
			bytes = Math.floor(num * 1024);
			break;
		case "mb":
			bytes = Math.floor(num * 1024 * 1024);
			break;
		case "gb":
			bytes = Math.floor(num * 1024 * 1024 * 1024);
			break;
		case "tb":
			bytes = Math.floor(num * 1024 * 1024 * 1024 * 1024);
			break;
		case "pb":
			bytes = Math.floor(num * 1024 * 1024 * 1024 * 1024 * 1024);
			break;
		default: return 1 * 1024 * 1024;
	}
	if (bytes < 1) throw new Error(`Body size limit must be a positive number, got ${bytes}`);
	return bytes;
}
async function findVinextNextConfigInPlugins(plugins) {
	const flattened = await flattenPluginOptions(plugins);
	for (const plugin of flattened) {
		if (!isUnknownRecord(plugin)) continue;
		const nextConfig = plugin[VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY];
		if (nextConfig) return nextConfig;
	}
	return null;
}
const CONFIG_FILES = [
	"next.config.ts",
	"next.config.mts",
	"next.config.mjs",
	"next.config.js",
	"next.config.cjs"
];
const DEFAULT_EXPIRE_TIME = 31536e3;
const DEFAULT_TRANSPILED_PACKAGES = ["geist"];
/**
* Default cap for the App Router preload `Link` header length, matching the
* Next.js `defaultConfig.reactMaxHeadersLength`.
* @see https://nextjs.org/docs/app/api-reference/config/next-config-js/reactMaxHeadersLength
*/
const DEFAULT_REACT_MAX_HEADERS_LENGTH = 6e3;
/**
* Check whether an error indicates a CJS module was loaded in an ESM context
* (i.e. the file uses `require()` which is not available in ESM).
*/
function isCjsError(e) {
	if (!(e instanceof Error)) return false;
	const msg = e.message;
	return msg.includes("require is not a function") || msg.includes("require is not defined") || msg.includes("exports is not defined") || msg.includes("module is not defined") || msg.includes("__dirname is not defined") || msg.includes("__filename is not defined");
}
const DEFAULT_PHASE = PHASE_DEVELOPMENT_SERVER;
/**
* Emit a warning when config loading fails, with a targeted hint for
* known plugin wrappers that are unnecessary in vinext.
*/
function warnConfigLoadFailure(filename, err) {
	const msg = err.message ?? "";
	const stack = err.stack ?? "";
	const isNextIntlPlugin = msg.includes("next-intl") || stack.includes("next-intl/plugin") || stack.includes("next-intl/dist");
	console.log();
	console.error(`[vinext] Failed to load ${filename}: ${msg}`);
	console.log();
	if (isNextIntlPlugin) console.warn("[vinext] Hint: createNextIntlPlugin() is not needed with vinext. Remove the next-intl/plugin wrapper from your next.config — vinext auto-detects next-intl and registers the i18n config alias automatically.");
}
/**
* Resolve a Next-style config value, calling it if it's a function-form config
* (Next.js supports `module.exports = (phase, opts) => config`).
*/
async function resolveConfigValue(config, phase = DEFAULT_PHASE) {
	if (typeof config === "function") return await config(phase, { defaultConfig: {} });
	return config;
}
/**
* Named export attached by `cjsGlobalsInjectorPlugin` when the source
* statically looks like it assigns to `module.exports`. Holds the wrapper
* `module` object so {@link unwrapConfig} can read back the user's CJS-style
* export. Pure-ESM configs skip the wrapper entirely and rely on the ESM
* `default` export instead.
*/
const VINEXT_CJS_EXPORTS_KEY = "__vinext_cjs_exports";
/**
* Companion named export pointing at the initial empty `{}` that the wrapper
* is constructed with. Lets {@link unwrapConfig} distinguish "user reassigned
* or mutated module.exports" from "module.exports is still the untouched
* empty wrapper" — the latter happens when {@link reassignsModuleExports}
* matches inside a string or comment (a harmless false positive that should
* still fall through to the ESM `default` export).
*/
const VINEXT_CJS_INITIAL_KEY = "__vinext_cjs_initial_exports";
/**
* Unwrap the config value from a loaded module namespace.
*
* Prefers `module.exports` (CJS style) when the config file reassigned it,
* otherwise falls back to `default`/the namespace itself. Mirrors Next.js's
* behaviour, where the config is loaded through `Module._compile` and CJS
* assignments override any ESM-style exports.
*
* The presence of the `__vinext_cjs_exports` named export is the static
* signal (set by `cjsGlobalsInjectorPlugin` when `reassignsModuleExports`
* matched) that this file might use CJS-style exports. We then disambiguate
* "user actually touched module.exports" from "static heuristic was a false
* positive" by comparing identity against the initial empty wrapper: if
* `module.exports` is still the original `{}`, fall back to ESM `default`.
*/
async function unwrapConfig(mod, phase = PHASE_DEVELOPMENT_SERVER) {
	const cjsExports = (mod?.[VINEXT_CJS_EXPORTS_KEY])?.exports;
	const cjsInitial = mod?.[VINEXT_CJS_INITIAL_KEY];
	if (cjsExports !== void 0 && cjsExports !== null && (cjsExports !== cjsInitial || typeof cjsExports === "object" && Object.keys(cjsExports).length > 0)) return await resolveConfigValue(cjsExports, phase);
	return await resolveConfigValue(mod.default ?? mod, phase);
}
/**
* Resolve a path through filesystem symlinks, falling back to the original
* path when the file does not exist (e.g. virtual ids, query-suffixed ids).
* Output is forward-slashed so it compares consistently with pathslash
* results (fs.realpathSync returns backslashes on Windows).
*/
function safeRealpath(p) {
	try {
		return toSlash(fs.realpathSync(p));
	} catch {
		return p;
	}
}
/**
* Whole-word substring check for any of the CJS-style globals that the
* injector plugin would shim. Used to skip the transform entirely for the
* common case where the config is pure ESM (no `__filename`, `__dirname`,
* `require`, `module`, or `exports` references).
*
* False positives are harmless: a comment, string literal, or unrelated
* identifier like `node:module` will trigger the transform unnecessarily,
* but the resulting injection is idempotent and the loaded config is
* unaffected. False negatives would be a correctness bug, so we err on the
* side of matching too eagerly.
*
* Note: `\bexports\b` does not match `export default` (different word
* boundaries), and `\brequire\b` does not match `requireSomething`.
*/
function referencesCjsGlobals(source) {
	return /\b(?:__filename|__dirname|require|module|exports)\b/.test(source);
}
/**
* Static heuristic: returns true when the source appears to assign to
* `module.exports` — either via `module.exports = …`, `module.exports.foo = …`,
* or `module.exports[…] = …`. Used to decide whether the injector plugin
* needs to wire up the wrapper `module` object so {@link unwrapConfig} can
* read back the user's CJS-style export.
*
* Pure-ESM configs skip the wrapper entirely, which means a faster transform
* (no extra `export const` line) and a simpler unwrap path (no need to
* disambiguate "initial empty object" from "user reassigned to {}").
*
* Like {@link referencesCjsGlobals}, false positives are harmless: at worst
* we emit an unused `__vinext_cjs_exports` named export, and `unwrapConfig`
* still prefers it (it points at an empty object, which then gets treated
* as the config — equivalent to today's sentinel logic for pure-ESM files
* that happen to mention `module.exports` only in a string).
*/
function reassignsModuleExports(source) {
	return /\bmodule\s*\.\s*exports\b\s*(?:=(?!=)|\.\s*[A-Za-z_$][\w$]*\s*=(?!=)|\[)/.test(source);
}
/**
* Vite plugin that prepends CJS-style globals (`__filename`, `__dirname`,
* `module`, `exports`, `require`) to the next.config.* source before
* Vite's module runner evaluates it.
*
* Next.js's `next.config.ts` loader (packages/next/src/build/next-config-ts/
* transpile-config.ts → require-hook.ts) feeds the file through Node's
* `Module._compile`, which provides these CJS globals even when the source
* uses ESM syntax. Upstream test fixtures in `test/e2e/app-dir/next-config-ts*`
* rely on that, e.g. `node-api-cjs/next.config.ts` reads
* `fs.readFileSync(path.join(__dirname, 'foo.txt'), 'utf8')`. vinext loads
* configs through Vite's ESM-only module runner, so we inject the same
* globals as plain `const` declarations.
*
* For configs that don't reference any CJS global (the common case — every
* upstream `next-config-ts` fixture except `node-api-cjs` is pure ESM) we
* skip the transform entirely; see {@link referencesCjsGlobals}.
*
* `module.exports` reassignment is preserved by exposing the injected
* `module` object as a named export (see {@link VINEXT_CJS_EXPORTS_KEY}) and
* reading it back in {@link unwrapConfig}.
*/
function cjsGlobalsInjectorPlugin(configPath) {
	const normalizedTarget = safeRealpath(path.resolve(configPath));
	return {
		name: "vinext:next-config-cjs-globals",
		enforce: "pre",
		transform(code, id) {
			const idPath = id.startsWith("file://") ? fileURLToPath(id) : id.split("?")[0];
			if (safeRealpath(path.resolve(idPath)) !== normalizedTarget) return null;
			if (!referencesCjsGlobals(code)) return null;
			const dirname = path.dirname(normalizedTarget);
			const filenameLiteral = JSON.stringify(normalizedTarget);
			const dirnameLiteral = JSON.stringify(dirname);
			const requireBaseLiteral = JSON.stringify(path.join(dirname, "package.json"));
			const hasOwnDirname = /\b(?:const|let|var)\s+__dirname\b/.test(code);
			const hasOwnFilename = /\b(?:const|let|var)\s+__filename\b/.test(code);
			const hasOwnRequire = /\b(?:const|let|var)\s+require\b/.test(code);
			const moduleLines = reassignsModuleExports(code) ? `const __vinextInitialExports = {};
const module = { exports: __vinextInitialExports };
const exports = module.exports;
export const ${VINEXT_CJS_EXPORTS_KEY} = module;\nexport const ${VINEXT_CJS_INITIAL_KEY} = __vinextInitialExports;\n` : "";
			return {
				code: (hasOwnRequire ? "" : `import { createRequire as __vinextCreateRequire } from "node:module";\n`) + (hasOwnFilename ? "" : `const __filename = ${filenameLiteral};\n`) + (hasOwnDirname ? "" : `const __dirname = ${dirnameLiteral};\n`) + (hasOwnRequire ? "" : `const require = __vinextCreateRequire(${requireBaseLiteral});\n`) + moduleLines + code,
				map: null
			};
		}
	};
}
function findNextConfigPath(root) {
	for (const filename of CONFIG_FILES) {
		const configPath = path.join(root, filename);
		if (fs.existsSync(configPath)) return configPath;
	}
	return null;
}
function hasConfigProperty(config, propertyPath) {
	let current = config;
	for (const property of propertyPath.split(".")) {
		if (!isUnknownRecord(current) || current[property] === void 0) return false;
		current = current[property];
	}
	return true;
}
const emittedConfigWarnings = /* @__PURE__ */ new Set();
function warnConfigOnce(message) {
	if (emittedConfigWarnings.has(message)) return;
	emittedConfigWarnings.add(message);
	console.warn(message);
}
function warnDeprecatedConfigOptions(config, root) {
	const configFileName = path.basename(findNextConfigPath(root) ?? "next.config.js");
	const warnings = [
		["experimental.middlewarePrefetch", `\`experimental.middlewarePrefetch\` is deprecated. Please use \`experimental.proxyPrefetch\` instead in ${configFileName}.`],
		["experimental.middlewareClientMaxBodySize", `\`experimental.middlewareClientMaxBodySize\` is deprecated. Please use \`experimental.proxyClientMaxBodySize\` instead in ${configFileName}.`],
		["experimental.externalMiddlewareRewritesResolve", `\`experimental.externalMiddlewareRewritesResolve\` is deprecated. Please use \`experimental.externalProxyRewritesResolve\` instead in ${configFileName}.`],
		["skipMiddlewareUrlNormalize", `\`skipMiddlewareUrlNormalize\` is deprecated. Please use \`skipProxyUrlNormalize\` instead in ${configFileName}.`],
		["experimental.instrumentationHook", `\`experimental.instrumentationHook\` is no longer needed, because \`instrumentation.js\` is available by default. You can remove it from ${configFileName}.`]
	];
	for (const [propertyPath, warning] of warnings) if (hasConfigProperty(config, propertyPath)) warnConfigOnce(warning);
}
async function resolveNextConfigInput(config, phase = PHASE_DEVELOPMENT_SERVER) {
	return await resolveConfigValue(config, phase);
}
/**
* Load a CJS-flavoured next.config.{js,cjs} via createRequire.
*
* For `.cjs` (or `.js` in a non-type-module package) Node's loader picks the
* right format automatically and `require()` just works. For `.js` in a
* `"type": "module"` package, retry through the shared in-memory CommonJS
* loader so nested local `.js` dependencies retain CommonJS semantics too.
*/
async function loadConfigViaRequire(configPath, root, phase) {
	const require = createRequire(path.join(root, "package.json"));
	try {
		return await unwrapConfig(require(configPath), phase);
	} catch (e) {
		if (!shouldRetryAsCommonJs(e, configPath)) throw e;
		return await unwrapConfig(loadCommonJsModule(configPath), phase);
	}
}
/**
* Find and load the next.config file from the project root.
* Returns null if no config file is found.
*
* Attempts Vite's module runner first so TS configs and extensionless local
* imports (e.g. `import "./env"`) resolve consistently. If loading fails due
* to CJS constructs (`require`, `module.exports`), falls back to `createRequire`
* so common CJS plugin wrappers (nextra, @next/mdx, etc.) still work, including
* `next.config.js` files written in CJS syntax inside a `"type": "module"`
* package (the common shape after `vinext init`).
*/
async function loadNextConfig(root, phase = DEFAULT_PHASE) {
	const configPath = findNextConfigPath(root);
	if (!configPath) return null;
	const filename = path.basename(configPath);
	const isTypeScriptConfig = /\.[cm]?ts$/.test(configPath);
	const tsconfigResolution = loadTsconfigResolutionForRoot(root);
	const useNativeTsconfigPaths = !!(isTypeScriptConfig ? tsconfigResolution.baseUrl : null);
	const normalizedConfigPath = safeRealpath(path.resolve(configPath));
	try {
		const { runnerImport } = await import("vite");
		const { module: mod } = await runnerImport(configPath, {
			root,
			logLevel: "error",
			clearScreen: false,
			resolve: {
				alias: tsconfigResolution.aliases,
				...useNativeTsconfigPaths ? { tsconfigPaths: true } : {},
				extensions: [
					".mjs",
					".js",
					".cjs",
					".mts",
					".ts",
					".cts",
					".jsx",
					".tsx",
					".json"
				]
			},
			plugins: [...isTypeScriptConfig ? [cjsGlobalsInjectorPlugin(configPath)] : [], commonjs({ filter: (id) => {
				const idPath = id.startsWith("file://") ? fileURLToPath(id) : id.split("?")[0];
				if (safeRealpath(path.resolve(idPath)) === normalizedConfigPath) return false;
				return id.includes("node_modules") ? true : void 0;
			} })]
		});
		return await unwrapConfig(mod, phase);
	} catch (e) {
		if (isCjsError(e) && (filename.endsWith(".js") || filename.endsWith(".cjs"))) try {
			return await loadConfigViaRequire(configPath, root, phase);
		} catch (e2) {
			warnConfigLoadFailure(filename, e2);
			throw e2;
		}
		warnConfigLoadFailure(filename, e);
		throw e;
	}
}
/**
* Generate a UUID that doesn't contain "ad" to avoid false-positive ad-blocker hits.
* Mirrors Next.js's own nanoid retry loop.
*/
function safeUUID() {
	let id = randomUUID();
	while (/ad/i.test(id)) id = randomUUID();
	return id;
}
/**
* Call the user's generateBuildId function and validate its return value.
* Follows Next.js semantics: null return falls back to a random UUID; any
* other non-string throws. Leading/trailing whitespace is trimmed.
*
* @see https://nextjs.org/docs/app/api-reference/config/next-config-js/generateBuildId
*/
async function resolveBuildId(generate) {
	if (!generate) return safeUUID();
	const result = await generate();
	if (result === null) return safeUUID();
	if (typeof result !== "string") throw new Error("generateBuildId did not return a string. https://nextjs.org/docs/messages/generatebuildid-not-a-string");
	const trimmed = result.trim();
	if (trimmed.length === 0) throw new Error("generateBuildId returned an empty string. https://nextjs.org/docs/messages/generatebuildid-not-a-string");
	return trimmed;
}
/**
* Normalize the `assetPrefix` option from next.config.
*
* Accepts both absolute URLs (`https://cdn.example.com[/subpath]`) and
* path prefixes (`/custom-asset-prefix`). Trailing slashes are trimmed.
* Empty/whitespace-only strings are treated as unset and return `""`.
*
* Path prefixes that omit the leading slash get one added so they always
* begin with `/` — this matches how Next.js routes match against them.
*
* Non-string values are rejected to surface config mistakes early.
*
* @see https://nextjs.org/docs/app/api-reference/config/next-config-js/assetPrefix
*/
function normalizeAssetPrefix(value) {
	if (value === void 0 || value === null || value === "") return "";
	if (typeof value !== "string") throw new Error(`Invalid \`assetPrefix\` configuration: must be a string, got ${typeof value}. Accepts a path prefix ("/custom-asset-prefix") or an absolute URL ("https://cdn.example.com").`);
	let trimmed = value.trim();
	while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
	if (trimmed === "") return "";
	if (/^https?:\/\//i.test(trimmed)) {
		if (!URL.canParse(trimmed)) throw new Error(`Invalid \`assetPrefix\` configuration: "${value}" is not a parseable URL.`);
		return trimmed;
	}
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function resolveDeploymentId(configDeploymentId) {
	const deploymentId = configDeploymentId !== void 0 ? configDeploymentId : process.env.NEXT_DEPLOYMENT_ID;
	if (deploymentId === void 0 || deploymentId === "") return void 0;
	if (typeof deploymentId !== "string") throw new Error("Invalid `deploymentId` configuration: must be a string. https://nextjs.org/docs/messages/deploymentid-not-a-string");
	if (!/^[a-zA-Z0-9_-]+$/.test(deploymentId)) throw new Error("Invalid `deploymentId` configuration: contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed. https://nextjs.org/docs/messages/deploymentid-invalid-characters");
	return deploymentId;
}
/**
* Resolve the App Router RSC compatibility identity for a build.
*
* This token is baked into the client bundle and echoed by the server in the
* `X-Vinext-RSC-Compatibility-Id` response header; browser navigation rejects
* RSC payloads whose token differs (deploy skew) without exposing the raw
* build ID. When the user pins a `deploymentId` we reuse it (already stable
* across plugin instances); otherwise we mint a random UUID.
*
* NOTE: like `resolveBuildId`, this is non-deterministic in the no-deploymentId
* case, so a single `vinext build` that instantiates the plugin more than once
* (App Router `buildApp()` + the hybrid Pages Router `vite.build()`) must
* resolve it once and share it — see `__VINEXT_SHARED_RSC_COMPATIBILITY_ID`.
*/
function createRscCompatibilityId(nextConfig) {
	if (nextConfig.deploymentId) return nextConfig.deploymentId;
	return randomUUID();
}
/**
* Converts a cache handler path to a filesystem path.
* ESM's import.meta.resolve() returns file:// URLs which break when concatenated
* with path operations like path.join or path.relative.
* @param filePath - Absolute path, relative path, or file:// URL (e.g. from import.meta.resolve)
* @returns A filesystem path suitable for path operations
*/
function resolveCacheHandlerPathToFilesystem(filePath) {
	if (filePath.startsWith("file://")) return toSlash(fileURLToPath(filePath));
	return toSlash(filePath);
}
function resolveHtmlLimitedBots(value) {
	const source = value instanceof RegExp ? value.source : typeof value === "string" ? value : void 0;
	if (!source) return void 0;
	try {
		getHtmlLimitedBotRegex(source);
	} catch (error) {
		throw new Error("Invalid next.config option \"htmlLimitedBots\": expected a valid regular expression source", { cause: error });
	}
	return source;
}
function readOptionalRecord(value) {
	return isUnknownRecord(value) ? value : void 0;
}
function readOptionalString(value) {
	return typeof value === "string" ? value : void 0;
}
function readOptionalBodySizeLimit(value) {
	return typeof value === "string" || typeof value === "number" ? value : void 0;
}
function readStringArray(value) {
	return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
/**
* Convert lightningcss feature names from `experimental.lightningCssFeatures`
* into a numeric bitmask consumable by the `lightningcss` `transform()` /
* `bundle()` API (the `include` / `exclude` options).
*
* The mapping mirrors Next.js exactly so the same dash-case feature names
* accepted by `next.config` produce the same bits on both sides. See:
*  - `.nextjs-ref/packages/next/src/server/config-shared.ts` (`LIGHTNINGCSS_FEATURE_NAMES`)
*  - `.nextjs-ref/crates/next-core/src/next_config.rs` (`lightningcss_feature_names_to_mask`)
*  - `lightningcss/node/targets.d.ts` (`Features` enum bits)
*
* Unknown names emit a warning (matching the Next.js Rust path, which errors;
* we warn instead so a stray name doesn't break the whole build).
*/
const LIGHTNINGCSS_FEATURE_BITS = {
	nesting: 1,
	"not-selector-list": 2,
	"dir-selector": 4,
	"lang-selector-list": 8,
	"is-selector": 16,
	"text-decoration-thickness-percent": 32,
	"media-interval-syntax": 64,
	"media-range-syntax": 128,
	"custom-media-queries": 256,
	"clamp-function": 512,
	"color-function": 1024,
	"oklab-colors": 2048,
	"lab-colors": 4096,
	"p3-colors": 8192,
	"hex-alpha-colors": 16384,
	"space-separated-color-notation": 32768,
	"font-family-system-ui": 65536,
	"double-position-gradients": 131072,
	"vendor-prefixes": 262144,
	"logical-properties": 524288,
	"light-dark": 1048576,
	selectors: 31,
	"media-queries": 448,
	colors: 1113088
};
function lightningCssFeatureNamesToMask(names) {
	let mask = 0;
	for (const name of names) {
		const bit = LIGHTNINGCSS_FEATURE_BITS[name];
		if (bit === void 0) {
			console.warn(`[vinext] Unknown lightningcss feature name "${name}" in experimental.lightningCssFeatures — ignoring.`);
			continue;
		}
		mask |= bit;
	}
	return mask;
}
/**
* Serialize a `compiler.define` / `compiler.defineServer` map into the
* Vite-friendly `Record<string, string>` shape where each value is already
* a JSON-encoded literal of source code. Entries whose values are not a
* string/number/boolean are silently dropped, matching how Next.js types
* the API (other shapes are not part of the contract).
*
* Mirrors Next.js: packages/next/src/build/define-env.ts (serializeDefineEnv).
*/
function serializeCompilerDefine(value) {
	if (!isUnknownRecord(value)) return {};
	const out = {};
	for (const [key, raw] of Object.entries(value)) if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") out[key] = JSON.stringify(raw);
	return out;
}
/**
* Defaults for `experimental.staleTimes` (in seconds), matching Next.js'
* `config-shared.ts` defaults.
*/
const DEFAULT_STALE_TIMES = {
	dynamic: 0,
	static: 300
};
/**
* Parse `experimental.staleTimes` from a raw next.config object.
*
* Mirrors Next.js' `build/define-env.ts` parsing logic:
*   - missing / NaN / negative values fall back to the documented defaults
*     (`dynamic: 0`, `static: 300`) — matching Next.js parity and the
*     non-negative guard in `resolvePrefetchCacheTtl`
*   - all values are in seconds
*
* @see https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes
*/
function resolveStaleTimes(experimental) {
	const staleTimes = readOptionalRecord(experimental?.staleTimes);
	const dynamicRaw = Number(staleTimes?.dynamic);
	const staticRaw = Number(staleTimes?.static);
	return {
		dynamic: Number.isFinite(dynamicRaw) && dynamicRaw >= 0 ? dynamicRaw : DEFAULT_STALE_TIMES.dynamic,
		static: Number.isFinite(staticRaw) && staticRaw >= 0 ? staticRaw : DEFAULT_STALE_TIMES.static
	};
}
function normalizePrefetchInliningConfig(value) {
	if (!value) return false;
	const raw = isUnknownRecord(value) ? value : null;
	const maxSize = raw ? raw.maxSize ?? 2048 : 2048;
	const maxBundleSize = raw ? raw.maxBundleSize ?? 10240 : 10240;
	const normalizedMaxSize = Number(maxSize);
	const normalizedMaxBundleSize = Number(maxBundleSize);
	return {
		maxBundleSize: Number.isFinite(normalizedMaxBundleSize) ? normalizedMaxBundleSize : Number.MAX_SAFE_INTEGER,
		maxSize: Number.isFinite(normalizedMaxSize) ? normalizedMaxSize : Number.MAX_SAFE_INTEGER
	};
}
function normalizeI18nConfig(value) {
	if (!value) return null;
	const i18nType = typeof value;
	if (i18nType !== "object") throw new Error(`Specified i18n should be an object received ${i18nType}.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	const i18n = value;
	if (!Array.isArray(i18n.locales)) throw new Error(`Specified i18n.locales should be an Array received ${typeof i18n.locales}.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	if (i18n.locales.length > 100) console.warn(`Received ${i18n.locales.length} i18n.locales items which exceeds the recommended max of 100.\nSee more info here: https://nextjs.org/docs/advanced-features/i18n-routing#how-does-this-work-with-static-generation`);
	if (!i18n.defaultLocale || typeof i18n.defaultLocale !== "string") throw new Error("Specified i18n.defaultLocale should be a string.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config");
	if (i18n.domains !== void 0 && !Array.isArray(i18n.domains)) throw new Error(`Specified i18n.domains must be an array of domain objects e.g. [ { domain: 'example.fr', defaultLocale: 'fr', locales: ['fr'] } ] received ${typeof i18n.domains}.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	if (i18n.domains) {
		const invalidDomainItems = i18n.domains.filter((item) => {
			if (!isUnknownRecord(item) || !item.defaultLocale) return true;
			if (!item.domain || typeof item.domain !== "string") return true;
			if (item.domain.includes(":")) {
				console.warn(`i18n domain: "${item.domain}" is invalid it should be a valid domain without protocol (https://) or port (:3000) e.g. example.vercel.sh`);
				return true;
			}
			const defaultLocaleDuplicate = i18n.domains.find((other) => isUnknownRecord(other) && other.defaultLocale === item.defaultLocale && other.domain !== item.domain);
			if (defaultLocaleDuplicate && isUnknownRecord(defaultLocaleDuplicate)) {
				console.warn(`Both ${item.domain} and ${String(defaultLocaleDuplicate.domain)} configured the defaultLocale ${item.defaultLocale} but only one can. Change one item's default locale to continue`);
				return true;
			}
			let hasInvalidLocale = false;
			if (Array.isArray(item.locales)) for (const locale of item.locales) {
				if (typeof locale !== "string") hasInvalidLocale = true;
				for (const domainItem of i18n.domains) {
					if (domainItem === item || !isUnknownRecord(domainItem)) continue;
					const domainLocales = domainItem.locales;
					if (domainLocales && domainLocales.includes(locale)) {
						console.warn(`Both ${item.domain} and ${String(domainItem.domain)} configured the locale (${String(locale)}) but only one can. Remove it from one i18n.domains config to continue`);
						hasInvalidLocale = true;
						break;
					}
				}
			}
			return hasInvalidLocale;
		});
		if (invalidDomainItems.length > 0) throw new Error(`Invalid i18n.domains values:\n${invalidDomainItems.map((item) => JSON.stringify(item)).join("\n")}\n\ndomains value must follow format { domain: 'example.fr', defaultLocale: 'fr', locales: ['fr'] }.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	}
	const invalidLocales = i18n.locales.filter((locale) => typeof locale !== "string");
	if (invalidLocales.length > 0) throw new Error(`Specified i18n.locales contains invalid values (${invalidLocales.map(String).join(", ")}), locales must be valid locale tags provided as strings e.g. "en-US".\nSee here for list of valid language sub-tags: http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry`);
	const locales = i18n.locales;
	if (!locales.includes(i18n.defaultLocale)) throw new Error("Specified i18n.defaultLocale should be included in i18n.locales.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config");
	const normalizedLocales = /* @__PURE__ */ new Set();
	const duplicateLocales = /* @__PURE__ */ new Set();
	for (const locale of locales) {
		const localeLower = locale.toLowerCase();
		if (normalizedLocales.has(localeLower)) duplicateLocales.add(locale);
		normalizedLocales.add(localeLower);
	}
	if (duplicateLocales.size > 0) throw new Error(`Specified i18n.locales contains the following duplicate locales:\n${[...duplicateLocales].join(", ")}\nEach locale should be listed only once.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	const localeDetectionType = typeof i18n.localeDetection;
	if (localeDetectionType !== "boolean" && localeDetectionType !== "undefined") throw new Error(`Specified i18n.localeDetection should be undefined or a boolean received ${localeDetectionType}.\nSee more info here: https://nextjs.org/docs/messages/invalid-i18n-config`);
	return {
		locales: [i18n.defaultLocale, ...locales.filter((locale) => locale !== i18n.defaultLocale)],
		defaultLocale: i18n.defaultLocale,
		localeDetection: i18n.localeDetection ?? true,
		domains: i18n.domains
	};
}
/**
* Resolve a NextConfig into a fully-resolved ResolvedNextConfig.
* Awaits async functions for redirects/rewrites/headers.
*/
async function resolveNextConfig(config, root = toSlash(process.cwd()), options = {}) {
	if (!config) {
		const buildId = await resolveBuildId(void 0);
		const deploymentId = resolveDeploymentId(void 0);
		const resolved = {
			env: {},
			basePath: "",
			assetPrefix: "",
			trailingSlash: false,
			output: "",
			pageExtensions: normalizePageExtensions(),
			resolveExtensions: null,
			serverResolveExtensions: null,
			cacheComponents: false,
			appNavFailHandling: false,
			gestureTransition: false,
			prefetchInlining: false,
			redirects: [],
			rewrites: {
				beforeFiles: [],
				afterFiles: [],
				fallback: []
			},
			headers: [],
			images: void 0,
			i18n: null,
			mdx: null,
			aliases: {},
			allowedDevOrigins: [],
			serverActionsAllowedOrigins: [],
			optimizePackageImports: [],
			transpilePackages: [],
			turbopackTranspilePackages: [...DEFAULT_TRANSPILED_PACKAGES],
			inlineCss: false,
			globalNotFound: false,
			serverActionsBodySizeLimit: 1 * 1024 * 1024,
			serverActionsBodySizeLimitLabel: "1 MB",
			expireTime: DEFAULT_EXPIRE_TIME,
			reactMaxHeadersLength: DEFAULT_REACT_MAX_HEADERS_LENGTH,
			htmlLimitedBots: void 0,
			serverExternalPackages: [],
			cacheHandler: void 0,
			cacheMaxMemorySize: void 0,
			enablePrerenderSourceMaps: true,
			appShells: false,
			hashSalt: process.env.NEXT_HASH_SALT ?? "",
			buildId,
			deploymentId,
			sassOptions: null,
			removeConsole: false,
			disableOptimizedLoading: false,
			reactStrictMode: null,
			scrollRestoration: false,
			compilerDefine: {},
			compilerDefineServer: {},
			instrumentationClientInject: [],
			clientTraceMetadata: void 0,
			staleTimes: { ...DEFAULT_STALE_TIMES },
			useLightningcss: false,
			lightningCssFeatures: {
				include: 0,
				exclude: 0
			}
		};
		detectNextIntlConfig(root, resolved);
		return resolved;
	}
	warnDeprecatedConfigOptions(config, root);
	const i18n = normalizeI18nConfig(config.i18n);
	let redirects = [];
	if (config.redirects) {
		const result = await config.redirects();
		redirects = Array.isArray(result) ? result : [];
	}
	let rewrites = {
		beforeFiles: [],
		afterFiles: [],
		fallback: []
	};
	if (config.rewrites) {
		const result = await config.rewrites();
		if (Array.isArray(result)) rewrites.afterFiles = result;
		else rewrites = {
			beforeFiles: result.beforeFiles ?? [],
			afterFiles: result.afterFiles ?? [],
			fallback: result.fallback ?? []
		};
	}
	{
		const externalRewrites = [
			...rewrites.beforeFiles,
			...rewrites.afterFiles,
			...rewrites.fallback
		].filter((rewrite) => isExternalUrl(rewrite.destination));
		if (externalRewrites.length > 0) {
			const noun = externalRewrites.length === 1 ? "external rewrite" : "external rewrites";
			const listing = externalRewrites.map((rewrite) => `  ${rewrite.source} → ${rewrite.destination}`).join("\n");
			console.warn(`[vinext] Found ${externalRewrites.length} ${noun} that proxy requests to external origins:\n${listing}\nRequest headers, including credential headers (cookie, authorization, proxy-authorization, x-api-key), are forwarded to the external origin to match Next.js behavior. If you do not want to forward credentials, use an API route or route handler where you control exactly which headers are sent.`);
		}
	}
	let headers = [];
	if (config.headers) headers = await config.headers();
	const webpackProbe = await probeWebpackConfig(config, root, options.dev ?? false);
	const mdx = webpackProbe.mdx;
	const aliases = {
		...extractTurboAliases(config, root),
		...webpackProbe.aliases
	};
	const allowedDevOrigins = Array.isArray(config.allowedDevOrigins) ? config.allowedDevOrigins : [];
	const experimental = readOptionalRecord(config.experimental);
	const serverActionsConfig = readOptionalRecord(experimental?.serverActions);
	const serverActionsAllowedOrigins = readStringArray(serverActionsConfig?.allowedOrigins);
	const serverActionsBodySizeLimitConfig = readOptionalBodySizeLimit(serverActionsConfig?.bodySizeLimit);
	const serverActionsBodySizeLimit = parseBodySizeLimit(serverActionsBodySizeLimitConfig);
	const serverActionsBodySizeLimitLabel = serverActionsBodySizeLimitConfig === void 0 ? "1 MB" : String(serverActionsBodySizeLimitConfig);
	const hashSalt = (readOptionalString(experimental?.outputHashSalt) ?? "") + (process.env.NEXT_HASH_SALT ?? "");
	const htmlLimitedBots = resolveHtmlLimitedBots(config.htmlLimitedBots);
	const rawOptimize = experimental?.optimizePackageImports;
	const optimizePackageImports = Array.isArray(rawOptimize) ? rawOptimize.filter((x) => typeof x === "string") : [];
	const inlineCss = experimental?.inlineCss === true;
	const globalNotFound = experimental?.globalNotFound === true;
	const prefetchInlining = normalizePrefetchInliningConfig(experimental?.prefetchInlining);
	const appShells = experimental?.appShells === true;
	if (appShells) {
		const missingCoFlags = [];
		if (!config.cacheComponents) missingCoFlags.push("cacheComponents");
		if (!prefetchInlining) missingCoFlags.push("experimental.prefetchInlining");
		if (experimental?.varyParams !== true) missingCoFlags.push("experimental.varyParams");
		if (experimental?.optimisticRouting !== true) missingCoFlags.push("experimental.optimisticRouting");
		if (experimental?.cachedNavigations !== true) missingCoFlags.push("experimental.cachedNavigations");
		if (missingCoFlags.length > 0) console.warn(`[vinext] experimental.appShells is enabled but requires the following co-flags which are not yet supported or not enabled: ${missingCoFlags.join(", ")}. App Shell prefetching behavior is not implemented in vinext (see issue #1614). The flag will be accepted for config compatibility but has no functional effect.`);
	}
	const topLevelServerExternalPackages = Array.isArray(config.serverExternalPackages) ? readStringArray(config.serverExternalPackages) : void 0;
	const legacyServerComponentsExternal = readStringArray(experimental?.serverComponentsExternalPackages);
	const serverExternalPackages = topLevelServerExternalPackages ?? legacyServerComponentsExternal;
	const transpilePackages = readStringArray(config.transpilePackages);
	const turbopackTranspilePackages = [...transpilePackages, ...DEFAULT_TRANSPILED_PACKAGES];
	if (experimental?.swcEnvOptions !== void 0) console.warn("[vinext] next.config option \"experimental.swcEnvOptions\" is not applicable and will be ignored (vinext uses Vite, not SWC). A Vite-compatible polyfill solution may be explored in the future.");
	if (experimental?.rootParams !== void 0) console.warn("[vinext] `experimental.rootParams` is no longer needed, because `next/root-params` is available by default. You can remove it from next.config.(js|mjs|ts).");
	const useLightningcss = experimental?.useLightningcss === true;
	const rawLightningCssFeatures = readOptionalRecord(experimental?.lightningCssFeatures);
	const lightningCssFeatures = {
		include: lightningCssFeatureNamesToMask(readStringArray(rawLightningCssFeatures?.include)),
		exclude: lightningCssFeatureNamesToMask(readStringArray(rawLightningCssFeatures?.exclude))
	};
	if (rawLightningCssFeatures && !useLightningcss) console.warn("[vinext] experimental.lightningCssFeatures is set but experimental.useLightningcss is not enabled. The lightningCssFeatures option has no effect without useLightningcss.");
	if (experimental?.cachedNavigations === true && !config.cacheComponents) console.warn("[vinext] `experimental.cachedNavigations` requires `cacheComponents: true` to have any effect. Set `cacheComponents: true` in your next.config, or remove `experimental.cachedNavigations`.");
	if (config.webpack !== void 0) if (mdx || Object.keys(webpackProbe.aliases).length > 0 || webpackProbe.resolveExtensionsCustomized) console.warn("[vinext] next.config option \"webpack\" is only partially supported. vinext preserves resolve.alias, resolve.extensions, and MDX loader settings, but other webpack customization is ignored");
	else console.warn("[vinext] next.config option \"webpack\" is not yet supported and will be ignored");
	const output = readOptionalString(config.output) ?? "";
	if (output && output !== "export" && output !== "standalone") console.warn(`[vinext] Unknown output mode "${output}", ignoring`);
	const pageExtensions = normalizePageExtensions(config.pageExtensions);
	const experimentalTurbo = readOptionalRecord(experimental?.turbo);
	const turbopack = readOptionalRecord(config.turbopack);
	const resolveExtensions = Array.isArray(turbopack?.resolveExtensions) ? readStringArray(turbopack.resolveExtensions) : Array.isArray(experimentalTurbo?.resolveExtensions) ? readStringArray(experimentalTurbo.resolveExtensions) : null;
	const buildId = await resolveBuildId(config.generateBuildId);
	const deploymentId = resolveDeploymentId(config.deploymentId);
	const cacheHandler = typeof config.cacheHandler === "string" ? resolveCacheHandlerPathToFilesystem(config.cacheHandler) : void 0;
	const cacheMaxMemorySize = typeof config.cacheMaxMemorySize === "number" ? config.cacheMaxMemorySize : void 0;
	if (i18n) {
		const opts = { trailingSlash: config.trailingSlash ?? false };
		redirects = applyLocaleToRoutes(redirects, i18n, "redirect", opts);
		rewrites = {
			beforeFiles: applyLocaleToRoutes(rewrites.beforeFiles, i18n, "rewrite", opts),
			afterFiles: applyLocaleToRoutes(rewrites.afterFiles, i18n, "rewrite", opts),
			fallback: applyLocaleToRoutes(rewrites.fallback, i18n, "rewrite", opts)
		};
		headers = applyLocaleToRoutes(headers, i18n, "header", opts);
	}
	const images = config.images ? {
		...config.images,
		remotePatterns: config.images.remotePatterns?.map((pattern) => pattern instanceof URL ? {
			protocol: pattern.protocol.slice(0, -1),
			hostname: pattern.hostname,
			port: pattern.port,
			pathname: pattern.pathname,
			search: pattern.search
		} : { ...pattern })
	} : void 0;
	const resolved = {
		env: config.env ?? {},
		basePath: config.basePath ?? "",
		assetPrefix: normalizeAssetPrefix(config.assetPrefix),
		trailingSlash: config.trailingSlash ?? false,
		output: output === "export" || output === "standalone" ? output : "",
		pageExtensions,
		resolveExtensions: resolveExtensions ?? webpackProbe.resolveExtensions,
		serverResolveExtensions: resolveExtensions ?? webpackProbe.serverResolveExtensions,
		instrumentationClientInject: Array.isArray(config.instrumentationClientInject) ? config.instrumentationClientInject.filter((x) => typeof x === "string") : [],
		cacheComponents: config.cacheComponents ?? false,
		appNavFailHandling: experimental?.appNavFailHandling === true,
		gestureTransition: experimental?.gestureTransition === true,
		prefetchInlining,
		redirects,
		rewrites,
		headers,
		images,
		i18n,
		mdx,
		aliases,
		allowedDevOrigins,
		serverActionsAllowedOrigins,
		optimizePackageImports,
		transpilePackages,
		turbopackTranspilePackages,
		inlineCss,
		globalNotFound,
		serverActionsBodySizeLimit,
		serverActionsBodySizeLimitLabel,
		expireTime: typeof config.expireTime === "number" ? config.expireTime : DEFAULT_EXPIRE_TIME,
		reactMaxHeadersLength: typeof config.reactMaxHeadersLength === "number" ? config.reactMaxHeadersLength : DEFAULT_REACT_MAX_HEADERS_LENGTH,
		htmlLimitedBots,
		serverExternalPackages,
		cacheHandler,
		cacheMaxMemorySize,
		enablePrerenderSourceMaps: config.enablePrerenderSourceMaps ?? true,
		appShells,
		hashSalt,
		buildId,
		deploymentId,
		sassOptions: readOptionalRecord(config.sassOptions) ?? null,
		removeConsole: config.compiler?.removeConsole === true ? true : isUnknownRecord(config.compiler?.removeConsole) ? { exclude: readStringArray(config.compiler.removeConsole.exclude) } : false,
		disableOptimizedLoading: experimental?.disableOptimizedLoading === true,
		reactStrictMode: typeof config.reactStrictMode === "boolean" ? config.reactStrictMode : null,
		scrollRestoration: experimental?.scrollRestoration === true,
		compilerDefine: serializeCompilerDefine(config.compiler?.define),
		compilerDefineServer: serializeCompilerDefine(config.compiler?.defineServer),
		clientTraceMetadata: Array.isArray(experimental?.clientTraceMetadata) ? experimental.clientTraceMetadata.filter((value) => typeof value === "string") : void 0,
		staleTimes: resolveStaleTimes(experimental),
		useLightningcss,
		lightningCssFeatures
	};
	detectNextIntlConfig(root, resolved);
	if (resolved.basePath !== "" && resolved.basePath !== "/" && resolved.assetPrefix === "") resolved.assetPrefix = resolved.basePath;
	return resolved;
}
/**
* Whether an alias target is a relative filesystem path (`./foo`, `../foo`,
* or a bare `.`/`..`) that should be resolved against the project root.
*
* Both Next.js Turbopack `resolveAlias` and webpack `resolve.alias` accept two
* kinds of values: relative/absolute file paths AND bare package specifiers
* (e.g. `react`, `preact/compat`, `@scope/pkg`). Bare specifiers must be left
* verbatim so Vite/Rolldown re-resolves them through node_modules — resolving
* them against `root` mangles them into bogus `<root>/react` paths and breaks
* the build with "No such file or directory". See cloudflare/vinext#1507.
*/
function isRelativeAliasTarget(value) {
	return value === "." || value === ".." || value.startsWith("./") || value.startsWith("../");
}
function normalizeAliasEntries(aliases, root) {
	if (!aliases) return {};
	const normalized = {};
	for (const [key, value] of Object.entries(aliases)) {
		if (typeof value !== "string") continue;
		if (path.isAbsolute(value)) normalized[key] = value;
		else if (isRelativeAliasTarget(value)) normalized[key] = path.resolve(root, value);
		else normalized[key] = value;
	}
	return normalized;
}
function extractTurboAliases(config, root) {
	const experimentalTurbo = readOptionalRecord(readOptionalRecord(config.experimental)?.turbo);
	const topLevelTurbopack = readOptionalRecord(config.turbopack);
	return {
		...normalizeAliasEntries(readOptionalRecord(experimentalTurbo?.resolveAlias), root),
		...normalizeAliasEntries(readOptionalRecord(topLevelTurbopack?.resolveAlias), root)
	};
}
async function probeWebpackConfig(config, root, dev) {
	if (typeof config.webpack !== "function") return {
		aliases: {},
		mdx: null,
		resolveExtensions: null,
		serverResolveExtensions: null,
		resolveExtensionsCustomized: false
	};
	try {
		const clientProbe = await runWebpackConfigProbe(config, root, {
			dev,
			isServer: false
		});
		const serverProbe = await runWebpackConfigProbe(config, root, {
			dev,
			isServer: true,
			nextRuntime: "nodejs"
		});
		invokeLoaderSideEffects(clientProbe.rules, root);
		return {
			aliases: normalizeAliasEntries(clientProbe.config.resolve?.alias, root),
			mdx: extractMdxOptionsFromRules(clientProbe.rules),
			resolveExtensions: clientProbe.resolveExtensions,
			serverResolveExtensions: serverProbe.resolveExtensions,
			resolveExtensionsCustomized: clientProbe.resolveExtensions !== null || serverProbe.resolveExtensions !== null
		};
	} catch {
		return {
			aliases: {},
			mdx: null,
			resolveExtensions: null,
			serverResolveExtensions: null,
			resolveExtensionsCustomized: false
		};
	}
}
const DEFAULT_WEBPACK_RESOLVE_EXTENSIONS = [
	".js",
	".mjs",
	".tsx",
	".ts",
	".jsx",
	".json",
	".wasm"
];
async function runWebpackConfigProbe(config, root, options) {
	const rules = [];
	const mockConfig = {
		context: root,
		resolve: {
			alias: {},
			extensions: [...DEFAULT_WEBPACK_RESOLVE_EXTENSIONS]
		},
		module: { rules },
		plugins: []
	};
	const finalConfig = await config.webpack(mockConfig, {
		defaultLoaders: { babel: { loader: "next-babel-loader" } },
		...options,
		dir: root
	}) ?? mockConfig;
	const finalRules = finalConfig.module?.rules ?? rules;
	const extensions = Array.isArray(finalConfig.resolve?.extensions) ? readStringArray(finalConfig.resolve.extensions) : null;
	return {
		config: finalConfig,
		rules: finalRules,
		resolveExtensions: extensions !== null && (extensions.length !== DEFAULT_WEBPACK_RESOLVE_EXTENSIONS.length || extensions.some((extension, index) => extension !== DEFAULT_WEBPACK_RESOLVE_EXTENSIONS[index])) ? extensions : null
	};
}
/**
* Walk webpack module rules and invoke each referenced loader once with a
* dummy source string. Loaders that mutate `process.env` at compile time (a
* pattern supported by Next.js' webpack pipeline — see issue #1500) get a
* chance to land their mutations before vinext computes its defines.
* Failures are swallowed: a loader throwing on dummy input must not break
* the build, since vinext doesn't actually use the loader's transform output.
*/
function invokeLoaderSideEffects(rules, root) {
	const require = createRequire(path.join(root, "package.json"));
	const seen = /* @__PURE__ */ new Set();
	const invokeLoaderEntry = (entry, ruleOptions) => {
		if (!entry) return;
		let loaderPath;
		let loaderFn;
		let options = ruleOptions;
		if (typeof entry === "string") loaderPath = entry;
		else if (typeof entry === "function") loaderFn = entry;
		else if (typeof entry === "object") {
			const e = entry;
			if (typeof e.loader === "string") loaderPath = e.loader;
			else if (typeof e.loader === "function") loaderFn = e.loader;
			if (e.options !== void 0) options = e.options;
		}
		if (loaderPath !== void 0) {
			if (seen.has(loaderPath)) return;
			seen.add(loaderPath);
			if (loaderPath.includes("next-babel-loader") || loaderPath.includes("mdx") || loaderPath.startsWith("next/dist/build/webpack")) return;
			try {
				loaderFn = require(loaderPath);
				if (loaderFn && typeof loaderFn === "object" && typeof loaderFn.default === "function") loaderFn = loaderFn.default;
			} catch {
				return;
			}
		}
		if (typeof loaderFn !== "function") return;
		if (seen.has(loaderFn)) return;
		seen.add(loaderFn);
		try {
			const loaderThis = {
				async: () => () => {},
				callback: () => {},
				emitError: () => {},
				emitWarning: () => {},
				cacheable: () => {},
				getOptions: () => options ?? {},
				query: options ?? {},
				resourcePath: "",
				resource: "",
				rootContext: root,
				context: root,
				mode: "production"
			};
			loaderFn.call(loaderThis, "");
		} catch {}
	};
	const visit = (rule) => {
		if (!rule || typeof rule !== "object") return;
		if (Array.isArray(rule)) {
			for (const child of rule) visit(child);
			return;
		}
		if (Array.isArray(rule.oneOf)) for (const child of rule.oneOf) visit(child);
		if (Array.isArray(rule.rules)) for (const child of rule.rules) visit(child);
		const uses = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : [];
		for (const use of uses) invokeLoaderEntry(use);
		if (rule.loader !== void 0) invokeLoaderEntry(rule.loader, rule.options);
	};
	for (const rule of rules) visit(rule);
}
/**
* Extract MDX compilation options (remark/rehype/recma plugins) from
* a Next.js config that uses @next/mdx.
*
* @next/mdx wraps the config with a webpack function that injects an MDX
* loader rule. The remark/rehype plugins are captured in that closure.
* We probe the webpack function with a mock config to extract them.
*/
async function extractMdxOptions(config, root = toSlash(process.cwd())) {
	return (await probeWebpackConfig(config, root, false)).mdx;
}
/**
* Probe file candidates relative to root. Returns the first one that exists,
* or null if none match.
*/
function probeFiles(root, candidates) {
	for (const candidate of candidates) {
		const abs = path.resolve(root, candidate);
		if (fs.existsSync(abs)) return abs;
	}
	return null;
}
const I18N_REQUEST_CANDIDATES = [
	"i18n/request.ts",
	"i18n/request.tsx",
	"i18n/request.js",
	"i18n/request.jsx",
	"src/i18n/request.ts",
	"src/i18n/request.tsx",
	"src/i18n/request.js",
	"src/i18n/request.jsx"
];
/**
* Detect next-intl in the project and auto-register the `next-intl/config`
* alias if needed.
*
* next-intl's `createNextIntlPlugin()` crashes in vinext because it calls
* `require('next/package.json')` to check the Next.js version. Instead,
* vinext detects next-intl and registers the alias automatically.
*
* Note: `require.resolve('next-intl')` walks up to parent `node_modules`
* directories via standard Node module resolution. In a monorepo, next-intl
* installed at the workspace root will trigger detection even if not listed
* in the project's own package.json. This is acceptable since a workspace-root
* install implies the user wants it available.
*
* Mutates `resolved.aliases` and `resolved.env` in place.
*/
function detectNextIntlConfig(root, resolved) {
	if (resolved.aliases["next-intl/config"]) return;
	const require = createRequire(path.join(root, "package.json"));
	try {
		require.resolve("next-intl");
	} catch {
		return;
	}
	const configPath = probeFiles(root, I18N_REQUEST_CANDIDATES);
	if (!configPath) return;
	resolved.aliases["next-intl/config"] = configPath;
	if (resolved.trailingSlash) resolved.env._next_intl_trailing_slash = "true";
}
function extractMdxOptionsFromRules(rules) {
	for (const rule of rules) {
		const loaders = extractMdxLoaders(rule);
		if (loaders) return loaders;
	}
	return null;
}
/**
* Recursively search a webpack rule (which may have nested `oneOf` arrays)
* for an MDX loader and extract its remark/rehype/recma plugin options.
*/
function extractMdxLoaders(rule) {
	if (!rule) return null;
	if (Array.isArray(rule.oneOf)) for (const child of rule.oneOf) {
		const result = extractMdxLoaders(child);
		if (result) return result;
	}
	const use = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : [];
	for (const loader of use) {
		const loaderPath = typeof loader === "string" ? loader : loader?.loader;
		if (typeof loaderPath === "string" && isMdxLoader(loaderPath)) return extractPluginsFromOptions(typeof loader === "object" ? loader.options : {});
	}
	if (typeof rule.loader === "string" && isMdxLoader(rule.loader)) return extractPluginsFromOptions(rule.options);
	return null;
}
function isMdxLoader(loaderPath) {
	return loaderPath.includes("mdx") && (loaderPath.includes("@next") || loaderPath.includes("@mdx-js") || loaderPath.includes("mdx-js-loader") || loaderPath.includes("next-mdx"));
}
function extractPluginsFromOptions(opts) {
	if (!opts || typeof opts !== "object") return null;
	const remarkPlugins = Array.isArray(opts.remarkPlugins) ? opts.remarkPlugins : void 0;
	const rehypePlugins = Array.isArray(opts.rehypePlugins) ? opts.rehypePlugins : void 0;
	const recmaPlugins = Array.isArray(opts.recmaPlugins) ? opts.recmaPlugins : void 0;
	if (remarkPlugins && remarkPlugins.length > 0 || rehypePlugins && rehypePlugins.length > 0 || recmaPlugins && recmaPlugins.length > 0) return {
		...remarkPlugins && remarkPlugins.length > 0 ? { remarkPlugins } : {},
		...rehypePlugins && rehypePlugins.length > 0 ? { rehypePlugins } : {},
		...recmaPlugins && recmaPlugins.length > 0 ? { recmaPlugins } : {}
	};
	return null;
}
//#endregion
export { PHASE_PRODUCTION_BUILD, VINEXT_NEXT_CONFIG_PLUGIN_PROPERTY, createRscCompatibilityId, detectNextIntlConfig, extractMdxOptions, findNextConfigPath, findVinextNextConfigInPlugins, lightningCssFeatureNamesToMask, loadNextConfig, normalizeAssetPrefix, parseBodySizeLimit, reassignsModuleExports, referencesCjsGlobals, resolveNextConfig, resolveNextConfigInput };
