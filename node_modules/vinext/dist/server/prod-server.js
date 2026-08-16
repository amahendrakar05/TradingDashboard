import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { normalizePathnameForRouteMatchStrict } from "../routing/utils.js";
import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER } from "../utils/protocol-headers.js";
import { VINEXT_STATIC_FILE_HEADER } from "./headers.js";
import { normalizePath } from "./normalize-path.js";
import { notFoundResponse } from "./http-error-responses.js";
import { isOpenRedirectShaped } from "./open-redirect.js";
import { canonicalizeRequestPathname, filterInternalHeaders } from "./request-pipeline.js";
import { isUnknownRecord } from "../utils/record.js";
import { buildNextDataNotFoundResponse, encodeUrlParserIgnoredCharacters, isNextDataPathname, normalizeNextDataPagePathname, parseNextDataPathname, urlParserCreatesPagesDataPath } from "./pages-data-route.js";
import { ASSET_PREFIX_URL_DIR, assetPrefixPathname, isAbsoluteAssetPrefix } from "../utils/asset-prefix.js";
import { setPagesClientAssets } from "./pages-client-assets.js";
import { resolveRequestHost, resolveRequestProtocol, trustProxy, trustedHosts } from "./proxy-trust.js";
import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, isImageOptimizationPath, isSafeImageContentType, parseImageParams } from "./image-optimization.js";
import { installSocketErrorBackstop } from "./socket-error-backstop.js";
import { CONTENT_TYPES, StaticFileCache, etagFromFilenameHash } from "./static-file-cache.js";
import { collectInlineCssManifest } from "../build/inline-css.js";
import { mergeHeaders } from "./worker-utils.js";
import { runPagesRequest, wrapMiddlewareWithBasePath } from "./pages-request-pipeline.js";
import { computeClientRuntimeMetadata } from "../utils/client-runtime-metadata.js";
import { readTrustedPrerenderRouteParamsFromHeaders, serializePrerenderRouteParamsHeader } from "./prerender-route-params.js";
import { readPrerenderSecret } from "../build/server-manifest.js";
import { seedMemoryCacheFromPrerender } from "./seed-cache.js";
import { negotiateEncoding, parseAcceptedEncodings, selectContentEncoding } from "./accept-encoding.js";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Readable, pipeline } from "node:stream";
import zlib from "node:zlib";
import { createServer } from "node:http";
//#region src/server/prod-server.ts
/**
* Production server for vinext.
*
* Serves the built output from `vinext build`. Handles:
* - Static asset serving from client build output
* - Pages Router: SSR rendering + API route handling
* - App Router: RSC/SSR rendering, route handlers, server actions
* - Zstd/Brotli/Gzip compression for text-based responses
* - Streaming SSR for App Router
*
* Build output for Pages Router:
* - dist/client/  — static assets (JS, CSS, images) + .vite/ssr-manifest.json
* - dist/server/entry.js — SSR entry point (virtual:vinext-server-entry)
*
* Build output for App Router:
* - dist/client/  — static assets (JS, CSS, images)
* - dist/server/index.js — RSC entry (default export: handler(Request) → Response)
* - dist/server/ssr/index.js — SSR entry (imported by RSC entry at runtime)
*/
/**
* mtime of the build each bare (query-less) server-entry URL was first
* imported from in this process. Node's ESM cache pins a bare URL to that
* build forever, so rebuilds to the same path must be detected and loaded
* through a cache-busted URL instead.
*/
const bareServerEntryMtimes = /* @__PURE__ */ new Map();
function resolveCanonicalServerEntry(entryPath) {
	let canonicalEntryPath;
	try {
		canonicalEntryPath = fs.realpathSync.native(entryPath);
	} catch {
		canonicalEntryPath = entryPath;
	}
	return {
		href: pathToFileURL(canonicalEntryPath).href,
		mtime: fs.statSync(canonicalEntryPath).mtimeMs
	};
}
/**
* Import a built server entry module (App Router RSC entry or Pages Router
* server entry) by absolute file path.
*
* The first import of a given path uses the plain file:// URL with NO query
* string. This is load-bearing: code-split builds emit lazy chunks that
* import the entry back by bare specifier (default Vite/Rolldown builds hoist
* modules shared between the entry's static graph and lazy route chunks into
* the entry chunk, which the chunks then import as e.g. "../../index.js").
* Node keys its ESM cache on the full URL including the query string, so if
* the server imported the entry as `index.js?t=<mtime>`, a chunk's bare
* back-import would evaluate the entire server bundle a second time and
* module-level singletons (db pools, service registries) would silently
* diverge between the two copies. See
* https://github.com/cloudflare/vinext/issues/1923.
*
* A `?t=<mtime>` query string is appended only when the same path is
* imported again after a rebuild (different mtime) — e.g. test suites that
* rebuild a fixture to the same output path within one process — where the
* bare URL's cache entry would return the stale previous build. Note this
* rebuild branch trades the single-instance guarantee back: chunks that
* import the entry by bare path still resolve to the FIRST build's cache
* entry, so freshness and single-instance only hold together on the first
* import of a path. Production processes import each entry path exactly
* once and always get both.
*
* The entry is imported via its canonical real path: the bundler
* canonicalizes module ids with fs.realpathSync.native, so chunks evaluate
* under realpath-based URLs and their relative imports resolve to realpath
* URLs too. Importing the entry through a symlinked path (macOS /var/...
* tmpdirs, symlinked deploy directories) would otherwise create a second
* instance keyed on the symlinked URL.
*
* Exported for direct unit testing of the URL choice.
*/
function resolveServerEntryImportUrl(entryPath) {
	const { href, mtime } = resolveCanonicalServerEntry(entryPath);
	const bareMtime = bareServerEntryMtimes.get(href);
	if (bareMtime === void 0 || bareMtime === mtime) {
		bareServerEntryMtimes.set(href, mtime);
		return href;
	}
	return `${href}?t=${mtime}`;
}
function rememberCurrentServerEntryImportMtime(entryPath) {
	const { href, mtime } = resolveCanonicalServerEntry(entryPath);
	bareServerEntryMtimes.set(href, mtime);
}
async function importServerEntryModule(entryPath) {
	return import(resolveServerEntryImportUrl(entryPath));
}
/** Convert a Node.js IncomingMessage into a ReadableStream for Web Request body. */
function readNodeStream(req) {
	let cancelled = false;
	let cleanup = () => {};
	return new ReadableStream({
		start(controller) {
			cleanup = () => {
				req.off("data", onData);
				req.off("end", onEnd);
				req.off("error", onError);
			};
			const onData = (chunk) => {
				if (cancelled) return;
				controller.enqueue(new Uint8Array(chunk));
				if ((controller.desiredSize ?? 0) <= 0) req.pause();
			};
			const onEnd = () => {
				cleanup();
				if (!cancelled) controller.close();
			};
			const onError = (error) => {
				cleanup();
				if (!cancelled) controller.error(error);
			};
			req.on("data", onData);
			req.on("end", onEnd);
			req.on("error", onError);
			req.pause();
		},
		pull() {
			if (!cancelled) req.resume();
		},
		cancel() {
			cancelled = true;
			cleanup();
			req.resume();
		}
	});
}
/** Content types that benefit from compression. */
const COMPRESSIBLE_TYPES = /* @__PURE__ */ new Set([
	"text/html",
	"text/css",
	"text/plain",
	"text/xml",
	"text/javascript",
	"application/javascript",
	"application/json",
	"application/xml",
	"application/xhtml+xml",
	"application/rss+xml",
	"application/atom+xml",
	"image/svg+xml",
	"application/manifest+json",
	"application/wasm"
]);
/** Minimum size threshold for compression (in bytes). Below this, compression overhead isn't worth it. */
const COMPRESS_THRESHOLD = 1024;
/**
* Create a compression stream for the given encoding.
*/
function createCompressor(encoding, mode = "default") {
	switch (encoding) {
		case "zstd": return zlib.createZstdCompress({
			...mode === "streaming" ? { flush: zlib.constants.ZSTD_e_flush } : {},
			params: { [zlib.constants.ZSTD_c_compressionLevel]: 3 }
		});
		case "br": return zlib.createBrotliCompress({
			...mode === "streaming" ? { flush: zlib.constants.BROTLI_OPERATION_FLUSH } : {},
			params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 }
		});
		case "gzip": return zlib.createGzip({
			level: 6,
			...mode === "streaming" ? { flush: zlib.constants.Z_SYNC_FLUSH } : {}
		});
		case "deflate": return zlib.createDeflate({
			level: 6,
			...mode === "streaming" ? { flush: zlib.constants.Z_SYNC_FLUSH } : {}
		});
	}
}
/**
* Merge middleware headers and a Web Response's headers into a single
* record suitable for Node.js `res.writeHead()`. Uses `getSetCookie()`
* to preserve multiple Set-Cookie values instead of flattening them.
*/
function mergeResponseHeaders(middlewareHeaders, response) {
	const merged = { ...middlewareHeaders };
	response.headers.forEach((v, k) => {
		if (k === "set-cookie") return;
		merged[k] = v;
	});
	const responseCookies = response.headers.getSetCookie?.() ?? [];
	if (responseCookies.length > 0) {
		const existing = merged["set-cookie"];
		merged["set-cookie"] = [...existing ? Array.isArray(existing) ? existing : [existing] : [], ...responseCookies];
	}
	return merged;
}
function toWebHeaders(headersRecord) {
	const headers = new Headers();
	for (const [key, value] of Object.entries(headersRecord)) appendWebHeader(headers, key, value);
	return headers;
}
function appendWebHeader(headers, key, value) {
	if (value === void 0) return;
	if (key.startsWith(":")) return;
	if (Array.isArray(value)) {
		for (const item of value) headers.append(key, item);
		return;
	}
	headers.set(key, value);
}
function nodeHeadersToWebHeaders(headersRecord) {
	const headers = new Headers();
	for (const [key, value] of Object.entries(headersRecord)) appendWebHeader(headers, key, value);
	return headers;
}
const NO_BODY_RESPONSE_STATUSES = /* @__PURE__ */ new Set([
	204,
	205,
	304
]);
const OMIT_BODY_HEADERS = /* @__PURE__ */ new Set(["content-length", "content-type"]);
const OMIT_STATIC_RESPONSE_HEADERS = /* @__PURE__ */ new Set([
	VINEXT_STATIC_FILE_HEADER,
	"content-encoding",
	"content-length",
	"content-type"
]);
function omitHeadersCaseInsensitive(headersRecord, targets) {
	const filtered = {};
	for (const [key, value] of Object.entries(headersRecord)) {
		if (targets.has(key.toLowerCase())) continue;
		filtered[key] = value;
	}
	return filtered;
}
function mergeVaryHeader(headers, value) {
	const merged = { ...headers };
	const existingKey = Object.keys(merged).find((key) => key.toLowerCase() === "vary");
	if (!existingKey) {
		merged.Vary = value;
		return merged;
	}
	const rawVary = merged[existingKey];
	const existingVary = Array.isArray(rawVary) ? rawVary.join(", ") : rawVary;
	if (existingVary.trim().length === 0) {
		merged[existingKey] = value;
		return merged;
	}
	const values = existingVary.split(",").map((entry) => entry.trim().toLowerCase());
	if (!values.includes("*") && !values.includes(value.toLowerCase())) merged[existingKey] = `${existingVary}, ${value}`;
	return merged;
}
function matchesIfNoneMatchHeader(ifNoneMatch, etag) {
	if (!ifNoneMatch) return false;
	if (ifNoneMatch === "*") return true;
	return ifNoneMatch.split(",").map((value) => value.trim()).some((value) => value === etag);
}
function installClientBuildManifestGlobals(clientDir, assetBase, assetPrefix) {
	const metadata = computeClientRuntimeMetadata({
		clientDir,
		assetBase,
		assetPrefix
	});
	setPagesClientAssets({
		appBootstrapPreinitModules: metadata.appBootstrapPreinitModules,
		lazyChunks: metadata.lazyChunks,
		dynamicPreloads: metadata.dynamicPreloads
	});
}
function isNoBodyResponseStatus(status) {
	return NO_BODY_RESPONSE_STATUSES.has(status);
}
function cancelResponseBody(response) {
	const body = response.body;
	if (!body || body.locked) return;
	body.cancel().catch(() => {});
}
function isVinextStreamedHtmlResponse(response) {
	return response.__vinextStreamedHtmlResponse === true;
}
function logProdServerStarted(host, port, purpose) {
	const url = `http://${host}:${port}`;
	if (purpose === "prerender") {
		console.log(`[vinext] Production server for prerendering running at ${url}`);
		return;
	}
	console.log(`[vinext] Production server running at ${url}`);
}
/**
* Merge middleware/config headers and an optional status override into a new
* Web Response while preserving the original body stream when allowed.
*
* This is the canonical {@link mergeHeaders} (server/worker-utils.ts) with the
* arguments in (headers, response) order. The request path now calls
* `runPagesRequest`, which uses `mergeHeaders` directly; this wrapper is retained
* only for its existing tests and any external callers, so there is a single
* implementation to keep in sync. The init-owned Cloudflare Worker template delegates here.
*/
function mergeWebResponse(middlewareHeaders, response, statusOverride) {
	return mergeHeaders(response, middlewareHeaders, statusOverride);
}
/**
* Send a compressed response if the content type is compressible and the
* client supports compression. Otherwise send uncompressed.
*/
function sendCompressed(req, res, body, contentType, statusCode, extraHeaders = {}, compress = true, statusText) {
	const buf = typeof body === "string" ? Buffer.from(body) : body;
	const baseType = contentType.split(";")[0].trim();
	const varyByEncoding = compress && COMPRESSIBLE_TYPES.has(baseType);
	const encoding = compress ? negotiateEncoding(req) : "identity";
	const headersWithoutBodyHeaders = omitHeadersCaseInsensitive(extraHeaders, OMIT_BODY_HEADERS);
	const writeHead = (headers, responseStatus = statusCode, responseStatusText = statusText) => {
		if (responseStatusText) res.writeHead(responseStatus, responseStatusText, headers);
		else res.writeHead(responseStatus, headers);
	};
	if (encoding !== "identity" && varyByEncoding && buf.length >= 1024) {
		writeHead(mergeVaryHeader({
			...headersWithoutBodyHeaders,
			"Content-Type": contentType,
			"Content-Encoding": encoding
		}, "Accept-Encoding"));
		if (req.method === "HEAD") {
			res.end();
			return;
		}
		const compressor = createCompressor(encoding);
		compressor.end(buf);
		pipeline(compressor, res, () => {});
	} else {
		const identityHeaders = {
			...headersWithoutBodyHeaders,
			"Content-Type": contentType,
			"Content-Length": String(buf.length)
		};
		writeHead(varyByEncoding ? mergeVaryHeader(identityHeaders, "Accept-Encoding") : identityHeaders);
		if (req.method === "HEAD") {
			res.end();
			return;
		}
		res.end(buf);
	}
}
/**
* Try to serve a static file from the client build directory.
*
* When a `StaticFileCache` is provided, lookups are pure in-memory Map.get()
* with zero filesystem calls. Precompressed .br/.gz/.zst variants (generated at
* build time) are served directly — no per-request compression needed for
* hashed assets.
*
* Without a cache, falls back to async filesystem probing (still non-blocking,
* unlike the old sync existsSync/statSync approach).
*/
async function tryServeStatic(req, res, clientDir, pathname, compress, cache, extraHeaders, statusCode) {
	if (pathname === "/") return false;
	const responseStatus = statusCode ?? 200;
	const omitBody = isNoBodyResponseStatus(responseStatus);
	if (cache) {
		let lookupPath;
		if (pathname.includes("%")) {
			try {
				lookupPath = decodeURIComponent(pathname);
			} catch {
				return false;
			}
			if (lookupPath.startsWith("/.vite/") || lookupPath === "/.vite") return false;
		} else {
			if (pathname.startsWith("/.vite/") || pathname === "/.vite") return false;
			lookupPath = pathname;
		}
		const entry = cache.lookup(lookupPath);
		if (!entry) return false;
		const rawAe = compress ? req.headers["accept-encoding"] : void 0;
		const parsed = typeof rawAe === "string" ? parseAcceptedEncodings(rawAe) : void 0;
		const availableVariants = [
			...entry.zst ? ["zstd"] : [],
			...entry.br ? ["br"] : [],
			...entry.gz ? ["gzip"] : []
		];
		const variesByEncoding = compress && availableVariants.length > 0;
		const selected = parsed ? selectContentEncoding(parsed, availableVariants) : "identity";
		const variant = selected === "zstd" ? entry.zst : selected === "br" ? entry.br : selected === "gzip" ? entry.gz : entry.original;
		const ifNoneMatch = req.headers["if-none-match"];
		if (responseStatus === 200 && typeof ifNoneMatch === "string" && matchesIfNoneMatchHeader(ifNoneMatch, entry.etag)) {
			const notModifiedHeaders = variesByEncoding ? mergeVaryHeader({
				...entry.notModifiedHeaders,
				...extraHeaders
			}, "Accept-Encoding") : {
				...entry.notModifiedHeaders,
				...extraHeaders
			};
			if (selected !== "identity") notModifiedHeaders["Content-Encoding"] = selected;
			res.writeHead(304, notModifiedHeaders);
			res.end();
			return true;
		}
		const responseHeaders = {
			...variant.headers,
			...extraHeaders
		};
		res.writeHead(responseStatus, variesByEncoding ? mergeVaryHeader(responseHeaders, "Accept-Encoding") : responseHeaders);
		if (omitBody || req.method === "HEAD") {
			res.end();
			return true;
		}
		if (variant.buffer) res.end(variant.buffer);
		else pipeline(fs.createReadStream(variant.path), res, (err) => {
			if (err) {
				console.warn(`[vinext] Static file stream error for ${variant.path}:`, err.message);
				res.destroy(err);
			}
		});
		return true;
	}
	const resolvedClient = path.resolve(clientDir);
	let decodedPathname;
	try {
		decodedPathname = decodeURIComponent(pathname);
	} catch {
		return false;
	}
	if (decodedPathname.startsWith("/.vite/") || decodedPathname === "/.vite") return false;
	const staticFile = path.resolve(clientDir, "." + decodedPathname);
	if (!staticFile.startsWith(resolvedClient + path.sep) && staticFile !== resolvedClient) return false;
	const resolved = await resolveStaticFile(staticFile);
	if (!resolved) return false;
	const ext = path.extname(resolved.path);
	const ct = CONTENT_TYPES[ext] ?? "application/octet-stream";
	const isHashed = pathname.includes(`/${ASSET_PREFIX_URL_DIR}/`);
	const cacheControl = isHashed ? "public, max-age=31536000, immutable" : "public, max-age=3600";
	const etag = isHashed && etagFromFilenameHash(resolved.path, ext) || `W/"${resolved.size}-${Math.floor(resolved.mtimeMs / 1e3)}"`;
	const baseType = ct.split(";")[0].trim();
	const isCompressible = compress && COMPRESSIBLE_TYPES.has(baseType);
	const baseHeaders = {
		"Content-Type": ct,
		"Cache-Control": cacheControl,
		ETag: etag,
		...extraHeaders
	};
	if (isCompressible) {
		const encoding = negotiateEncoding(req);
		const ifNoneMatch = req.headers["if-none-match"];
		if (responseStatus === 200 && typeof ifNoneMatch === "string" && matchesIfNoneMatchHeader(ifNoneMatch, etag)) {
			const notModifiedHeaders = mergeVaryHeader(baseHeaders, "Accept-Encoding");
			if (encoding !== "identity") notModifiedHeaders["Content-Encoding"] = encoding;
			res.writeHead(304, notModifiedHeaders);
			res.end();
			return true;
		}
		if (encoding !== "identity") {
			res.writeHead(responseStatus, mergeVaryHeader({
				...baseHeaders,
				"Content-Encoding": encoding
			}, "Accept-Encoding"));
			if (omitBody || req.method === "HEAD") {
				res.end();
				return true;
			}
			const compressor = createCompressor(encoding);
			pipeline(fs.createReadStream(resolved.path), compressor, res, (err) => {
				if (err) {
					console.warn(`[vinext] Static file stream error for ${resolved.path}:`, err.message);
					res.destroy(err);
				}
			});
			return true;
		}
	}
	const ifNoneMatch = req.headers["if-none-match"];
	if (responseStatus === 200 && typeof ifNoneMatch === "string" && matchesIfNoneMatchHeader(ifNoneMatch, etag)) {
		res.writeHead(304, isCompressible ? mergeVaryHeader(baseHeaders, "Accept-Encoding") : baseHeaders);
		res.end();
		return true;
	}
	const identityHeaders = {
		...baseHeaders,
		"Content-Length": String(resolved.size)
	};
	res.writeHead(responseStatus, isCompressible ? mergeVaryHeader(identityHeaders, "Accept-Encoding") : identityHeaders);
	if (omitBody || req.method === "HEAD") {
		res.end();
		return true;
	}
	pipeline(fs.createReadStream(resolved.path), res, (err) => {
		if (err) {
			console.warn(`[vinext] Static file stream error for ${resolved.path}:`, err.message);
			res.destroy(err);
		}
	});
	return true;
}
/**
* Resolve the actual file to serve, trying extension-less HTML fallbacks.
* Returns the resolved path + size + mtime, or null if not found.
*/
async function resolveStaticFile(staticFile) {
	const stat = await statIfFile(staticFile);
	if (stat) return {
		path: staticFile,
		size: stat.size,
		mtimeMs: stat.mtimeMs
	};
	const htmlFallback = staticFile + ".html";
	const htmlStat = await statIfFile(htmlFallback);
	if (htmlStat) return {
		path: htmlFallback,
		size: htmlStat.size,
		mtimeMs: htmlStat.mtimeMs
	};
	const indexFallback = path.join(staticFile, "index.html");
	const indexStat = await statIfFile(indexFallback);
	if (indexStat) return {
		path: indexFallback,
		size: indexStat.size,
		mtimeMs: indexStat.mtimeMs
	};
	return null;
}
async function statIfFile(filePath) {
	try {
		const stat = await fsp.stat(filePath);
		return stat.isFile() ? {
			size: stat.size,
			mtimeMs: stat.mtimeMs
		} : null;
	} catch {
		return null;
	}
}
/**
* Convert a Node.js IncomingMessage to a Web Request object.
*
* When `urlOverride` is provided, it is used as the path + query string
* instead of `req.url`.
*/
function nodeToWebRequest(req, urlOverride, prerenderSecret) {
	const origin = `${resolveRequestProtocol(req)}://${resolveRequestHost(req, "localhost")}`;
	const url = new URL(urlOverride ?? req.url ?? "/", origin);
	const rawHeaders = nodeHeadersToWebHeaders(req.headers);
	const prerenderRouteParamsPayload = readTrustedPrerenderRouteParamsFromHeaders(rawHeaders, prerenderSecret);
	const isTrustedSpeculativePrerender = process.env.VINEXT_PRERENDER === "1" && prerenderSecret !== void 0 && rawHeaders.get("x-vinext-prerender-secret") === prerenderSecret && rawHeaders.get("x-vinext-prerender-speculative") === "1";
	const headers = filterInternalHeaders(rawHeaders);
	const prerenderRouteParamsHeader = serializePrerenderRouteParamsHeader(prerenderRouteParamsPayload);
	if (prerenderRouteParamsHeader !== null) headers.set(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, prerenderRouteParamsHeader);
	if (isTrustedSpeculativePrerender) headers.set(VINEXT_PRERENDER_SPECULATIVE_HEADER, "1");
	const method = req.method ?? "GET";
	const hasBody = method !== "GET" && method !== "HEAD";
	const init = {
		method,
		headers
	};
	if (hasBody) {
		init.body = readNodeStream(req);
		init.duplex = "half";
	}
	return new Request(url, init);
}
/**
* Stream a Web Response back to a Node.js ServerResponse.
* Supports streaming compression for SSR responses.
*/
async function sendWebResponse(webResponse, req, res, compress) {
	const status = webResponse.status;
	const statusText = webResponse.statusText || void 0;
	const writeHead = (headers) => {
		if (statusText) res.writeHead(status, statusText, headers);
		else res.writeHead(status, headers);
	};
	const nodeHeaders = {};
	webResponse.headers.forEach((value, key) => {
		const existing = nodeHeaders[key];
		if (existing !== void 0) nodeHeaders[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
		else nodeHeaders[key] = value;
	});
	const alreadyEncoded = webResponse.headers.get("content-encoding") !== null;
	if (!webResponse.body) {
		writeHead(nodeHeaders);
		res.end();
		return;
	}
	const baseType = (webResponse.headers.get("content-type") ?? "").split(";")[0].trim();
	const varyByEncoding = compress && !alreadyEncoded && COMPRESSIBLE_TYPES.has(baseType);
	const encoding = compress && !alreadyEncoded ? negotiateEncoding(req) : "identity";
	const shouldCompress = encoding !== "identity" && COMPRESSIBLE_TYPES.has(baseType);
	if (shouldCompress) {
		delete nodeHeaders["content-length"];
		delete nodeHeaders["Content-Length"];
		nodeHeaders["Content-Encoding"] = encoding;
	}
	writeHead(varyByEncoding ? mergeVaryHeader(nodeHeaders, "Accept-Encoding") : nodeHeaders);
	if (req.method === "HEAD") {
		cancelResponseBody(webResponse);
		res.end();
		return;
	}
	const nodeStream = Readable.fromWeb(webResponse.body);
	if (shouldCompress) pipeline(nodeStream, createCompressor(encoding, "streaming"), res, () => {});
	else pipeline(nodeStream, res, () => {});
}
/**
* Start the production server.
*
* Automatically detects whether the build is App Router (dist/server/index.js) or
* Pages Router (dist/server/entry.js) and configures the appropriate handler.
*/
async function startProdServer(options = {}) {
	installSocketErrorBackstop();
	const { port = process.env.PORT ? parseInt(process.env.PORT) : 3e3, host = "0.0.0.0", outDir = path.resolve("dist"), rscEntryPath: explicitRscEntryPath, serverEntryPath: explicitServerEntryPath, noCompression = false, purpose, silent = false } = options;
	const compress = !noCompression;
	const resolvedOutDir = path.resolve(outDir);
	const clientDir = path.join(resolvedOutDir, "client");
	const rscEntryPath = explicitRscEntryPath ? path.resolve(explicitRscEntryPath) : path.join(resolvedOutDir, "server", "index.js");
	const serverEntryPath = explicitServerEntryPath ? path.resolve(explicitServerEntryPath) : path.join(resolvedOutDir, "server", "entry.js");
	const isAppRouter = fs.existsSync(rscEntryPath);
	if (!isAppRouter && !fs.existsSync(serverEntryPath)) {
		console.error(`[vinext] No build output found in ${outDir}`);
		console.error("Run `vinext build` first.");
		process.exit(1);
	}
	if (isAppRouter) return startAppRouterServer({
		port,
		host,
		clientDir,
		rscEntryPath,
		compress,
		purpose,
		silent
	});
	return startPagesRouterServer({
		port,
		host,
		clientDir,
		serverEntryPath,
		compress,
		purpose,
		silent
	});
}
function createNodeExecutionContext() {
	return {
		waitUntil(promise) {
			Promise.resolve(promise).catch(() => {});
		},
		passThroughOnException() {}
	};
}
function resolveAppRouterHandler(entry) {
	if (typeof entry === "function") return (request) => Promise.resolve(entry(request));
	if (entry && typeof entry === "object" && "fetch" in entry) {
		const workerEntry = entry;
		if (typeof workerEntry.fetch === "function") return (request) => Promise.resolve(workerEntry.fetch(request, void 0, createNodeExecutionContext()));
	}
	console.error("[vinext] App Router entry must export either a default handler function or a Worker-style default export with fetch()");
	process.exit(1);
}
function isAppRouterPrerenderSeederExport(value) {
	return typeof value === "function";
}
function resolveAppRouterPrerenderSeeder(entryModule) {
	if (typeof entryModule !== "object" || entryModule === null) return seedMemoryCacheFromPrerender;
	const seedExport = Object.getOwnPropertyDescriptor(entryModule, "seedMemoryCacheFromPrerender")?.value;
	if (!isAppRouterPrerenderSeederExport(seedExport)) {
		if (process.env.NEXT_PRIVATE_DEBUG_CACHE) console.debug("[vinext] ISR: using fallback prerender cache seeder");
		return seedMemoryCacheFromPrerender;
	}
	if (process.env.NEXT_PRIVATE_DEBUG_CACHE) console.debug("[vinext] ISR: using App Router entry prerender cache seeder");
	return async (serverDir) => {
		const result = await Promise.resolve(seedExport(serverDir));
		return typeof result === "number" ? result : 0;
	};
}
/**
* Resolve a request pathname to a static-asset lookup path inside `clientDir`.
*
* Returns `null` when the request is not for a built asset, in which case
* the caller should let the request fall through to the RSC handler.
*
* Three URL shapes are recognised:
*
*  - `/_next/static/...` — the default layout. Files land on disk at
*    `dist/client/_next/static/...`, so the pathname maps 1:1. Also covers
*    absolute-URL `assetPrefix` with no path component (same on-disk and
*    URL shape).
*  - `<assetPathPrefix>/_next/static/...` — when `assetPrefix` is a path
*    prefix (e.g. `/custom-asset-prefix`). The on-disk layout is
*    `dist/client/<prefix>/_next/static/...`, so the pathname maps 1:1.
*  - `<absoluteURLPathname>/_next/static/...` — when `assetPrefix` is an
*    absolute URL with a non-empty pathname (e.g. `https://cdn/sub`).
*    Files are written to `dist/client/_next/static/...` but emitted URLs
*    prepend the full URL. Requests do not normally arrive here — they go
*    to the CDN — but we accept them so a same-origin reverse proxy can
*    route through; the on-disk path is just `_next/static/...`.
*/
function resolveAppRouterAssetPath(pathname, assetPathPrefix, assetPrefix) {
	const nextStaticDir = `/${ASSET_PREFIX_URL_DIR}/`;
	if (assetPathPrefix) {
		if (pathname === assetPathPrefix || pathname.startsWith(assetPathPrefix + "/")) {
			const rest = pathname.slice(assetPathPrefix.length) || "/";
			if (rest.startsWith(nextStaticDir)) {
				if (!isAbsoluteAssetPrefix(assetPrefix)) return pathname;
				return rest;
			}
		}
		return null;
	}
	if (pathname.startsWith(nextStaticDir)) return pathname;
	return null;
}
function isSsrManifest(value) {
	if (!isUnknownRecord(value)) return false;
	return Object.values(value).every((files) => Array.isArray(files) && files.every((file) => typeof file === "string"));
}
function readSsrManifest(clientDir) {
	const manifestPath = path.join(clientDir, ".vite", "ssr-manifest.json");
	if (!fs.existsSync(manifestPath)) return {};
	let parsed;
	try {
		parsed = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
	} catch (error) {
		console.warn(`[vinext] Ignoring unparseable SSR manifest at ${manifestPath}:`, error);
		return {};
	}
	if (!isSsrManifest(parsed)) {
		console.warn(`[vinext] Ignoring SSR manifest with unexpected shape at ${manifestPath}`);
		return {};
	}
	return parsed;
}
function installPagesClientAssets(options) {
	const ssrManifest = readSsrManifest(options.clientDir);
	const metadata = computeClientRuntimeMetadata({
		clientDir: options.clientDir,
		assetBase: options.assetBase,
		assetPrefix: options.assetPrefix,
		includeClientEntry: options.clientEntryLookup === "pages-client-entry" ? "pages-client-entry" : true
	});
	setPagesClientAssets({
		clientEntry: metadata.clientEntryFile,
		appBootstrapPreinitModules: metadata.appBootstrapPreinitModules,
		ssrManifest: Object.keys(ssrManifest).length > 0 ? ssrManifest : void 0,
		lazyChunks: metadata.lazyChunks,
		dynamicPreloads: metadata.dynamicPreloads
	});
	return ssrManifest;
}
/**
* Start the App Router production server.
*
* The App Router entry (dist/server/index.js) can export either:
*   - a default handler function: handler(request: Request) → Promise<Response>
*   - a Worker-style object: { fetch(request, env, ctx) → Promise<Response> }
*
* This handler already does everything: route matching, RSC rendering,
* SSR HTML generation (via import("./ssr/index.js")), route handlers,
* server actions, ISR caching, 404s, redirects, etc.
*
* The production server's job is simply to:
* 1. Serve static assets from dist/client/
* 2. Convert Node.js IncomingMessage → Web Request
* 3. Call the RSC handler
* 4. Stream the Web Response back (with optional compression)
*/
async function startAppRouterServer(options) {
	const { port, host, clientDir, rscEntryPath, compress, purpose, silent } = options;
	const prerenderSecret = readPrerenderSecret(path.dirname(rscEntryPath));
	const rscModule = await importServerEntryModule(rscEntryPath);
	const rscHandler = resolveAppRouterHandler(rscModule.default);
	const appRouterAssetPrefix = typeof rscModule.__assetPrefix === "string" ? rscModule.__assetPrefix : "";
	const appRouterBasePath = typeof rscModule.__basePath === "string" ? rscModule.__basePath : "";
	const appRouterInlineCss = rscModule.__inlineCss === true;
	const appRouterHasPagesDir = rscModule.__hasPagesDir === true;
	const appImageAllowedWidths = Array.isArray(rscModule.__imageAllowedWidths) ? rscModule.__imageAllowedWidths : [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
	let imageConfig = typeof rscModule.__imageConfig === "object" && rscModule.__imageConfig !== null ? rscModule.__imageConfig : void 0;
	if (imageConfig === void 0) {
		const imageConfigPath = path.join(path.dirname(rscEntryPath), "image-config.json");
		if (fs.existsSync(imageConfigPath)) try {
			imageConfig = JSON.parse(fs.readFileSync(imageConfigPath, "utf-8"));
		} catch {}
	}
	globalThis.__VINEXT_INLINE_CSS__ = appRouterInlineCss ? collectInlineCssManifest(clientDir, appRouterAssetPrefix) : void 0;
	const appAssetPathPrefix = assetPrefixPathname(appRouterAssetPrefix);
	const appAssetBase = appRouterBasePath ? `${appRouterBasePath}/` : "/";
	if (appRouterHasPagesDir) installPagesClientAssets({
		clientDir,
		assetPrefix: appRouterAssetPrefix,
		assetBase: appAssetBase,
		clientEntryLookup: "pages-client-entry"
	});
	else installClientBuildManifestGlobals(clientDir, appAssetBase, appRouterAssetPrefix);
	const seededRoutes = await resolveAppRouterPrerenderSeeder(rscModule)(path.dirname(rscEntryPath));
	if (seededRoutes > 0) console.log(`[vinext] Seeded ${seededRoutes} pre-rendered route${seededRoutes !== 1 ? "s" : ""} into memory cache`);
	const staticCache = await StaticFileCache.create(clientDir);
	const handleRequest = async (req, res) => {
		const rawUrl = req.url ?? "/";
		const rawPathname = rawUrl.split("?")[0];
		if (isOpenRedirectShaped(rawPathname)) {
			res.writeHead(404);
			res.end("This page could not be found");
			return;
		}
		const normalizedRawPathname = rawPathname.replaceAll("\\", "/");
		let pathname;
		try {
			pathname = normalizePath(normalizePathnameForRouteMatchStrict(normalizedRawPathname));
		} catch {
			res.writeHead(400);
			res.end("Bad Request");
			return;
		}
		if (pathname === "/__vinext/prerender/static-params" || pathname === "/__vinext/prerender/pages-static-paths") {
			const secret = req.headers[VINEXT_PRERENDER_SECRET_HEADER];
			if (!prerenderSecret || secret !== prerenderSecret) {
				res.writeHead(403);
				res.end("Forbidden");
				return;
			}
		}
		let missingBuildAsset = false;
		{
			const assetLookupPath = resolveAppRouterAssetPath(pathname, appAssetPathPrefix, appRouterAssetPrefix);
			if (assetLookupPath) {
				if (await tryServeStatic(req, res, clientDir, assetLookupPath, compress, staticCache)) return;
				missingBuildAsset = true;
			}
		}
		if (isImageOptimizationPath(pathname)) {
			const params = parseImageParams(new URL(rawUrl, "http://localhost"), appImageAllowedWidths, imageConfig?.qualities);
			if (!params) {
				res.writeHead(400);
				res.end("Bad Request");
				return;
			}
			if (!isSafeImageContentType(CONTENT_TYPES[path.extname(params.imageUrl).toLowerCase()] ?? "application/octet-stream", imageConfig?.dangerouslyAllowSVG)) {
				res.writeHead(400);
				res.end("The requested resource is not an allowed image type");
				return;
			}
			const imageSecurityHeaders = {
				"Content-Security-Policy": imageConfig?.contentSecurityPolicy ?? "script-src 'none'; frame-src 'none'; sandbox;",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition": imageConfig?.contentDispositionType === "attachment" ? "attachment" : "inline"
			};
			if (await tryServeStatic(req, res, clientDir, params.imageUrl, false, staticCache, imageSecurityHeaders)) return;
			res.writeHead(404);
			res.end("Image not found");
			return;
		}
		try {
			const request = nodeToWebRequest(req, rawUrl, prerenderSecret);
			const response = await rscHandler(request);
			if (missingBuildAsset && response.status === 404) {
				cancelResponseBody(response);
				res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Not Found");
				return;
			}
			const staticFileSignal = response.headers.get(VINEXT_STATIC_FILE_HEADER);
			if (staticFileSignal) {
				let staticFilePath = "/";
				try {
					staticFilePath = decodeURIComponent(staticFileSignal);
				} catch {
					staticFilePath = staticFileSignal;
				}
				const staticResponseHeaders = omitHeadersCaseInsensitive(mergeResponseHeaders({}, response), OMIT_STATIC_RESPONSE_HEADERS);
				const served = await tryServeStatic(req, res, clientDir, staticFilePath, compress, staticCache, staticResponseHeaders, response.status);
				cancelResponseBody(response);
				if (served) return;
				await sendWebResponse(notFoundResponse({ headers: toWebHeaders(staticResponseHeaders) }), req, res, compress);
				return;
			}
			await sendWebResponse(response, req, res, compress);
		} catch (e) {
			console.error("[vinext] Server error:", e);
			if (!res.headersSent) {
				res.writeHead(500);
				res.end("Internal Server Error");
			}
		}
	};
	const server = createServer((req, res) => {
		handleRequest(req, res);
	});
	await new Promise((resolve) => {
		server.listen(port, host, () => {
			const addr = server.address();
			const actualPort = typeof addr === "object" && addr ? addr.port : port;
			if (!silent) logProdServerStarted(host, actualPort, purpose);
			resolve();
		});
	});
	const addr = server.address();
	return {
		server,
		port: typeof addr === "object" && addr ? addr.port : port
	};
}
function isPagesServerEntryPageRoute(value) {
	if (!value || typeof value !== "object" || !("pattern" in value)) return false;
	if (typeof value.pattern !== "string") return false;
	if (!("module" in value) || value.module === void 0) return true;
	const pageModule = value.module;
	if (!pageModule || typeof pageModule !== "object") return false;
	return !("getStaticPaths" in pageModule) || typeof pageModule.getStaticPaths === "function";
}
function readPagesServerEntryPageRoutes(value) {
	return Array.isArray(value) && value.every(isPagesServerEntryPageRoute) ? value : void 0;
}
/**
* Start the Pages Router production server.
*
* Uses the server entry (dist/server/entry.js) which exports:
* - renderPage(request, url, manifest, ctx?, middlewareHeaders?) — SSR rendering (Web Request → Response)
* - handleApiRoute(request, url, ctx?) — API route handling (ctx optional; pass for ctx.waitUntil() on Workers)
* - runMiddleware(request, ctx?) — middleware execution (ctx optional; pass for ctx.waitUntil() on Workers)
* - vinextConfig — embedded next.config.js settings
*/
async function startPagesRouterServer(options) {
	const { port, host, clientDir, serverEntryPath, compress, purpose, silent } = options;
	const serverEntry = await importServerEntryModule(serverEntryPath);
	const { renderPage, handleApiRoute: handleApi, runMiddleware, vinextConfig, buildId: pagesBuildId } = serverEntry;
	const matchPageRoute = typeof serverEntry.matchPageRoute === "function" ? serverEntry.matchPageRoute : void 0;
	const hasMiddleware = serverEntry.hasMiddleware === true;
	const pageRoutes = readPagesServerEntryPageRoutes(serverEntry.pageRoutes);
	const prerenderSecret = readPrerenderSecret(path.dirname(serverEntryPath));
	const basePath = vinextConfig?.basePath ?? "";
	const assetPrefix = vinextConfig?.assetPrefix ?? "";
	const pagesAssetPathPrefix = assetPrefixPathname(assetPrefix);
	const assetBase = basePath ? `${basePath}/` : "/";
	const trailingSlash = vinextConfig?.trailingSlash ?? false;
	const i18nConfig = vinextConfig?.i18n ?? null;
	const configRedirects = vinextConfig?.redirects ?? [];
	const configRewrites = vinextConfig?.rewrites ?? {
		beforeFiles: [],
		afterFiles: [],
		fallback: []
	};
	const configHeaders = vinextConfig?.headers ?? [];
	const allowedImageWidths = [...vinextConfig?.images?.deviceSizes ?? DEFAULT_DEVICE_SIZES, ...vinextConfig?.images?.imageSizes ?? DEFAULT_IMAGE_SIZES];
	const pagesImageConfig = vinextConfig?.images ? {
		dangerouslyAllowSVG: vinextConfig.images.dangerouslyAllowSVG,
		dangerouslyAllowLocalIP: vinextConfig.images.dangerouslyAllowLocalIP,
		qualities: vinextConfig.images.qualities,
		contentDispositionType: vinextConfig.images.contentDispositionType,
		contentSecurityPolicy: vinextConfig.images.contentSecurityPolicy
	} : void 0;
	const ssrManifest = installPagesClientAssets({
		clientDir,
		assetPrefix,
		assetBase,
		clientEntryLookup: "any-client-entry"
	});
	const staticCache = await StaticFileCache.create(clientDir);
	const handleRequest = async (req, res) => {
		const rawUrl = req.url ?? "/";
		const rawPagesPathnameBeforeNormalize = rawUrl.split("?")[0];
		if (isOpenRedirectShaped(rawPagesPathnameBeforeNormalize)) {
			res.writeHead(404);
			res.end("This page could not be found");
			return;
		}
		const rawPagesPathname = canonicalizeRequestPathname(rawPagesPathnameBeforeNormalize.replaceAll("\\", "/"));
		const rawQs = rawUrl.includes("?") ? rawUrl.slice(rawUrl.indexOf("?")) : "";
		let requestPathname = normalizePath(rawPagesPathname);
		let pathname;
		try {
			pathname = normalizePath(normalizePathnameForRouteMatchStrict(rawPagesPathname));
		} catch {
			res.writeHead(400);
			res.end("Bad Request");
			return;
		}
		let url = requestPathname + rawQs;
		if (pathname === "/__vinext/prerender/pages-static-paths") {
			const secret = req.headers[VINEXT_PRERENDER_SECRET_HEADER];
			if (!prerenderSecret || secret !== prerenderSecret) {
				res.writeHead(403);
				res.end("Forbidden");
				return;
			}
			const parsedUrl = new URL(rawUrl, "http://localhost");
			const pattern = parsedUrl.searchParams.get("pattern") ?? "";
			const localesRaw = parsedUrl.searchParams.get("locales");
			const locales = localesRaw ? JSON.parse(localesRaw) : [];
			const defaultLocale = parsedUrl.searchParams.get("defaultLocale") ?? "";
			const fn = (pageRoutes?.find((r) => r.pattern === pattern))?.module?.getStaticPaths;
			if (typeof fn !== "function") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end("null");
				return;
			}
			try {
				const result = await fn({
					locales,
					defaultLocale
				});
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(result));
			} catch (e) {
				res.writeHead(500);
				res.end(e.message);
			}
			return;
		}
		const staticLookupPath = stripBasePath(pathname, basePath);
		const pagesAssetLookup = resolveAppRouterAssetPath(pathname, pagesAssetPathPrefix, assetPrefix);
		const missingBuildAsset = pagesAssetLookup !== null;
		if (pagesAssetLookup) {
			if (await tryServeStatic(req, res, clientDir, pagesAssetLookup, compress, staticCache)) return;
		}
		if (isImageOptimizationPath(pathname) || isImageOptimizationPath(staticLookupPath)) {
			const params = parseImageParams(new URL(rawUrl, "http://localhost"), allowedImageWidths, pagesImageConfig?.qualities);
			if (!params) {
				res.writeHead(400);
				res.end("Bad Request");
				return;
			}
			if (!isSafeImageContentType(CONTENT_TYPES[path.extname(params.imageUrl).toLowerCase()] ?? "application/octet-stream", pagesImageConfig?.dangerouslyAllowSVG)) {
				res.writeHead(400);
				res.end("The requested resource is not an allowed image type");
				return;
			}
			const imageSecurityHeaders = {
				"Content-Security-Policy": pagesImageConfig?.contentSecurityPolicy ?? "script-src 'none'; frame-src 'none'; sandbox;",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition": pagesImageConfig?.contentDispositionType === "attachment" ? "attachment" : "inline"
			};
			if (await tryServeStatic(req, res, clientDir, params.imageUrl, false, staticCache, imageSecurityHeaders)) return;
			res.writeHead(404);
			res.end("Image not found");
			return;
		}
		try {
			const hadBasePath = !basePath || hasBasePath(requestPathname, basePath);
			let configMatchPathname = stripBasePath(requestPathname, basePath);
			{
				const strippedPathname = stripBasePath(pathname, basePath);
				const strippedRequestPathname = stripBasePath(requestPathname, basePath);
				pathname = strippedPathname;
				if (strippedRequestPathname !== requestPathname) {
					requestPathname = strippedRequestPathname;
					url = requestPathname + rawQs;
				}
			}
			if (urlParserCreatesPagesDataPath(pathname)) {
				res.writeHead(404);
				res.end("This page could not be found");
				return;
			}
			requestPathname = encodeUrlParserIgnoredCharacters(requestPathname);
			{
				const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
				url = requestPathname + qs;
			}
			let isDataReq = false;
			const originalRenderUrl = url;
			if (isNextDataPathname(requestPathname)) {
				const dataMatch = pagesBuildId ? parseNextDataPathname(requestPathname, pagesBuildId) : null;
				if (!dataMatch) {
					await sendWebResponse(buildNextDataNotFoundResponse(), req, res, compress);
					return;
				}
				isDataReq = true;
				const qs = url.includes("?") ? url.slice(url.indexOf("?")) : "";
				const pagePathname = normalizeNextDataPagePathname(dataMatch.pagePathname, hasMiddleware && trailingSlash);
				url = pagePathname + qs;
				requestPathname = pagePathname;
				pathname = pagePathname;
				configMatchPathname = pagePathname;
			}
			const protocol = resolveRequestProtocol(req);
			const hostHeader = resolveRequestHost(req, `${host}:${port}`);
			const rawReqHeaders = nodeHeadersToWebHeaders(req.headers);
			const isDataRequest = isDataReq;
			const reqHeaders = filterInternalHeaders(rawReqHeaders);
			const method = req.method ?? "GET";
			const hasBody = method !== "GET" && method !== "HEAD";
			const result = await runPagesRequest(new Request(`${protocol}://${hostHeader}${url}`, {
				method,
				headers: reqHeaders,
				body: hasBody ? readNodeStream(req) : void 0,
				duplex: hasBody ? "half" : void 0
			}), {
				basePath,
				trailingSlash,
				i18nConfig,
				configRedirects,
				configRewrites,
				configHeaders,
				hadBasePath,
				isDataReq,
				isDataRequest,
				hasMiddleware,
				ctx: void 0,
				rawSearch: rawQs,
				configMatchPathname,
				matchPageRoute: matchPageRoute ?? null,
				runMiddleware: typeof runMiddleware === "function" ? wrapMiddlewareWithBasePath(runMiddleware, basePath, hadBasePath) : null,
				renderPage: typeof renderPage === "function" ? (request, resolvedUrl, options, stagedHeaders) => renderPage(request, resolvedUrl, ssrManifest, void 0, stagedHeaders, {
					...options,
					originalUrl: originalRenderUrl
				}) : null,
				handleApi: typeof handleApi === "function" ? (request, apiUrl) => handleApi(request, apiUrl, createNodeExecutionContext()) : null,
				serveFilesystemRoute: async (requestPathname, stagedHeaders, phase) => {
					if (req.method !== "GET" && req.method !== "HEAD" || requestPathname === "/" || requestPathname === "/api" || requestPathname.startsWith("/api/") || phase === "direct" && requestPathname.startsWith(`/_next/static/`)) return false;
					return tryServeStatic(req, res, clientDir, requestPathname, compress, staticCache, stagedHeaders);
				}
			});
			if (result.type === "handled") return;
			if (result.type === "response") {
				const { response } = result;
				if (missingBuildAsset && response.status === 404) {
					cancelResponseBody(response);
					res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
					res.end("Not Found");
					return;
				}
				if (isVinextStreamedHtmlResponse(response) || !response.body || result.defaultContentType === void 0) {
					await sendWebResponse(response, req, res, compress);
					return;
				}
				const responseBody = Buffer.from(await response.arrayBuffer());
				const ct = response.headers.get("content-type") ?? result.defaultContentType;
				const responseHeaders = {};
				response.headers.forEach((v, k) => {
					if (k === "set-cookie") return;
					responseHeaders[k] = v;
				});
				const setCookies = response.headers.getSetCookie?.() ?? [];
				if (setCookies.length > 0) responseHeaders["set-cookie"] = setCookies;
				const finalStatusText = response.statusText || void 0;
				sendCompressed(req, res, responseBody, ct, response.status, responseHeaders, compress, finalStatusText);
				return;
			}
			res.writeHead(404);
			res.end("This page could not be found");
		} catch (e) {
			console.error("[vinext] Server error:", e);
			if (!res.headersSent) {
				res.writeHead(500);
				res.end("Internal Server Error");
			}
		}
	};
	const server = createServer((req, res) => {
		handleRequest(req, res);
	});
	await new Promise((resolve) => {
		server.listen(port, host, () => {
			const addr = server.address();
			const actualPort = typeof addr === "object" && addr ? addr.port : port;
			if (!silent) logProdServerStarted(host, actualPort, purpose);
			resolve();
		});
	});
	const addr = server.address();
	return {
		server,
		port: typeof addr === "object" && addr ? addr.port : port
	};
}
//#endregion
export { COMPRESSIBLE_TYPES, COMPRESS_THRESHOLD, importServerEntryModule, mergeResponseHeaders, mergeWebResponse, negotiateEncoding, nodeToWebRequest, readNodeStream, rememberCurrentServerEntryImportMtime, resolveAppRouterAssetPath, resolveAppRouterPrerenderSeeder, resolveRequestHost as resolveHost, resolveServerEntryImportUrl, sendCompressed, sendWebResponse, startProdServer, trustProxy, trustedHosts, tryServeStatic };
