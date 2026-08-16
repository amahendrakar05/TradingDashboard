import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { createValidFileMatcher, findFileWithExtensions } from "../routing/file-matcher.js";
import { VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER } from "../utils/protocol-headers.js";
import { VINEXT_PRERENDER_CACHE_LIFE_HEADER } from "../server/headers.js";
import { classifyAppRoute, classifyPagesRoute, getAppRouteRenderEntryPath } from "./report.js";
import { NoOpCacheHandler, getCacheHandler, setCacheHandler } from "../shims/cache-handler.js";
import { headersContextFromRequest, runWithHeadersContext } from "../shims/headers.js";
import { _consumeRequestScopedCacheLife } from "../shims/cache-request-state.js";
import { normalizeStaticPathsEntry } from "../routing/route-pattern.js";
import { BLOCKED_PAGES } from "../shims/constants.js";
import { buildPregeneratedConcretePathTable } from "../server/prerender-manifest.js";
import { concatUint8Arrays, decodeRscEmbeddedChunk } from "../server/app-rsc-embedded-chunks.js";
import { navigationRuntimeRscBootstrapExpression } from "../server/app-ssr-stream.js";
import { encodePrerenderRouteParams, serializePrerenderRouteParamsHeader } from "../server/prerender-route-params.js";
import { readPrerenderSecret } from "./server-manifest.js";
import { createAppPprFallbackShells, markAppPprDynamicFallbackShellHtml } from "../server/app-ppr-fallback-shell.js";
import { getOutputPath, getRscOutputPath } from "../utils/prerender-output-paths.js";
import { startProdServer } from "../server/prod-server.js";
import { prerenderPoolAvailable, resolvePrerenderPoolSize, startPrerenderServerPool } from "./prerender-server-pool.js";
import fs from "node:fs";
import os from "node:os";
//#region src/build/prerender.ts
/**
* Prerendering phase for vinext build.
*
* Classifies every route, renders static and ISR routes to HTML/JSON/RSC files,
* and writes a `vinext-prerender.json` build index.
*
* Two public functions:
*   prerenderPages()  — Pages Router
*   prerenderApp()    — App Router
*
* Both return a `PrerenderResult` with one entry per route. The caller
* (cli.ts) can merge these into the build report.
*
* Modes:
*   'default'  — skips SSR routes (served at request time); ISR routes rendered
*   'export'   — SSR routes are build errors; ISR treated as static (no revalidate)
*/
const EXPERIMENTAL_PPR_FALLBACK_SHELLS_ENV = "__VINEXT_EXPERIMENTAL_PPR_FALLBACK_SHELLS";
function isExperimentalPprFallbackShellGenerationEnabled(env = process.env) {
	return env[EXPERIMENTAL_PPR_FALLBACK_SHELLS_ENV] === "1";
}
function getErrorMessageWithStack(err) {
	return err.stack || err.message;
}
async function startOptionalPrerenderServerPool(outDir, poolSize) {
	try {
		return await startPrerenderServerPool(outDir, poolSize);
	} catch (e) {
		console.warn(`[vinext] prerender render pool failed to start; falling back to single-process render: ${e instanceof Error ? e.message : String(e)}`);
		return null;
	}
}
var PrerenderUserFunctionError = class extends Error {};
function parsePrerenderEndpointError(text) {
	try {
		const parsed = JSON.parse(text);
		if (parsed && typeof parsed === "object" && "error" in parsed) return typeof parsed.error === "string" && parsed.error.length > 0 ? parsed.error : "Unknown prerender endpoint error";
	} catch {}
	return text || "Unknown prerender endpoint error";
}
/** Sentinel path used to trigger 404 rendering without a real route match. */
const NOT_FOUND_SENTINEL_PATH = "/__vinext_nonexistent_for_404__";
const DEFAULT_CONCURRENCY = Math.min(os.availableParallelism(), 8);
const RSC_LEGACY_CHUNK_SCRIPT_PREFIX = "self.__VINEXT_RSC_CHUNKS__=self.__VINEXT_RSC_CHUNKS__||[];";
const RSC_LEGACY_DONE_SCRIPT = "self.__VINEXT_RSC_DONE__=true";
const RSC_LEGACY_CHUNK_FULL_PREFIX = `${RSC_LEGACY_CHUNK_SCRIPT_PREFIX}self.__VINEXT_RSC_CHUNKS__.push(`;
const RSC_RUNTIME_BOOTSTRAP_EXPRESSION = navigationRuntimeRscBootstrapExpression();
const RSC_RUNTIME_CHUNK_FULL_PREFIX = `${RSC_RUNTIME_BOOTSTRAP_EXPRESSION}.rsc.push(`;
const RSC_RUNTIME_DONE_SCRIPT = `${RSC_RUNTIME_BOOTSTRAP_EXPRESSION}.done=true`;
/**
* Reconstruct the RSC payload from a prerender HTML response by parsing the
* inline bootstrap chunk scripts emitted by createRscEmbedTransform.
*
* Returns null when the HTML contains no chunk scripts at all — the caller
* should fall back to a second handler invocation. This is reachable when
* middleware short-circuits the App Router pipeline with a custom 200 HTML
* response that never went through createRscEmbedTransform.
*
* Throws on partial or malformed embeds (chunks present but no done marker,
* tampered chunk JSON, etc.) — those are real vinext-internal regressions.
*
* Safe regex usage: safeJsonStringify (used by createRscEmbedTransform) escapes
* all '<' and '>' in the embedded JSON, preventing false <\/script> matches.
*/
function extractRscPayloadFromPrerenderedHtml(html) {
	const scriptPattern = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
	const chunks = [];
	let sawDone = false;
	let match;
	while ((match = scriptPattern.exec(html)) !== null) {
		const script = (match[1] ?? "").trim().replace(/;$/, "");
		if (script === RSC_RUNTIME_DONE_SCRIPT || script === RSC_LEGACY_DONE_SCRIPT || script.endsWith(`;${RSC_RUNTIME_DONE_SCRIPT}`)) {
			sawDone = true;
			continue;
		}
		if (script.startsWith(RSC_RUNTIME_CHUNK_FULL_PREFIX)) {
			chunks.push(decodeRscEmbeddedChunk(parseRscChunkPushArgument(script, RSC_RUNTIME_CHUNK_FULL_PREFIX)));
			continue;
		}
		if (script.startsWith(RSC_LEGACY_CHUNK_SCRIPT_PREFIX)) chunks.push(decodeRscEmbeddedChunk(parseRscChunkPushArgument(script, RSC_LEGACY_CHUNK_FULL_PREFIX)));
	}
	if (chunks.length === 0 && !sawDone) return null;
	if (chunks.length === 0) throw new Error("[vinext] Malformed prerender RSC embed: done marker present without chunk scripts");
	if (!sawDone) throw new Error("[vinext] Malformed prerender RSC embed: missing RSC done marker");
	return concatUint8Arrays(chunks);
}
/**
* Parse the JSON argument of a single chunk-push script. The script
* shape is exactly `<prefix>(<safeJsonStringify(chunk)>)` because the writer
* concatenates those literals — so the body always starts with the full
* prefix and ends with `)`. JSON.parse on the slice catches any tampering or
* trailing code.
*/
function parseRscChunkPushArgument(script, chunkPrefix) {
	if (!script.startsWith(chunkPrefix) || !script.endsWith(")")) throw new Error("[vinext] Malformed prerender RSC embed: unexpected chunk script shape");
	const jsonSource = script.slice(chunkPrefix.length, -1);
	let parsed;
	try {
		parsed = JSON.parse(jsonSource);
	} catch {
		throw new Error("[vinext] Malformed prerender RSC embed: invalid chunk JSON");
	}
	if (typeof parsed === "string") return parsed;
	if (Array.isArray(parsed) && parsed.length === 2 && parsed[0] === 3 && typeof parsed[1] === "string") return [parsed[0], parsed[1]];
	throw new Error("[vinext] Malformed prerender RSC embed: unsupported chunk payload");
}
/**
* Run an array of async tasks with bounded concurrency.
* Results are returned in the same order as `items`.
*/
async function runWithConcurrency(items, concurrency, fn) {
	const results = Array.from({ length: items.length });
	let nextIndex = 0;
	async function worker() {
		while (nextIndex < items.length) {
			const i = nextIndex++;
			results[i] = await fn(items[i], i);
		}
	}
	if (items.length === 0) return results;
	const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
	await Promise.all(workers);
	return results;
}
/**
* Build a URL path from a route pattern and params.
* "/posts/:id" + { id: "42" } → "/posts/42"
* "/docs/:slug+" + { slug: ["a", "b"] } → "/docs/a/b"
*
* Throws a descriptive error rather than a cryptic `Cannot read properties of
* undefined` if `params` itself is missing or required keys are absent — the
* caller (prerenderPages / prerenderApp) catches this and surfaces it as a
* per-route error result.
*/
function buildUrlFromParams(pattern, params) {
	if (params === void 0 || params === null) throw new Error(`[vinext] buildUrlFromParams: params is ${params === null ? "null" : "undefined"} for pattern "${pattern}". Check that getStaticPaths / generateStaticParams returned an object with a "params" key, or pass a string path (see https://nextjs.org/docs/pages/api-reference/functions/get-static-paths).`);
	const parts = pattern.split("/").filter(Boolean);
	const result = [];
	for (const part of parts) if (part.endsWith("+") || part.endsWith("*")) {
		const value = params[part.slice(1, -1)];
		if (Array.isArray(value)) result.push(...value.map((s) => encodeURIComponent(s)));
		else if (value) result.push(encodeURIComponent(String(value)));
	} else if (part.startsWith(":")) {
		const paramName = part.slice(1);
		const value = params[paramName];
		if (value === void 0 || value === null) throw new Error(`[vinext] buildUrlFromParams: required param "${paramName}" is missing for pattern "${pattern}". Check that generateStaticParams (or getStaticPaths) returns an object with a "${paramName}" key.`);
		result.push(encodeURIComponent(String(value)));
	} else result.push(part);
	return "/" + result.join("/");
}
function metadataOutputPath(servedUrl) {
	const pathname = servedUrl.split("?", 1)[0];
	if (!pathname || !pathname.startsWith("/")) return null;
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) return null;
	return segments.join("/");
}
function emitStaticMetadataFiles(metadataRoutes, outDir) {
	const outputFiles = [];
	for (const route of metadataRoutes) {
		if (route.isDynamic) continue;
		const outputPath = metadataOutputPath(route.servedUrl);
		if (!outputPath) continue;
		const fullPath = path.join(outDir, ...outputPath.split("/"));
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.copyFileSync(route.filePath, fullPath);
		outputFiles.push(outputPath);
	}
	return outputFiles;
}
/**
* Resolve parent dynamic segment params for a route.
* Handles top-down generateStaticParams resolution for nested dynamic routes.
*
* Uses the `staticParamsMap` (pattern → generateStaticParams) exported from
* the production bundle.
*/
async function resolveParentParams(childRoute, staticParamsMap) {
	const { patternParts } = childRoute;
	let lastDynamicIdx = -1;
	for (let i = patternParts.length - 1; i >= 0; i--) if (patternParts[i].startsWith(":")) {
		lastDynamicIdx = i;
		break;
	}
	const parentSegments = [];
	let prefixPattern = "";
	for (let i = 0; i < lastDynamicIdx; i++) {
		const part = patternParts[i];
		prefixPattern += "/" + part;
		if (!part.startsWith(":")) continue;
		const fn = staticParamsMap[prefixPattern];
		if (typeof fn === "function") parentSegments.push(fn);
	}
	if (parentSegments.length === 0) return [];
	let currentParams = [{}];
	let resolvedAnyParent = false;
	for (const generateStaticParams of parentSegments) {
		const nextParams = [];
		let resolvedThisParent = false;
		for (const parentParams of currentParams) {
			const results = await generateStaticParams({ params: parentParams });
			if (results === null) continue;
			if (!Array.isArray(results)) return [];
			resolvedThisParent = true;
			resolvedAnyParent = true;
			for (const result of results) nextParams.push({
				...parentParams,
				...result
			});
		}
		if (resolvedThisParent) currentParams = nextParams;
	}
	return resolvedAnyParent ? currentParams : [];
}
/**
* Run the prerender phase for Pages Router.
*
* Rendering is done via HTTP through a locally-spawned production server.
* Works for both plain Node and Cloudflare Workers builds.
* Route classification uses static file analysis (classifyPagesRoute);
* getStaticPaths is fetched via a dedicated
* `/__vinext/prerender/pages-static-paths?pattern=…` endpoint on the server.
*
* Returns structured results for every route (rendered, skipped, or error).
* Writes HTML files to `outDir`. If `manifestDir` is set, writes
* `vinext-prerender.json` there; otherwise writes it to `outDir`.
*/
async function prerenderPages({ routes, apiRoutes, pagesDir, outDir, config, mode, ...options }) {
	const pagesBundlePath = options.pagesBundlePath;
	const manifestDir = options.manifestDir ?? outDir;
	const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
	const onProgress = options.onProgress;
	const skipManifest = options.skipManifest ?? false;
	const fileMatcher = createValidFileMatcher(config.pageExtensions);
	const results = [];
	if (!pagesBundlePath && !options._prodServer) throw new Error("[vinext] prerenderPages: either pagesBundlePath or _prodServer must be provided.");
	fs.mkdirSync(outDir, { recursive: true });
	for (const apiRoute of apiRoutes) results.push({
		route: apiRoute.pattern,
		status: "skipped",
		reason: "api"
	});
	const previousHandler = getCacheHandler();
	setCacheHandler(new NoOpCacheHandler());
	const previousPrerenderFlag = process.env.VINEXT_PRERENDER;
	process.env.VINEXT_PRERENDER = "1";
	let ownedProdServerHandle = null;
	let renderPool = null;
	try {
		let prerenderSecret = options._prerenderSecret;
		if (!prerenderSecret && pagesBundlePath) prerenderSecret = readPrerenderSecret(path.dirname(pagesBundlePath));
		if (!prerenderSecret) console.warn("[vinext] Warning: prerender secret not found. /__vinext/prerender/* endpoints will return 403 and dynamic routes will produce no paths. Run `vinext build` to regenerate the secret.");
		const prodServer = options._prodServer ? options._prodServer : await (async () => {
			const srv = await startProdServer({
				port: 0,
				host: "127.0.0.1",
				outDir: path.dirname(path.dirname(pagesBundlePath)),
				noCompression: true,
				purpose: "prerender"
			});
			ownedProdServerHandle = srv;
			return srv;
		})();
		const baseUrl = `http://127.0.0.1:${prodServer.port}`;
		const secretHeaders = prerenderSecret ? { [VINEXT_PRERENDER_SECRET_HEADER]: prerenderSecret } : {};
		let renderPorts = [prodServer.port];
		let renderRoundRobin = 0;
		const renderPage = (urlPath) => {
			const port = renderPorts[renderRoundRobin++ % renderPorts.length];
			return fetch(`http://127.0.0.1:${port}${urlPath}`, {
				headers: secretHeaders,
				redirect: "manual"
			});
		};
		const bundlePageRoutes = routes.map((r) => ({
			pattern: r.pattern,
			isDynamic: r.isDynamic ?? false,
			params: {},
			filePath: r.filePath,
			module: { getStaticPaths: r.isDynamic ? async ({ locales, defaultLocale }) => {
				const search = new URLSearchParams({ pattern: r.pattern });
				if (locales.length > 0) search.set("locales", JSON.stringify(locales));
				if (defaultLocale) search.set("defaultLocale", defaultLocale);
				const res = await fetch(`${baseUrl}/__vinext/prerender/pages-static-paths?${search}`, { headers: secretHeaders });
				const text = await res.text();
				if (!res.ok) {
					if (res.status === 500) throw new PrerenderUserFunctionError(parsePrerenderEndpointError(text));
					console.warn(`[vinext] Warning: /__vinext/prerender/pages-static-paths returned ${res.status} for ${r.pattern}. Dynamic paths will be skipped. This may indicate a stale or missing prerender secret.`);
					return {
						paths: [],
						fallback: false
					};
				}
				if (text === "null") return {
					paths: [],
					fallback: false
				};
				return JSON.parse(text);
			} : void 0 }
		}));
		const pagesToRender = [];
		for (const route of bundlePageRoutes) {
			if (BLOCKED_PAGES.includes(route.pattern)) continue;
			if (route.pattern === "/404") continue;
			const { type, revalidate: classifiedRevalidate } = classifyPagesRoute(route.filePath);
			if (type === "ssr") {
				if (mode === "export") results.push({
					route: route.pattern,
					status: "error",
					error: `Page uses getServerSideProps which is not supported with output: 'export'. Use getStaticProps instead.`
				});
				else results.push({
					route: route.pattern,
					status: "skipped",
					reason: "ssr"
				});
				continue;
			}
			const revalidate = mode === "export" ? false : typeof classifiedRevalidate === "number" ? classifiedRevalidate : false;
			if (route.isDynamic) {
				if (typeof route.module.getStaticPaths !== "function") {
					if (mode === "export") results.push({
						route: route.pattern,
						status: "error",
						error: `Dynamic route requires getStaticPaths with output: 'export'`
					});
					else results.push({
						route: route.pattern,
						status: "skipped",
						reason: "no-static-params"
					});
					continue;
				}
				let pathsResult;
				try {
					pathsResult = await route.module.getStaticPaths({
						locales: [],
						defaultLocale: ""
					});
				} catch (e) {
					results.push({
						route: route.pattern,
						status: "error",
						error: `Failed to call getStaticPaths(): ${e.message}`,
						...e instanceof PrerenderUserFunctionError ? { fatal: true } : {}
					});
					continue;
				}
				const fallback = pathsResult?.fallback ?? false;
				if (mode === "export" && fallback !== false) {
					results.push({
						route: route.pattern,
						status: "error",
						error: `getStaticPaths must return fallback: false with output: 'export' (got: ${JSON.stringify(fallback)})`
					});
					continue;
				}
				const paths = pathsResult?.paths ?? [];
				let entryError = null;
				for (const item of paths) {
					const normalized = normalizeStaticPathsEntry(item, route.pattern);
					if ("error" in normalized) {
						entryError = normalized.error;
						break;
					}
					const { params } = normalized;
					try {
						const urlPath = buildUrlFromParams(route.pattern, params);
						pagesToRender.push({
							route,
							urlPath,
							params,
							revalidate
						});
					} catch (e) {
						entryError = e.message;
						break;
					}
				}
				if (entryError) {
					results.push({
						route: route.pattern,
						status: "error",
						error: entryError
					});
					continue;
				}
			} else pagesToRender.push({
				route,
				urlPath: route.pattern,
				params: {},
				revalidate
			});
		}
		if (!options._prodServer && pagesBundlePath && prerenderPoolAvailable()) {
			const poolSize = resolvePrerenderPoolSize(pagesToRender.length, concurrency);
			if (poolSize > 1) {
				renderPool = await startOptionalPrerenderServerPool(path.dirname(path.dirname(pagesBundlePath)), poolSize);
				if (renderPool) renderPorts = renderPool.ports;
			}
		}
		let completed = 0;
		const pageResults = await runWithConcurrency(pagesToRender, concurrency, async ({ route, urlPath, revalidate }) => {
			let result;
			try {
				const response = await renderPage(urlPath);
				const outputFiles = [];
				const htmlOutputPath = getOutputPath(urlPath, config.trailingSlash);
				const htmlFullPath = path.join(outDir, htmlOutputPath);
				if (response.status >= 300 && response.status < 400) {
					const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${(response.headers.get("location") ?? "/").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" /></head><body></body></html>`;
					fs.mkdirSync(path.dirname(htmlFullPath), { recursive: true });
					fs.writeFileSync(htmlFullPath, html, "utf-8");
					outputFiles.push(htmlOutputPath);
				} else {
					if (!response.ok) throw new Error(`renderPage returned ${response.status} for ${urlPath}`);
					const html = await response.text();
					fs.mkdirSync(path.dirname(htmlFullPath), { recursive: true });
					fs.writeFileSync(htmlFullPath, html, "utf-8");
					outputFiles.push(htmlOutputPath);
				}
				result = {
					route: route.pattern,
					status: "rendered",
					outputFiles,
					revalidate,
					...typeof revalidate === "number" ? { expire: config.expireTime } : {},
					router: "pages",
					...urlPath !== route.pattern ? { path: urlPath } : {}
				};
			} catch (e) {
				renderPool?.recordRenderError(e);
				const err = e;
				result = {
					route: route.pattern,
					status: "error",
					error: config.enablePrerenderSourceMaps ? getErrorMessageWithStack(err) : err.message
				};
			}
			onProgress?.({
				completed: ++completed,
				total: pagesToRender.length,
				route: urlPath,
				status: result.status
			});
			return result;
		});
		results.push(...pageResults);
		renderPool?.assertHealthy();
		const hasCustom404 = findFileWithExtensions(path.join(pagesDir, "404"), fileMatcher);
		const hasErrorPage = findFileWithExtensions(path.join(pagesDir, "_error"), fileMatcher);
		if (hasCustom404 || hasErrorPage) try {
			const notFoundRes = await renderPage(hasCustom404 ? "/404" : NOT_FOUND_SENTINEL_PATH);
			const contentType = notFoundRes.headers.get("content-type") ?? "";
			if (notFoundRes.status === 404 && contentType.includes("text/html")) {
				const html404 = await notFoundRes.text();
				const fullPath = path.join(outDir, "404.html");
				fs.writeFileSync(fullPath, html404, "utf-8");
				results.push({
					route: "/404",
					status: "rendered",
					outputFiles: ["404.html"],
					revalidate: false,
					router: "pages"
				});
			}
		} catch (e) {
			renderPool?.recordRenderError(e);
		}
		renderPool?.assertHealthy();
		if (!skipManifest) writePrerenderIndex(results, manifestDir, {
			buildId: config.buildId,
			trailingSlash: config.trailingSlash
		});
		return { routes: results };
	} finally {
		if (renderPool) await renderPool.close();
		setCacheHandler(previousHandler);
		if (previousPrerenderFlag === void 0) delete process.env.VINEXT_PRERENDER;
		else process.env.VINEXT_PRERENDER = previousPrerenderFlag;
		if (ownedProdServerHandle) await new Promise((resolve) => ownedProdServerHandle.server.close(() => resolve()));
	}
}
/**
* Run the prerender phase for App Router.
*
* Starts a local production server and fetches every static/ISR route via HTTP.
* Works for both plain Node and Cloudflare Workers builds — the CF Workers bundle
* (`dist/server/index.js`) is a standard Node-compatible server entry, so no
* wrangler/miniflare is needed. Writes HTML files, `.rsc` files, and
* `vinext-prerender.json` to `outDir`.
*
* If the bundle does not exist, an error is thrown directing the user to run
* `vinext build` first.
*
* Speculative static rendering: routes classified as 'unknown' (no explicit
* config, non-dynamic URL) are attempted with an empty headers/cookies context.
* If they succeed, they are marked as rendered. If they throw a DynamicUsageError
* or fail, they are marked as skipped with reason 'dynamic'.
*/
async function prerenderApp({ routes, metadataRoutes = [], outDir, config, mode, rscBundlePath, ...options }) {
	const manifestDir = options.manifestDir ?? outDir;
	const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
	const onProgress = options.onProgress;
	const skipManifest = options.skipManifest ?? false;
	const results = [];
	fs.mkdirSync(outDir, { recursive: true });
	const previousHandler = getCacheHandler();
	setCacheHandler(new NoOpCacheHandler());
	const previousPrerenderFlag = process.env.VINEXT_PRERENDER;
	process.env.VINEXT_PRERENDER = "1";
	const serverDir = path.dirname(rscBundlePath);
	let rscHandler;
	let staticParamsMap = {};
	let ownedProdServerHandle = null;
	let renderPool = null;
	let renderPorts = [];
	let renderRoundRobin = 0;
	try {
		const prerenderSecret = readPrerenderSecret(serverDir);
		if (!prerenderSecret) console.warn("[vinext] Warning: prerender secret not found. /__vinext/prerender/* endpoints will return 403 and generateStaticParams will not be called. Run `vinext build` to regenerate the secret.");
		const prodServer = options._prodServer ? options._prodServer : await (async () => {
			const srv = await startProdServer({
				port: 0,
				host: "127.0.0.1",
				outDir: path.dirname(serverDir),
				noCompression: true,
				purpose: "prerender"
			});
			ownedProdServerHandle = srv;
			return srv;
		})();
		const baseUrl = `http://127.0.0.1:${prodServer.port}`;
		renderPorts = [prodServer.port];
		const secretHeaders = prerenderSecret ? { [VINEXT_PRERENDER_SECRET_HEADER]: prerenderSecret } : {};
		rscHandler = (req) => {
			const parsed = new URL(req.url);
			const url = `http://127.0.0.1:${renderPorts[renderRoundRobin++ % renderPorts.length]}${parsed.pathname}${parsed.search}`;
			return fetch(url, {
				method: req.method,
				headers: {
					...secretHeaders,
					...Object.fromEntries(req.headers.entries())
				},
				body: req.method !== "GET" && req.method !== "HEAD" ? req.body : void 0,
				redirect: "manual"
			});
		};
		const staticParamsCache = /* @__PURE__ */ new Map();
		staticParamsMap = new Proxy({}, {
			get(_target, pattern) {
				return async ({ params }) => {
					const cacheKey = `${pattern}\0${JSON.stringify(params)}`;
					const cached = staticParamsCache.get(cacheKey);
					if (cached !== void 0) return cached;
					const request = (async () => {
						const search = new URLSearchParams({ pattern });
						if (Object.keys(params).length > 0) search.set("parentParams", JSON.stringify(params));
						const res = await fetch(`${baseUrl}/__vinext/prerender/static-params?${search}`, { headers: secretHeaders });
						const text = await res.text();
						if (!res.ok) {
							if (res.status === 500) throw new PrerenderUserFunctionError(parsePrerenderEndpointError(text));
							console.warn(`[vinext] Warning: /__vinext/prerender/static-params returned ${res.status} for ${pattern}. Static params will be skipped. This may indicate a stale or missing prerender secret.`);
							return null;
						}
						if (text === "null") return null;
						return JSON.parse(text);
					})();
					request.catch(() => staticParamsCache.delete(cacheKey));
					staticParamsCache.set(cacheKey, request);
					return request;
				};
			},
			has(_target, _pattern) {
				return false;
			}
		});
		const urlsToRender = [];
		for (const route of routes) {
			const renderEntryPath = getAppRouteRenderEntryPath(route);
			if (!renderEntryPath && route.routePath) {
				results.push({
					route: route.pattern,
					status: "skipped",
					reason: "api"
				});
				continue;
			}
			if (!renderEntryPath) continue;
			const { type, revalidate: classifiedRevalidate } = classifyAppRoute(renderEntryPath, route.routePath, route.isDynamic);
			if (type === "api") {
				results.push({
					route: route.pattern,
					status: "skipped",
					reason: "api"
				});
				continue;
			}
			if (type === "ssr" && !route.isDynamic) {
				if (mode === "export") results.push({
					route: route.pattern,
					status: "error",
					error: `Route uses dynamic rendering (force-dynamic or revalidate=0) which is not supported with output: 'export'`
				});
				else results.push({
					route: route.pattern,
					status: "skipped",
					reason: "dynamic"
				});
				continue;
			}
			const revalidate = mode === "export" ? false : typeof classifiedRevalidate === "number" ? classifiedRevalidate : false;
			if (route.isDynamic) try {
				const generateStaticParamsFn = staticParamsMap[route.pattern];
				if (typeof generateStaticParamsFn !== "function") {
					if (mode === "export") results.push({
						route: route.pattern,
						status: "error",
						error: `Dynamic route requires generateStaticParams() with output: 'export'`
					});
					else results.push({
						route: route.pattern,
						status: "skipped",
						reason: "no-static-params"
					});
					continue;
				}
				const parentParamSets = await resolveParentParams(route, staticParamsMap);
				let paramSets;
				if (parentParamSets.length > 0) {
					paramSets = [];
					for (const parentParams of parentParamSets) {
						const childResults = await generateStaticParamsFn({ params: parentParams });
						if (childResults === null) {
							paramSets = null;
							break;
						}
						if (Array.isArray(childResults)) for (const childParams of childResults) paramSets.push({
							...parentParams,
							...childParams
						});
						else {
							paramSets = [];
							break;
						}
					}
				} else {
					const results = await generateStaticParamsFn({ params: {} });
					paramSets = Array.isArray(results) || results === null ? results : [];
				}
				if (paramSets === null) {
					if (mode === "export") results.push({
						route: route.pattern,
						status: "error",
						error: `Dynamic route requires generateStaticParams() with output: 'export'`
					});
					else results.push({
						route: route.pattern,
						status: "skipped",
						reason: "no-static-params"
					});
					continue;
				}
				if (paramSets.length === 0) {
					results.push({
						route: route.pattern,
						status: "skipped",
						reason: "no-static-params"
					});
					continue;
				}
				const queuedRouteUrls = /* @__PURE__ */ new Set();
				for (const params of paramSets) {
					if (params === null || params === void 0) throw new Error(`generateStaticParams() for ${route.pattern} returned an entry with no params object.`);
					const urlPath = buildUrlFromParams(route.pattern, params);
					if (queuedRouteUrls.has(urlPath)) continue;
					queuedRouteUrls.add(urlPath);
					urlsToRender.push({
						urlPath,
						routePattern: route.pattern,
						prerenderRouteParams: encodePrerenderRouteParams(route.pattern, params),
						revalidate,
						isSpeculative: false
					});
					if (config.cacheComponents === true && isExperimentalPprFallbackShellGenerationEnabled()) for (const fallbackShell of createAppPprFallbackShells(route, params)) {
						if (queuedRouteUrls.has(fallbackShell.pathname)) continue;
						queuedRouteUrls.add(fallbackShell.pathname);
						urlsToRender.push({
							urlPath: fallbackShell.pathname,
							routePattern: route.pattern,
							prerenderRouteParams: encodePrerenderRouteParams(route.pattern, fallbackShell.params, fallbackShell.fallbackParamNames),
							revalidate,
							isSpeculative: false,
							isFallback: true
						});
					}
				}
			} catch (e) {
				const err = e;
				const detail = config.enablePrerenderSourceMaps ? getErrorMessageWithStack(err) : err.message;
				results.push({
					route: route.pattern,
					status: "error",
					error: `Failed to call generateStaticParams(): ${detail}`,
					...e instanceof PrerenderUserFunctionError ? { fatal: true } : {}
				});
			}
			else if (type === "unknown") urlsToRender.push({
				urlPath: route.pattern,
				routePattern: route.pattern,
				prerenderRouteParams: null,
				revalidate: false,
				isSpeculative: true
			});
			else urlsToRender.push({
				urlPath: route.pattern,
				routePattern: route.pattern,
				prerenderRouteParams: null,
				revalidate,
				isSpeculative: false
			});
		}
		/**
		* Render a single URL and return its result.
		* `onProgress` is intentionally not called here; the outer loop calls it
		* exactly once per URL after this function returns, keeping the callback
		* at a single, predictable call site.
		*/
		async function renderUrl({ urlPath, routePattern, prerenderRouteParams, revalidate, isSpeculative, isFallback }) {
			try {
				const prerenderRouteParamsHeader = serializePrerenderRouteParamsHeader(prerenderRouteParams);
				const htmlHeaders = new Headers();
				if (prerenderRouteParamsHeader !== null) htmlHeaders.set(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, prerenderRouteParamsHeader);
				if (isSpeculative) htmlHeaders.set(VINEXT_PRERENDER_SPECULATIVE_HEADER, "1");
				const htmlRequest = new Request(`http://localhost${urlPath}`, { headers: htmlHeaders });
				const htmlRender = await runWithHeadersContext(headersContextFromRequest(htmlRequest), async () => {
					const response = await rscHandler(htmlRequest);
					const cacheControl = response.headers.get("cache-control") ?? "";
					const linkHeader = response.headers.get("link");
					const responseCacheLife = readPrerenderCacheLifeHeader(response.headers);
					if (!response.ok || cacheControl.includes("no-store")) {
						await response.body?.cancel();
						return {
							cacheControl,
							linkHeader,
							html: null,
							ok: response.ok,
							requestCacheLife: null,
							status: response.status
						};
					}
					const html = await response.text();
					const processCacheLife = _consumeRequestScopedCacheLife();
					return {
						cacheControl,
						linkHeader,
						html,
						ok: true,
						requestCacheLife: responseCacheLife ?? processCacheLife,
						status: response.status
					};
				});
				const htmlCacheControl = htmlRender.cacheControl;
				if (!htmlRender.ok) {
					if (isSpeculative) return {
						route: routePattern,
						status: "skipped",
						reason: "dynamic"
					};
					return {
						route: routePattern,
						status: "error",
						error: `RSC handler returned ${htmlRender.status}`
					};
				}
				if (htmlCacheControl.includes("no-store")) return {
					route: routePattern,
					status: "skipped",
					reason: "dynamic"
				};
				if (htmlRender.html === null) return {
					route: routePattern,
					status: "error",
					error: "RSC handler returned no prerender HTML"
				};
				const html = isFallback ? markAppPprDynamicFallbackShellHtml(htmlRender.html) : htmlRender.html;
				let rscData = extractRscPayloadFromPrerenderedHtml(html);
				if (rscData === null) {
					const rscHeaders = new Headers({
						Accept: "text/x-component",
						RSC: "1"
					});
					if (prerenderRouteParamsHeader !== null) rscHeaders.set(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, prerenderRouteParamsHeader);
					if (isSpeculative) rscHeaders.set(VINEXT_PRERENDER_SPECULATIVE_HEADER, "1");
					const rscRequest = new Request(`http://localhost${urlPath}`, { headers: rscHeaders });
					const rscRes = await runWithHeadersContext(headersContextFromRequest(rscRequest), () => rscHandler(rscRequest));
					if (!rscRes.ok) {
						await rscRes.body?.cancel();
						throw new Error(`[vinext] prerenderApp: RSC fallback returned ${rscRes.status} for ${urlPath}`);
					}
					rscData = new Uint8Array(await rscRes.arrayBuffer());
				}
				const outputFiles = [];
				const htmlOutputPath = getOutputPath(urlPath, config.trailingSlash);
				const htmlFullPath = path.join(outDir, htmlOutputPath);
				fs.mkdirSync(path.dirname(htmlFullPath), { recursive: true });
				fs.writeFileSync(htmlFullPath, html, "utf-8");
				outputFiles.push(htmlOutputPath);
				const rscOutputPath = getRscOutputPath(urlPath);
				const rscFullPath = path.join(outDir, rscOutputPath);
				fs.mkdirSync(path.dirname(rscFullPath), { recursive: true });
				fs.writeFileSync(rscFullPath, rscData);
				outputFiles.push(rscOutputPath);
				const renderedCacheControl = resolveRenderedCacheControl(htmlRender.requestCacheLife ?? {}, htmlCacheControl, config.expireTime);
				const renderedRevalidate = typeof revalidate === "number" ? renderedCacheControl.revalidate === void 0 ? revalidate : Math.min(revalidate, renderedCacheControl.revalidate) : renderedCacheControl.revalidate ?? revalidate;
				return {
					route: routePattern,
					status: "rendered",
					outputFiles,
					revalidate: renderedRevalidate,
					...typeof renderedRevalidate === "number" ? { expire: renderedCacheControl.expire } : {},
					router: "app",
					...htmlRender.linkHeader ? { headers: { link: htmlRender.linkHeader } } : {},
					...urlPath !== routePattern ? { path: urlPath } : {},
					...isFallback ? { fallback: true } : {}
				};
			} catch (e) {
				renderPool?.recordRenderError(e);
				if (isSpeculative) return {
					route: routePattern,
					status: "skipped",
					reason: "dynamic"
				};
				const err = e;
				const base = config.enablePrerenderSourceMaps ? getErrorMessageWithStack(err) : err.message;
				return {
					route: routePattern,
					status: "error",
					error: err.digest ? `${base} (digest: ${err.digest})` : base
				};
			}
		}
		if (!options._prodServer && prerenderPoolAvailable()) {
			const poolSize = resolvePrerenderPoolSize(urlsToRender.length, concurrency);
			if (poolSize > 1) {
				renderPool = await startOptionalPrerenderServerPool(path.dirname(serverDir), poolSize);
				if (renderPool) renderPorts = renderPool.ports;
			}
		}
		let completedApp = 0;
		const appResults = await runWithConcurrency(urlsToRender, concurrency, async (urlToRender) => {
			const result = await renderUrl(urlToRender);
			onProgress?.({
				completed: ++completedApp,
				total: urlsToRender.length,
				route: urlToRender.urlPath,
				status: result.status
			});
			return result;
		});
		results.push(...appResults);
		renderPool?.assertHealthy();
		const outputFiles = mode === "export" && metadataRoutes.length > 0 ? emitStaticMetadataFiles(metadataRoutes, outDir) : [];
		try {
			const notFoundRequest = new Request(`http://localhost${NOT_FOUND_SENTINEL_PATH}`);
			const notFoundRes = await runWithHeadersContext(headersContextFromRequest(notFoundRequest), () => rscHandler(notFoundRequest));
			if (notFoundRes.status === 404) {
				const html404 = await notFoundRes.text();
				const fullPath = path.join(outDir, "404.html");
				fs.mkdirSync(path.dirname(fullPath), { recursive: true });
				fs.writeFileSync(fullPath, html404, "utf-8");
				results.push({
					route: "/404",
					status: "rendered",
					outputFiles: ["404.html"],
					revalidate: false,
					router: "app"
				});
			}
		} catch (e) {
			renderPool?.recordRenderError(e);
		}
		renderPool?.assertHealthy();
		if (!skipManifest) writePrerenderIndex(results, manifestDir, {
			buildId: config.buildId,
			trailingSlash: config.trailingSlash
		});
		return {
			routes: results,
			...outputFiles.length > 0 ? { outputFiles } : {}
		};
	} finally {
		if (renderPool) await renderPool.close();
		setCacheHandler(previousHandler);
		if (previousPrerenderFlag === void 0) delete process.env.VINEXT_PRERENDER;
		else process.env.VINEXT_PRERENDER = previousPrerenderFlag;
		if (ownedProdServerHandle) await new Promise((resolve) => ownedProdServerHandle.server.close(() => resolve()));
	}
}
function resolveRenderedCacheControl(requestCacheLife, cacheControl, fallbackExpireSeconds) {
	const sMaxage = parseCacheControlSeconds(cacheControl, "s-maxage");
	const staleWhileRevalidate = parseCacheControlSeconds(cacheControl, "stale-while-revalidate");
	const revalidate = requestCacheLife.revalidate ?? (staleWhileRevalidate === void 0 ? void 0 : sMaxage);
	return {
		expire: requestCacheLife.expire ?? resolveRenderedExpireSeconds({
			fallbackExpireSeconds,
			sMaxage,
			staleWhileRevalidate
		}),
		...revalidate === void 0 ? {} : { revalidate }
	};
}
function readPrerenderCacheLifeHeader(headers) {
	const value = headers.get(VINEXT_PRERENDER_CACHE_LIFE_HEADER);
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		const cacheLife = {};
		if (typeof parsed.revalidate === "number" && Number.isFinite(parsed.revalidate)) cacheLife.revalidate = parsed.revalidate;
		if (typeof parsed.expire === "number" && Number.isFinite(parsed.expire)) cacheLife.expire = parsed.expire;
		return cacheLife.revalidate === void 0 && cacheLife.expire === void 0 ? null : cacheLife;
	} catch {
		return null;
	}
}
function resolveRenderedExpireSeconds(options) {
	const { fallbackExpireSeconds, sMaxage, staleWhileRevalidate } = options;
	if (sMaxage === void 0 || staleWhileRevalidate === void 0) return fallbackExpireSeconds;
	return sMaxage + staleWhileRevalidate;
}
function parseCacheControlSeconds(cacheControl, directive) {
	for (const part of cacheControl.split(",")) {
		const [rawName, rawValue] = part.trim().split("=", 2);
		if (rawName.trim().toLowerCase() !== directive) continue;
		if (rawValue === void 0) return void 0;
		const value = Number(rawValue.trim());
		if (!Number.isFinite(value) || value < 0) return void 0;
		return value;
	}
}
/**
* Write `vinext-prerender.json` to `outDir`.
*
* Contains a flat list of route results used during testing and as a seed for
* ISR cache population at production startup. The `buildId` is included so
* the seeding function can construct matching cache keys.
*/
function writePrerenderIndex(routes, outDir, options) {
	const { buildId, trailingSlash } = options ?? {};
	const indexRoutes = routes.map((r) => {
		if (r.status === "rendered") return {
			route: r.route,
			status: r.status,
			revalidate: r.revalidate,
			...typeof r.revalidate === "number" ? { expire: r.expire } : {},
			router: r.router,
			...r.headers ? { headers: r.headers } : {},
			...r.path ? { path: r.path } : {},
			...r.fallback ? { fallback: true } : {}
		};
		if (r.status === "skipped") return {
			route: r.route,
			status: r.status,
			reason: r.reason
		};
		return {
			route: r.route,
			status: r.status,
			error: r.error
		};
	});
	const index = {
		...buildId ? { buildId } : {},
		...typeof trailingSlash === "boolean" ? { trailingSlash } : {},
		routes: indexRoutes,
		pregeneratedConcretePaths: buildPregeneratedConcretePathTable({ routes: indexRoutes })
	};
	fs.writeFileSync(path.join(outDir, "vinext-prerender.json"), JSON.stringify(index, null, 2), "utf-8");
}
//#endregion
export { buildUrlFromParams, extractRscPayloadFromPrerenderedHtml, prerenderApp, prerenderPages, readPrerenderSecret, resolveParentParams, writePrerenderIndex };
