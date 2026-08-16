import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { escapeRegExp } from "../utils/regex.js";
import { ASSET_PREFIX_URL_DIR } from "../utils/asset-prefix.js";
import { lastSignificantChar } from "../utils/has-trailing-comma.js";
import { buildFallbackFontFace, getFallbackFontOverrideMetrics } from "../build/google-fonts/fallback-metrics.js";
import { validateGoogleFontOptions } from "../build/google-fonts/validate.js";
import { getFontAxes } from "../build/google-fonts/get-axes.js";
import { buildGoogleFontsUrl } from "../build/google-fonts/build-url.js";
import { findFontFilesInCss } from "../build/google-fonts/find-font-files-in-css.js";
import { CONTENT_TYPES } from "../server/static-file-cache.js";
import fs from "node:fs";
import { parseAst } from "vite";
import MagicString from "magic-string";
//#region src/plugins/fonts.ts
/**
* Thrown when Google Fonts returns a non-2xx response. Distinct from a raw
* `fetch` rejection (network error, DNS failure, AbortError) so the call
* site can decide whether to surface as a build error or fall through to
* the runtime CDN path.
*/
var GoogleFontsHttpError = class extends Error {
	url;
	status;
	responseBody;
	constructor(url, status, responseBody) {
		super(`Google Fonts returned HTTP ${status} for ${url}`);
		this.url = url;
		this.status = status;
		this.responseBody = responseBody;
		this.name = "GoogleFontsHttpError";
	}
};
const VIRTUAL_GOOGLE_FONTS = "virtual:vinext-google-fonts";
const RESOLVED_VIRTUAL_GOOGLE_FONTS = "\0virtual:vinext-google-fonts";
const GOOGLE_FONT_UTILITY_EXPORTS = /* @__PURE__ */ new Set([
	"buildGoogleFontsUrl",
	"getSSRFontLinks",
	"getSSRFontStyles",
	"getSSRFontPreloads",
	"createFontLoader"
]);
/**
* Served URL prefix for self-hosted Google Font files.
*
* `fetchAndCacheFont()` downloads .woff2 files into `<root>/.vinext/fonts/`
* and writes an `@font-face` CSS snippet whose `src: url(...)` references
* the files by absolute filesystem path — convenient for disk, unusable at
* runtime because browsers resolve relative to the origin. Before the CSS
* is embedded in the bundle as `_vinext.font.selfHostedCSS`, the filesystem
* prefix is rewritten to this URL prefix by `_rewriteCachedFontCssToServedUrls()`,
* and the matching `writeBundle` hook in `createGoogleFontsPlugin` copies
* the font files into `<clientOutDir>/<assetsDir>/_vinext_fonts/` so the
* rewritten URL actually resolves against the origin at request time.
*
* The leading `_` keeps the namespace distinct from Vite's content-hashed
* asset names (which are emitted flat into `<assetsDir>/`) and from any
* user-provided public files.
*/
const VINEXT_FONT_URL_NAMESPACE = "_vinext_fonts";
const MAX_GOOGLE_FONTS_ERROR_BODY_LENGTH = 500;
function formatGoogleFontsErrorBody(body) {
	const trimmed = body.trim();
	if (!trimmed) return "(empty response body)";
	if (trimmed.length <= MAX_GOOGLE_FONTS_ERROR_BODY_LENGTH) return trimmed;
	const omitted = trimmed.length - MAX_GOOGLE_FONTS_ERROR_BODY_LENGTH;
	return `${trimmed.slice(0, MAX_GOOGLE_FONTS_ERROR_BODY_LENGTH)}\n... (truncated ${omitted} characters)`;
}
/**
* Rewrite absolute filesystem paths in cached Google Fonts CSS so the
* `@font-face { src: url(...) }` references point at the served URL the
* plugin's `writeBundle` hook copies the font files to.
*
* This is called once per transform, before the CSS string is embedded in
* the bundle as `_vinext.font.selfHostedCSS`. Every downstream consumer reads
* from the same rewritten CSS: the injected `<style data-vinext-fonts>` block, the
* HTML body's `<link rel="preload">` tags (via `collectFontPreloadsFromCSS`
* in `shims/font-google-base.ts`), and the HTTP `Link:` response header
* (via `buildAppPageFontLinkHeader` in `server/app-page-execution.ts`).
*
* Without this rewrite, all three emit the dev-machine filesystem path
* (e.g. `/home/user/project/.vinext/fonts/geist-<hash>/geist-<hash>.woff2`)
* and any production request fetches `<origin>/home/user/...` → 404.
*
* `assetsDir` must match whatever Vite has resolved for
* `build.assetsDir` on the client environment — otherwise the embedded
* CSS URLs and the files emitted by the `writeBundle` hook would diverge
* and a user who customizes `build.assetsDir` (e.g. to `"static"`) would
* see 404s on every preload. The call site in `injectSelfHostedCss`
* passes the resolved value through from plugin state. The default is
* kept only so the exported helper can be driven directly from unit
* tests without synthesizing a full plugin context.
*
* Uses split/join rather than regex because `cacheDir` is an absolute
* filesystem path that may contain regex metacharacters on unusual
* filesystems.
*/
function _rewriteCachedFontCssToServedUrls(css, cacheDir, assetsDir = DEFAULT_ASSETS_DIR) {
	if (!cacheDir || !css.includes(cacheDir)) return css;
	const prefix = assetsDir || DEFAULT_ASSETS_DIR;
	return css.split(cacheDir).join(`/${prefix}/${VINEXT_FONT_URL_NAMESPACE}`);
}
/**
* Default `build.assetsDir` — matches vinext's resolved default in
* `resolveAssetsDir("")` (Next.js's canonical convention). Used as the
* fallback for the `assetsDir` parameter of
* `_rewriteCachedFontCssToServedUrls` so the exported helper can be unit
* tested without synthesizing plugin state. Production call sites thread
* the real `envConfig.build.assetsDir` resolved by Vite through so that
* the embedded CSS URLs always match the directory the `writeBundle`
* hook copies the font files into.
*/
const DEFAULT_ASSETS_DIR = ASSET_PREFIX_URL_DIR;
/**
* Safely parse a static JS object literal string into a plain object.
* Uses Vite's parseAst (Rollup/acorn) so no code is ever evaluated.
* Returns null if the expression contains anything dynamic (function calls,
* template literals, identifiers, computed properties, etc.).
*
* Supports: string literals, numeric literals, boolean literals,
* arrays of the above, and nested object literals.
*/
function parseStaticObjectLiteral(objectStr) {
	let ast;
	try {
		ast = parseAst(`(${objectStr})`);
	} catch {
		return null;
	}
	const body = ast.body;
	if (body.length !== 1 || body[0].type !== "ExpressionStatement") return null;
	const expr = body[0].expression;
	if (expr.type !== "ObjectExpression") return null;
	const result = extractStaticValue(expr);
	return result === void 0 ? null : result;
}
/**
* Recursively extract a static value from an ESTree AST node.
* Returns undefined (not null) if the node contains any dynamic expression.
*
* Uses `any` for the node parameter because Rollup's internal ESTree types
* (estree.Expression, estree.ObjectExpression, etc.) aren't re-exported by Vite,
* and the recursive traversal touches many different node shapes.
*/
function extractStaticValue(node) {
	switch (node.type) {
		case "Literal": return node.value;
		case "UnaryExpression":
			if (node.operator === "-" && node.argument?.type === "Literal" && typeof node.argument.value === "number") return -node.argument.value;
			return;
		case "ArrayExpression": {
			const arr = [];
			for (const elem of node.elements) {
				if (!elem) return void 0;
				const val = extractStaticValue(elem);
				if (val === void 0) return void 0;
				arr.push(val);
			}
			return arr;
		}
		case "ObjectExpression": {
			const obj = {};
			for (const prop of node.properties) {
				if (prop.type !== "Property") return void 0;
				if (prop.computed) return void 0;
				let key;
				if (prop.key.type === "Identifier") key = prop.key.name;
				else if (prop.key.type === "Literal" && typeof prop.key.value === "string") key = prop.key.value;
				else return;
				const val = extractStaticValue(prop.value);
				if (val === void 0) return void 0;
				obj[key] = val;
			}
			return obj;
		}
		default: return;
	}
}
function encodeGoogleFontsVirtualId(payload) {
	const params = new URLSearchParams();
	if (payload.hasDefault) params.set("default", "1");
	if (payload.fonts.length > 0) params.set("fonts", payload.fonts.join(","));
	if (payload.utilities.length > 0) params.set("utilities", payload.utilities.join(","));
	return `${VIRTUAL_GOOGLE_FONTS}?${params.toString()}`;
}
function parseGoogleFontsVirtualId(id) {
	const cleanId = id.startsWith("\0") ? id.slice(1) : id;
	if (!cleanId.startsWith("virtual:vinext-google-fonts")) return null;
	const queryIndex = cleanId.indexOf("?");
	const params = new URLSearchParams(queryIndex === -1 ? "" : cleanId.slice(queryIndex + 1));
	return {
		hasDefault: params.get("default") === "1",
		fonts: params.get("fonts")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
		utilities: params.get("utilities")?.split(",").map((value) => value.trim()).filter(Boolean) ?? []
	};
}
function generateGoogleFontsVirtualModule(id, fontGoogleShimPath) {
	const payload = parseGoogleFontsVirtualId(id);
	if (!payload) return null;
	const utilities = Array.from(new Set(payload.utilities));
	const fonts = Array.from(new Set(payload.fonts));
	const lines = [];
	lines.push(`import { createFontLoader } from ${JSON.stringify(fontGoogleShimPath)};`);
	const reExports = [];
	if (payload.hasDefault) reExports.push("default");
	reExports.push(...utilities);
	if (reExports.length > 0) lines.push(`export { ${reExports.join(", ")} } from ${JSON.stringify(fontGoogleShimPath)};`);
	for (const fontName of fonts) {
		const family = fontName.replace(/_/g, " ");
		lines.push(`export const ${fontName} = /*#__PURE__*/ createFontLoader(${JSON.stringify(family)});`);
	}
	lines.push("");
	return lines.join("\n");
}
function parseGoogleFontNamedSpecifiers(specifiersStr, forceType = false) {
	return specifiersStr.split(",").map((spec) => spec.trim()).filter(Boolean).map((raw) => {
		const isType = forceType || raw.startsWith("type ");
		const asParts = (isType ? raw.replace(/^type\s+/, "") : raw).split(/\s+as\s+/);
		return {
			imported: asParts[0]?.trim() ?? "",
			local: (asParts[1] || asParts[0] || "").trim(),
			isType,
			raw
		};
	}).filter((spec) => spec.imported.length > 0 && spec.local.length > 0);
}
function parseGoogleFontImportClause(clause) {
	const trimmed = clause.trim();
	if (trimmed.startsWith("type ")) {
		const braceStart = trimmed.indexOf("{");
		const braceEnd = trimmed.lastIndexOf("}");
		if (braceStart === -1 || braceEnd === -1) return {
			defaultLocal: null,
			namespaceLocal: null,
			named: []
		};
		return {
			defaultLocal: null,
			namespaceLocal: null,
			named: parseGoogleFontNamedSpecifiers(trimmed.slice(braceStart + 1, braceEnd), true)
		};
	}
	const braceStart = trimmed.indexOf("{");
	const braceEnd = trimmed.lastIndexOf("}");
	if (braceStart !== -1 && braceEnd !== -1) return {
		defaultLocal: trimmed.slice(0, braceStart).trim().replace(/,\s*$/, "").trim() || null,
		namespaceLocal: null,
		named: parseGoogleFontNamedSpecifiers(trimmed.slice(braceStart + 1, braceEnd))
	};
	const commaIndex = trimmed.indexOf(",");
	if (commaIndex !== -1) {
		const defaultLocal = trimmed.slice(0, commaIndex).trim() || null;
		const rest = trimmed.slice(commaIndex + 1).trim();
		if (rest.startsWith("* as ")) return {
			defaultLocal,
			namespaceLocal: rest.slice(5).trim() || null,
			named: []
		};
	}
	if (trimmed.startsWith("* as ")) return {
		defaultLocal: null,
		namespaceLocal: trimmed.slice(5).trim() || null,
		named: []
	};
	return {
		defaultLocal: trimmed || null,
		namespaceLocal: null,
		named: []
	};
}
function propertyNameToGoogleFontFamily(prop) {
	return prop.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
}
/**
* Fetch Google Fonts CSS, download .woff2 files, cache locally, and return
* @font-face CSS with local file references.
*
* Cache dir structure: .vinext/fonts/<family-hash>/
*   - style.css (the rewritten @font-face CSS)
*   - *.woff2 (downloaded font files)
*/
async function fetchAndCacheFont(cssUrl, family, cacheDir) {
	const { createHash } = await import("node:crypto");
	const urlHash = createHash("md5").update(cssUrl).digest("hex").slice(0, 12);
	const fontDir = path.join(cacheDir, `${family.toLowerCase().replace(/\s+/g, "-")}-${urlHash}`);
	const cachedCSSPath = path.join(fontDir, "style.css");
	if (fs.existsSync(cachedCSSPath)) return fs.readFileSync(cachedCSSPath, "utf-8");
	const cssResponse = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" } });
	if (!cssResponse.ok) {
		const body = await cssResponse.text().catch(() => "");
		throw new GoogleFontsHttpError(cssUrl, cssResponse.status, body);
	}
	let css = await cssResponse.text();
	const urlRe = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
	const urls = /* @__PURE__ */ new Map();
	let urlMatch;
	while ((urlMatch = urlRe.exec(css)) !== null) {
		const fontUrl = urlMatch[1];
		if (!urls.has(fontUrl)) {
			const ext = fontUrl.includes(".woff2") ? ".woff2" : fontUrl.includes(".woff") ? ".woff" : ".ttf";
			const fileHash = createHash("md5").update(fontUrl).digest("hex").slice(0, 8);
			urls.set(fontUrl, `${family.toLowerCase().replace(/\s+/g, "-")}-${fileHash}${ext}`);
		}
	}
	fs.mkdirSync(fontDir, { recursive: true });
	for (const [fontUrl, filename] of urls) {
		const filePath = path.join(fontDir, filename);
		if (!fs.existsSync(filePath)) {
			const fontResponse = await fetch(fontUrl);
			if (fontResponse.ok) {
				const buffer = Buffer.from(await fontResponse.arrayBuffer());
				fs.writeFileSync(filePath, buffer);
			}
		}
		css = css.split(fontUrl).join(filePath);
	}
	fs.writeFileSync(cachedCSSPath, css);
	return css;
}
/**
* Create the `vinext:google-fonts` Vite plugin.
*
* @param fontGoogleShimPath - Absolute path to the font-google shim module
*   (either `.ts` in source or `.js` in built packages). Resolved by the caller
*   so the plugin file has no dependency on `__dirname`.
* @param shimsDir - Absolute path to the shims directory. Used to skip shim
*   files from transform (they contain `next/font/google` references that must
*   not be rewritten).
*/
/**
* Scan `code` forward from `searchStart` for a `{...}` object literal that
* may contain arbitrarily nested braces.  Returns `[objStart, objEnd]` where
* `code[objStart] === '{'` and `code[objEnd - 1] === '}'`, or `null` if no
* balanced object is found.
*
* String literals (single-quoted, double-quoted, and backtick template
* literals including `${...}` interpolations) are fully skipped so that brace
* characters inside string values do not affect the depth count.
*/
function _findBalancedObject(code, searchStart) {
	let i = searchStart;
	while (i < code.length && (code[i] === " " || code[i] === "	" || code[i] === "\n" || code[i] === "\r")) i++;
	if (i >= code.length || code[i] !== "{") return null;
	const objStart = i;
	let depth = 0;
	while (i < code.length) {
		const ch = code[i];
		if (ch === "\"" || ch === "'") {
			const quote = ch;
			i++;
			while (i < code.length) {
				const sc = code[i];
				if (sc === "\\") i += 2;
				else if (sc === quote) {
					i++;
					break;
				} else i++;
			}
		} else if (ch === "`") {
			i++;
			while (i < code.length) {
				const tc = code[i];
				if (tc === "\\") i += 2;
				else if (tc === "`") {
					i++;
					break;
				} else if (tc === "$" && code[i + 1] === "{") {
					i += 2;
					let exprDepth = 1;
					while (i < code.length && exprDepth > 0) {
						const ec = code[i];
						if (ec === "{") {
							exprDepth++;
							i++;
						} else if (ec === "}") {
							exprDepth--;
							i++;
						} else if (ec === "\"" || ec === "'") {
							const q = ec;
							i++;
							while (i < code.length) if (code[i] === "\\") i += 2;
							else if (code[i] === q) {
								i++;
								break;
							} else i++;
						} else if (ec === "`") {
							i++;
							while (i < code.length) if (code[i] === "\\") i += 2;
							else if (code[i] === "`") {
								i++;
								break;
							} else i++;
						} else i++;
					}
				} else i++;
			}
		} else if (ch === "{") {
			depth++;
			i++;
		} else if (ch === "}") {
			depth--;
			i++;
			if (depth === 0) return [objStart, i];
		} else i++;
	}
	return null;
}
/**
* Given the index just past the closing `}` of an options object, skip
* optional whitespace and return the index after the closing `)`.
* Returns `null` if the next non-whitespace character is not `)`.
*/
function _findCallEnd(code, objEnd) {
	let i = objEnd;
	while (i < code.length && (code[i] === " " || code[i] === "	" || code[i] === "\n" || code[i] === "\r")) i++;
	if (i >= code.length || code[i] !== ")") return null;
	return i + 1;
}
function createGoogleFontsPlugin(fontGoogleShimPath, shimsDir) {
	const fontCache = /* @__PURE__ */ new Map();
	let cacheDir = "";
	return {
		name: "vinext:google-fonts",
		enforce: "pre",
		configResolved(config) {
			cacheDir = path.join(config.root, ".vinext", "fonts");
		},
		configureServer(server) {
			if (!cacheDir) return;
			const urlPrefix = `/${server.environments?.client?.config?.build?.assetsDir ?? server.config?.build?.assetsDir ?? DEFAULT_ASSETS_DIR}/${VINEXT_FONT_URL_NAMESPACE}/`;
			server.middlewares.use((req, res, next) => {
				const url = req.url;
				if (!url || !url.startsWith(urlPrefix)) return next();
				const rawPath = url.slice(urlPrefix.length).split("?")[0];
				let decoded;
				try {
					decoded = decodeURIComponent(rawPath);
				} catch {
					return next();
				}
				const filePath = path.resolve(cacheDir, decoded);
				if (filePath !== cacheDir && !filePath.startsWith(cacheDir + path.sep)) return next();
				fs.stat(filePath, (err, stat) => {
					if (err || !stat.isFile()) return next();
					const ext = path.extname(filePath).toLowerCase();
					res.setHeader("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
					res.setHeader("Cache-Control", "no-cache");
					res.setHeader("Access-Control-Allow-Origin", "*");
					fs.createReadStream(filePath).pipe(res);
				});
			});
		},
		transform: {
			filter: {
				id: { include: /\.(tsx?|jsx?|mjs)$/ },
				code: "next/font/google"
			},
			async handler(code, id) {
				if (id.startsWith("\0")) return null;
				if (!id.match(/\.(tsx?|jsx?|mjs)$/)) return null;
				if (!code.includes("next/font/google")) return null;
				if (id.startsWith(shimsDir)) return null;
				const transformAssetsDir = this.environment?.config?.build?.assetsDir ?? DEFAULT_ASSETS_DIR;
				const s = new MagicString(code);
				let hasChanges = false;
				let proxyImportCounter = 0;
				const overwrittenRanges = [];
				const fontLocals = /* @__PURE__ */ new Map();
				const proxyObjectLocals = /* @__PURE__ */ new Set();
				const importRe = /^[ \t]*import\s+((?:\{[^}]*?\}|[^;\n])+?)\s+from\s*(["'])next\/font\/google\2\s*;?/gm;
				let importMatch;
				while ((importMatch = importRe.exec(code)) !== null) {
					const [fullMatch, clause] = importMatch;
					const matchStart = importMatch.index;
					const matchEnd = matchStart + fullMatch.length;
					const parsed = parseGoogleFontImportClause(clause);
					const utilityImports = parsed.named.filter((spec) => !spec.isType && GOOGLE_FONT_UTILITY_EXPORTS.has(spec.imported));
					const fontImports = parsed.named.filter((spec) => !spec.isType && !GOOGLE_FONT_UTILITY_EXPORTS.has(spec.imported));
					if (parsed.defaultLocal) proxyObjectLocals.add(parsed.defaultLocal);
					for (const fontImport of fontImports) fontLocals.set(fontImport.local, fontImport.imported);
					if (fontImports.length > 0) {
						const virtualId = encodeGoogleFontsVirtualId({
							hasDefault: Boolean(parsed.defaultLocal),
							fonts: Array.from(new Set(fontImports.map((spec) => spec.imported))),
							utilities: Array.from(new Set(utilityImports.map((spec) => spec.imported)))
						});
						s.overwrite(matchStart, matchEnd, `import ${clause} from ${JSON.stringify(virtualId)};`);
						overwrittenRanges.push([matchStart, matchEnd]);
						hasChanges = true;
						continue;
					}
					if (parsed.namespaceLocal) {
						const proxyImportName = `__vinext_google_fonts_proxy_${proxyImportCounter++}`;
						const replacementLines = [`import ${proxyImportName} from ${JSON.stringify(fontGoogleShimPath)};`];
						if (parsed.defaultLocal) replacementLines.push(`var ${parsed.defaultLocal} = ${proxyImportName};`);
						replacementLines.push(`var ${parsed.namespaceLocal} = ${proxyImportName};`);
						s.overwrite(matchStart, matchEnd, replacementLines.join("\n"));
						overwrittenRanges.push([matchStart, matchEnd]);
						proxyObjectLocals.add(parsed.namespaceLocal);
						hasChanges = true;
					}
				}
				const exportRe = /^[ \t]*export\s*\{([^}]+)\}\s*from\s*(["'])next\/font\/google\2\s*;?/gm;
				let exportMatch;
				while ((exportMatch = exportRe.exec(code)) !== null) {
					const [fullMatch, specifiers] = exportMatch;
					const matchStart = exportMatch.index;
					const matchEnd = matchStart + fullMatch.length;
					const namedExports = parseGoogleFontNamedSpecifiers(specifiers);
					const utilityExports = namedExports.filter((spec) => !spec.isType && GOOGLE_FONT_UTILITY_EXPORTS.has(spec.imported));
					const fontExports = namedExports.filter((spec) => !spec.isType && !GOOGLE_FONT_UTILITY_EXPORTS.has(spec.imported));
					if (fontExports.length === 0) continue;
					const virtualId = encodeGoogleFontsVirtualId({
						hasDefault: false,
						fonts: Array.from(new Set(fontExports.map((spec) => spec.imported))),
						utilities: Array.from(new Set(utilityExports.map((spec) => spec.imported)))
					});
					s.overwrite(matchStart, matchEnd, `export { ${specifiers.trim()} } from ${JSON.stringify(virtualId)};`);
					overwrittenRanges.push([matchStart, matchEnd]);
					hasChanges = true;
				}
				async function injectSelfHostedCss(callStart, callEnd, optionsStr, family, calleeSource) {
					let options = {};
					try {
						const parsed = parseStaticObjectLiteral(optionsStr);
						if (!parsed) return;
						options = parsed;
					} catch {
						return;
					}
					let validated;
					try {
						validated = validateGoogleFontOptions(family, options);
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						throw new Error(`[vinext:google-fonts] ${id}: ${message}`);
					}
					const cssUrl = buildGoogleFontsUrl(family, getFontAxes(family, validated.weights, validated.styles, validated.selectedVariableAxes), validated.display);
					let localCSS = fontCache.get(cssUrl);
					if (!localCSS) try {
						localCSS = await fetchAndCacheFont(cssUrl, family, cacheDir);
						fontCache.set(cssUrl, localCSS);
					} catch (err) {
						if (err instanceof GoogleFontsHttpError) throw new Error(`[vinext:google-fonts] ${id}: Google Fonts returned HTTP ${err.status} for ${err.url}.\n${formatGoogleFontsErrorBody(err.responseBody)}`);
						return;
					}
					const servedCSS = _rewriteCachedFontCssToServedUrls(localCSS, cacheDir, transformAssetsDir);
					const preloadUrls = findFontFilesInCss(servedCSS, validated.preload ? validated.subsets : void 0).filter((file) => file.preloadFontFile).map((file) => file.googleFontFileUrl);
					const fallbackMetrics = validated.adjustFontFallback === false ? void 0 : getFallbackFontOverrideMetrics(family);
					const adjustedFallbackCSS = fallbackMetrics ? buildFallbackFontFace(family, fallbackMetrics) : void 0;
					const validatedFontWeight = validated.weights.length === 1 && validated.weights[0] !== "variable" ? Number(validated.weights[0]) : void 0;
					const validatedFontStyle = validated.styles.length === 1 ? validated.styles[0] : void 0;
					const internalFontProperties = [`selfHostedCSS: ${JSON.stringify(servedCSS)}`, `preloadUrls: ${JSON.stringify(preloadUrls)}`];
					if (adjustedFallbackCSS) internalFontProperties.push(`adjustedFallbackCSS: ${JSON.stringify(adjustedFallbackCSS)}`);
					if (Number.isFinite(validatedFontWeight)) internalFontProperties.push(`fontWeight: ${validatedFontWeight}`);
					if (validatedFontStyle) internalFontProperties.push(`fontStyle: ${JSON.stringify(validatedFontStyle)}`);
					const injectedProperties = [`_vinext: { font: { ${internalFontProperties.join(", ")} } }`];
					const closingBrace = optionsStr.lastIndexOf("}");
					const lastChar = lastSignificantChar(optionsStr.slice(0, closingBrace));
					const separator = lastChar === "{" || lastChar === "," ? "" : ", ";
					const replacement = `${calleeSource}(${optionsStr.slice(0, closingBrace) + separator + injectedProperties.join(", ") + optionsStr.slice(closingBrace)})`;
					s.overwrite(callStart, callEnd, replacement);
					overwrittenRanges.push([callStart, callEnd]);
					hasChanges = true;
				}
				const namedCallRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*(?=\{)/g;
				let namedCallMatch;
				while ((namedCallMatch = namedCallRe.exec(code)) !== null) {
					const [fullMatch, localName] = namedCallMatch;
					const importedName = fontLocals.get(localName);
					if (!importedName) continue;
					const callStart = namedCallMatch.index;
					const objRange = _findBalancedObject(code, callStart + fullMatch.length);
					if (!objRange) continue;
					const optionsStr = code.slice(objRange[0], objRange[1]);
					const callEnd = _findCallEnd(code, objRange[1]);
					if (callEnd === null) continue;
					if (overwrittenRanges.some(([start, end]) => callStart < end && callEnd > start)) continue;
					await injectSelfHostedCss(callStart, callEnd, optionsStr, importedName.replace(/_/g, " "), localName);
				}
				const memberCallRe = /\b([A-Za-z_$][A-Za-z0-9_$]*)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(\s*(?=\{)/g;
				let memberCallMatch;
				while ((memberCallMatch = memberCallRe.exec(code)) !== null) {
					const [fullMatch, objectName, propName] = memberCallMatch;
					if (!proxyObjectLocals.has(objectName)) continue;
					const callStart = memberCallMatch.index;
					const objRange = _findBalancedObject(code, callStart + fullMatch.length);
					if (!objRange) continue;
					const optionsStr = code.slice(objRange[0], objRange[1]);
					const callEnd = _findCallEnd(code, objRange[1]);
					if (callEnd === null) continue;
					if (overwrittenRanges.some(([start, end]) => callStart < end && callEnd > start)) continue;
					await injectSelfHostedCss(callStart, callEnd, optionsStr, propertyNameToGoogleFontFamily(propName), `${objectName}.${propName}`);
				}
				if (!hasChanges) return null;
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
				if (!cacheDir || !fs.existsSync(cacheDir)) return;
				const outDir = outputOptions.dir;
				if (!outDir) return;
				const assetsDir = this.environment.config?.build?.assetsDir ?? DEFAULT_ASSETS_DIR;
				const targetRoot = path.join(outDir, assetsDir, VINEXT_FONT_URL_NAMESPACE);
				const stack = [cacheDir];
				while (stack.length > 0) {
					const dir = stack.pop();
					if (!dir) continue;
					for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
						const src = path.join(dir, entry.name);
						if (entry.isDirectory()) {
							stack.push(src);
							continue;
						}
						if (!/\.(woff2?|ttf|otf|eot)$/i.test(entry.name)) continue;
						const relative = path.relative(cacheDir, src);
						const dest = path.join(targetRoot, relative);
						fs.mkdirSync(path.dirname(dest), { recursive: true });
						fs.copyFileSync(src, dest);
					}
				}
			}
		}
	};
}
/**
* Create the `vinext:local-fonts` Vite plugin.
*
* Rewrites relative font file paths in `next/font/local` calls into Vite
* asset import references so that both dev (/@fs/...) and prod
* (/assets/font-xxx.woff2) URLs resolve correctly.
*
* @param shimsDir - Absolute path to the shims directory (with trailing
*   separator). Used to skip vinext's own shim files from transform — they
*   contain example `next/font/local` paths in comments that must not be
*   rewritten. A precise prefix check is required (rather than a loose
*   substring match) because, now that `node_modules` is no longer excluded,
*   the guard runs against arbitrary third-party package paths — some of
*   which may legitimately contain the substring `font-local` (e.g. a
*   package named `font-local-loader`) and must still be transformed. This
*   mirrors `createGoogleFontsPlugin`, which takes `shimsDir` for the same
*   reason.
*/
function createLocalFontsPlugin(shimsDir) {
	return {
		name: "vinext:local-fonts",
		enforce: "pre",
		transform: {
			filter: {
				id: { include: /\.(tsx?|jsx?|mjs)$/ },
				code: "next/font/local"
			},
			handler(code, id) {
				if (id.startsWith("\0")) return null;
				if (!id.match(/\.(tsx?|jsx?|mjs)$/)) return null;
				if (!code.includes("next/font/local")) return null;
				if (id.startsWith(shimsDir)) return null;
				const importMatch = /\bimport\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*(['"])next\/font\/local\2/.exec(code);
				if (!importMatch) return null;
				const localFontIdentifier = importMatch[1];
				const s = new MagicString(code);
				let hasChanges = false;
				let fontImportCounter = 0;
				const imports = [];
				const fontPathRe = /((?:path|src)\s*:\s*)(['"])([^'"]+\.(?:woff2?|ttf|otf|eot))\2/g;
				let match;
				while ((match = fontPathRe.exec(code)) !== null) {
					const [fullMatch, prefix, _quote, fontPath] = match;
					const varName = `__vinext_local_font_${fontImportCounter++}`;
					imports.push(`import ${varName} from ${JSON.stringify(fontPath)};`);
					const matchStart = match.index;
					const matchEnd = matchStart + fullMatch.length;
					s.overwrite(matchStart, matchEnd, `${prefix}${varName}`);
					hasChanges = true;
				}
				const localFontCallRe = new RegExp(String.raw`(?:^|[;{}\n])\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*${escapeRegExp(localFontIdentifier)}\s*\(\s*(?=\{)`, "g");
				const familyPayloadInsertions = /* @__PURE__ */ new Set();
				let localFontCallMatch;
				while ((localFontCallMatch = localFontCallRe.exec(code)) !== null) {
					const bindingName = localFontCallMatch[1];
					const objRange = _findBalancedObject(code, localFontCallRe.lastIndex);
					if (!objRange) continue;
					if (_findCallEnd(code, objRange[1]) === null) continue;
					const insertAt = objRange[1] - 1;
					if (familyPayloadInsertions.has(insertAt)) continue;
					const optionsStr = code.slice(objRange[0], objRange[1]);
					if (/(?:^|[,{])\s*_vinext\s*:/.test(optionsStr)) continue;
					const lastChar = lastSignificantChar(optionsStr.slice(0, -1));
					const separator = lastChar === "{" || lastChar === "," ? "" : ", ";
					s.appendLeft(insertAt, `${separator}_vinext: { font: { family: ${JSON.stringify(bindingName)} } }`);
					familyPayloadInsertions.add(insertAt);
					hasChanges = true;
				}
				if (!hasChanges) return null;
				if (imports.length > 0) s.prepend(imports.join("\n") + "\n");
				return {
					code: s.toString(),
					map: s.generateMap({ hires: "boundary" })
				};
			}
		}
	};
}
//#endregion
export { RESOLVED_VIRTUAL_GOOGLE_FONTS, VIRTUAL_GOOGLE_FONTS, _findBalancedObject, _findCallEnd, _rewriteCachedFontCssToServedUrls, createGoogleFontsPlugin, createLocalFontsPlugin, generateGoogleFontsVirtualModule, parseStaticObjectLiteral };
