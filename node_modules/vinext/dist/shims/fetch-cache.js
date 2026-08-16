import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { getRequestExecutionContext } from "./request-context.js";
import { getDataCacheHandler } from "./cache-handler.js";
import { markDynamicUsage } from "./headers.js";
import { _hasPendingRevalidatedTag, _setRequestScopedCacheLife } from "./cache-request-state.js";
import { encodeCacheTags } from "../utils/encode-cache-tag.js";
//#region src/shims/fetch-cache.ts
/**
* Extended fetch() with Next.js caching semantics.
*
* Patches `globalThis.fetch` during server rendering to support:
*
*   fetch(url, { next: { revalidate: 60, tags: ['posts'] } })
*   fetch(url, { cache: 'force-cache' })
*   fetch(url, { cache: 'no-store' })
*
* Cached responses are stored via the pluggable CacheHandler, so
* revalidateTag() and revalidatePath() invalidate fetch-level caches.
*
* Usage (in server entry):
*   import { withFetchCache, cleanupFetchCache } from './fetch-cache';
*   const cleanup = withFetchCache();
*   try { ... render ... } finally { cleanup(); }
*
* Or use the async helper:
*   await runWithFetchCache(async () => { ... render ... });
*/
/**
* Headers excluded from the cache key. These are W3C trace context headers
* that can break request caching and deduplication.
* All other headers ARE included in the cache key, matching Next.js behavior.
*/
const HEADER_BLOCKLIST = ["traceparent", "tracestate"];
const CACHE_KEY_PREFIX = "v3";
const MAX_CACHE_KEY_BODY_BYTES = 1024 * 1024;
const ONE_YEAR_SECONDS = 31536e3;
var BodyTooLargeForCacheKeyError = class extends Error {
	constructor() {
		super("Fetch body too large for cache key generation");
	}
};
var SkipCacheKeyGenerationError = class extends Error {
	constructor() {
		super("Fetch body could not be serialized for cache key generation");
	}
};
/**
* Collect all headers from the request, excluding the blocklist.
* Merges headers from both the Request object and the init object,
* with init taking precedence (matching fetch() spec behavior).
*/
function collectHeaders(input, init) {
	const merged = {};
	if (input instanceof Request && input.headers) input.headers.forEach((v, k) => {
		merged[k] = v;
	});
	if (init?.headers) (init.headers instanceof Headers ? init.headers : new Headers(init.headers)).forEach((v, k) => {
		merged[k] = v;
	});
	for (const blocked of HEADER_BLOCKLIST) delete merged[blocked];
	return merged;
}
/**
* Check whether a fetch request carries any per-user auth headers.
* Used for the safety bypass (skip caching when auth headers are present
* without an explicit cache opt-in).
*/
const AUTH_HEADERS = [
	"authorization",
	"cookie",
	"x-api-key"
];
function hasAuthHeaders(input, init) {
	const headers = collectHeaders(input, init);
	return AUTH_HEADERS.some((name) => name in headers);
}
async function serializeFormData(formData, pushBodyChunk, getTotalBodyBytes) {
	for (const [key, val] of formData.entries()) {
		if (typeof val === "string") {
			pushBodyChunk(JSON.stringify([key, {
				kind: "string",
				value: val
			}]));
			continue;
		}
		if (val.size > MAX_CACHE_KEY_BODY_BYTES || getTotalBodyBytes() + val.size > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
		pushBodyChunk(JSON.stringify([key, {
			kind: "file",
			name: val.name,
			type: val.type,
			value: await val.text()
		}]));
	}
}
function getParsedFormContentType(contentType) {
	const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
	if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") return mediaType;
}
function stripMultipartBoundary(contentType) {
	const [type, ...params] = contentType.split(";");
	const keptParams = params.map((param) => param.trim()).filter(Boolean).filter((param) => !/^boundary\s*=/i.test(param));
	const normalizedType = type.trim().toLowerCase();
	return keptParams.length > 0 ? `${normalizedType}; ${keptParams.join("; ")}` : normalizedType;
}
async function readRequestBodyChunksWithinLimit(request) {
	const contentLengthHeader = request.headers.get("content-length");
	if (contentLengthHeader) {
		const contentLength = Number(contentLengthHeader);
		if (Number.isFinite(contentLength) && contentLength > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
	}
	const requestClone = request.clone();
	const contentType = requestClone.headers.get("content-type") ?? void 0;
	const reader = requestClone.body?.getReader();
	if (!reader) return {
		chunks: [],
		contentType
	};
	const chunks = [];
	let totalBodyBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBodyBytes += value.byteLength;
			if (totalBodyBytes > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
			chunks.push(value);
		}
	} catch (err) {
		reader.cancel().catch(() => {});
		throw err;
	}
	return {
		chunks,
		contentType
	};
}
/**
* Serialize request body into string chunks for cache key inclusion.
* Handles all body types: string, Uint8Array, ReadableStream, FormData, Blob,
* and Request object bodies.
* Returns the serialized body chunks and optionally stashes the original body
* on init as `_ogBody` so it can still be used after stream consumption.
*/
async function serializeBody(input, init) {
	if (!init?.body && !(input instanceof Request && input.body)) return { bodyChunks: [] };
	const bodyChunks = [];
	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	let totalBodyBytes = 0;
	let canonicalizedContentType;
	const pushBodyChunk = (chunk) => {
		totalBodyBytes += encoder.encode(chunk).byteLength;
		if (totalBodyBytes > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
		bodyChunks.push(chunk);
	};
	const getTotalBodyBytes = () => totalBodyBytes;
	if (init?.body instanceof Uint8Array) {
		if (init.body.byteLength > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
		pushBodyChunk(decoder.decode(init.body));
		init._ogBody = init.body;
	} else if (init?.body && typeof init.body.getReader === "function") {
		const [bodyForHashing, bodyForFetch] = init.body.tee();
		init._ogBody = bodyForFetch;
		const reader = bodyForHashing.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (typeof value === "string") pushBodyChunk(value);
				else {
					totalBodyBytes += value.byteLength;
					if (totalBodyBytes > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
					bodyChunks.push(decoder.decode(value, { stream: true }));
				}
			}
			const finalChunk = decoder.decode();
			if (finalChunk) pushBodyChunk(finalChunk);
		} catch (err) {
			await reader.cancel();
			if (err instanceof BodyTooLargeForCacheKeyError) throw err;
			throw new SkipCacheKeyGenerationError();
		}
	} else if (init?.body instanceof URLSearchParams) {
		init._ogBody = init.body;
		pushBodyChunk(init.body.toString());
	} else if (init?.body && typeof init.body.keys === "function") {
		const formData = init.body;
		init._ogBody = init.body;
		await serializeFormData(formData, pushBodyChunk, getTotalBodyBytes);
	} else if (init?.body && typeof init.body.arrayBuffer === "function") {
		const blob = init.body;
		if (blob.size > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
		pushBodyChunk(await blob.text());
		const arrayBuffer = await blob.arrayBuffer();
		init._ogBody = new Blob([arrayBuffer], { type: blob.type });
	} else if (typeof init?.body === "string") {
		if (init.body.length > MAX_CACHE_KEY_BODY_BYTES) throw new BodyTooLargeForCacheKeyError();
		pushBodyChunk(init.body);
		init._ogBody = init.body;
	} else if (input instanceof Request && input.body) {
		let chunks;
		let contentType;
		try {
			({chunks, contentType} = await readRequestBodyChunksWithinLimit(input));
		} catch (err) {
			if (err instanceof BodyTooLargeForCacheKeyError) throw err;
			throw new SkipCacheKeyGenerationError();
		}
		const formContentType = getParsedFormContentType(contentType);
		if (formContentType) try {
			await serializeFormData(await new Request(input.url, {
				method: input.method,
				headers: contentType ? { "content-type": contentType } : void 0,
				body: new Blob(chunks)
			}).formData(), pushBodyChunk, getTotalBodyBytes);
			canonicalizedContentType = formContentType === "multipart/form-data" && contentType ? stripMultipartBoundary(contentType) : void 0;
			return {
				bodyChunks,
				canonicalizedContentType
			};
		} catch (err) {
			if (err instanceof BodyTooLargeForCacheKeyError) throw err;
			throw new SkipCacheKeyGenerationError();
		}
		for (const chunk of chunks) pushBodyChunk(decoder.decode(chunk, { stream: true }));
		const finalChunk = decoder.decode();
		if (finalChunk) pushBodyChunk(finalChunk);
	}
	return {
		bodyChunks,
		canonicalizedContentType
	};
}
/**
* Generate a deterministic cache key from a fetch request.
*
* Matches Next.js behavior: the key is a SHA-256 hash of a JSON array
* containing URL, method, all headers (minus blocklist), all RequestInit
* options, and the serialized body.
*/
async function buildFetchCacheKey(input, init) {
	let url;
	let method = "GET";
	if (typeof input === "string") url = input;
	else if (input instanceof URL) url = input.toString();
	else {
		url = input.url;
		method = input.method || "GET";
	}
	if (init?.method) method = init.method;
	const headers = collectHeaders(input, init);
	const { bodyChunks, canonicalizedContentType } = await serializeBody(input, init);
	if (canonicalizedContentType) headers["content-type"] = canonicalizedContentType;
	const cacheString = JSON.stringify([
		CACHE_KEY_PREFIX,
		url,
		method,
		headers,
		init?.mode,
		init?.redirect,
		init?.credentials,
		init?.referrer,
		init?.referrerPolicy,
		init?.integrity,
		init?.cache,
		bodyChunks
	]);
	const buffer = new TextEncoder().encode(cacheString);
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	return Array.prototype.map.call(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}
const _PENDING_KEY = Symbol.for("vinext.fetchCache.pendingRefetches");
const _gPending = globalThis;
const pendingRefetches = _gPending[_PENDING_KEY] ??= /* @__PURE__ */ new Map();
const DEDUP_TIMEOUT_MS = 6e4;
/** @internal Reset dedup state — exposed for test isolation only. */
function _resetPendingRefetches() {
	pendingRefetches.clear();
}
const _ORIG_FETCH_KEY = Symbol.for("vinext.fetchCache.originalFetch");
const _gFetch = globalThis;
const originalFetch = _gFetch[_ORIG_FETCH_KEY] ??= globalThis.fetch;
const _FALLBACK_KEY = Symbol.for("vinext.fetchCache.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.fetchCache.als");
const _noop = () => {};
let _responseBodyRegistry;
if (globalThis.FinalizationRegistry) _responseBodyRegistry = new FinalizationRegistry((weakRef) => {
	const stream = weakRef.deref();
	if (stream && !stream.locked) stream.cancel("Response object has been garbage collected").then(_noop, _noop);
});
const _fallbackState = _g[_FALLBACK_KEY] ??= {
	cacheableFetchUrls: /* @__PURE__ */ new Set(),
	currentRequestTags: [],
	currentFetchSoftTags: [],
	currentFetchCacheMode: null,
	currentForceDynamicFetchDefault: false,
	dynamicFetchUrls: /* @__PURE__ */ new Set(),
	refreshStaleFetchesInForeground: false,
	isFetchDedupeActive: false,
	currentFetchDedupeEntries: /* @__PURE__ */ new Map()
};
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
/**
* Reset the fallback state for a new request.  Used by `withFetchCache()`
* in single-threaded contexts where ALS.run() isn't used.
*/
function _resetFallbackState(isFetchDedupeActive) {
	_fallbackState.cacheableFetchUrls = /* @__PURE__ */ new Set();
	_fallbackState.currentRequestTags = [];
	_fallbackState.currentFetchSoftTags = [];
	_fallbackState.currentFetchCacheMode = null;
	_fallbackState.currentForceDynamicFetchDefault = false;
	_fallbackState.dynamicFetchUrls = /* @__PURE__ */ new Set();
	_fallbackState.refreshStaleFetchesInForeground = false;
	_fallbackState.isFetchDedupeActive = isFetchDedupeActive;
	_fallbackState.currentFetchDedupeEntries = /* @__PURE__ */ new Map();
}
function getFetchObservationUrl(input) {
	return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}
function recordDynamicFetchObservation(input) {
	_getState().dynamicFetchUrls.add(getFetchObservationUrl(input));
}
function markUncachedFetchForPageOutput(input) {
	recordDynamicFetchObservation(input);
	markDynamicUsage();
}
function recordCacheableFetchObservation(input) {
	_getState().cacheableFetchUrls.add(getFetchObservationUrl(input));
}
function recordFiniteFetchRevalidate(revalidateSeconds) {
	if (Number.isFinite(revalidateSeconds) && revalidateSeconds > 0) _setRequestScopedCacheLife({ revalidate: revalidateSeconds });
}
function shouldRefreshStaleFetchInForeground() {
	return _getState().refreshStaleFetchesInForeground;
}
async function buildFetchCacheValue(response, tags, revalidateSeconds, options) {
	if (response.status !== 200) return null;
	const responseForCache = options?.cloneForReturn === false ? response : response.clone();
	const body = await responseForCache.text();
	const headers = {};
	responseForCache.headers.forEach((v, k) => {
		if (k.toLowerCase() === "set-cookie") return;
		headers[k] = v;
	});
	return {
		kind: "FETCH",
		data: {
			headers,
			body,
			url: response.url,
			status: responseForCache.status
		},
		tags,
		revalidate: revalidateSeconds
	};
}
async function writeFetchCacheResponse(handler, cacheKey, response, tags, revalidateSeconds, options) {
	const cacheValue = await buildFetchCacheValue(response, tags, revalidateSeconds, options);
	if (!cacheValue) return;
	await handler.set(cacheKey, cacheValue, {
		fetchCache: true,
		tags,
		revalidate: revalidateSeconds
	});
}
async function lowerFetchCacheRevalidateIfNeeded(handler, cacheKey, cachedValue, tags, revalidateSeconds) {
	if (!Number.isFinite(revalidateSeconds) || revalidateSeconds <= 0 || typeof cachedValue.revalidate !== "number" || cachedValue.revalidate <= revalidateSeconds) return;
	const mergedTags = Array.from(/* @__PURE__ */ new Set([...cachedValue.tags ?? [], ...tags]));
	const updatedValue = {
		...cachedValue,
		tags: mergedTags,
		revalidate: revalidateSeconds
	};
	await handler.set(cacheKey, updatedValue, {
		fetchCache: true,
		tags: mergedTags,
		revalidate: revalidateSeconds
	});
}
function peekCacheableFetchObservations() {
	return [..._getState().cacheableFetchUrls].sort();
}
function peekDynamicFetchObservations() {
	return [..._getState().dynamicFetchUrls].sort();
}
function consumeDynamicFetchObservations() {
	const state = _getState();
	const observed = [...state.dynamicFetchUrls].sort();
	state.dynamicFetchUrls = /* @__PURE__ */ new Set();
	return observed;
}
/**
* Get tags collected during the current render pass.
* Useful for associating page-level cache entries with all the
* fetch tags used during rendering.
*/
function getCollectedFetchTags() {
	return [..._getState().currentRequestTags];
}
/**
* Append cache tags to the current request's collected tags.
*
* Mirrors Next.js's `propagateCacheLifeAndTagsToRevalidateStore`: tags declared
* inside a `"use cache"` function (via `cacheTag()`, persisted on the data cache
* entry) must also bubble up to the surrounding page / route-handler ISR entry
* so `revalidateTag()` / `revalidatePath()` can evict the rendered output, not
* just the inner data cache entry. Without this, a cached `"use cache"` result
* keeps being served from a stale page/route entry after its tag is revalidated
* (issue #1453). Tags are already encoded by the caller; deduped to match the
* tagged-fetch path. A no-op for empty input.
*/
function addCollectedRequestTags(tags) {
	if (tags.length === 0) return;
	const reqTags = _getState().currentRequestTags;
	for (const tag of tags) if (!reqTags.includes(tag)) reqTags.push(tag);
}
/**
* Set path-derived implicit tags for fetch cache reads in the current render.
*
* These are intentionally not persisted on fetch entries. They mirror Next.js
* `softTags`: `revalidatePath()` should make a fetch miss while rendering the
* affected route, without permanently coupling a shared fetch entry to one path.
*/
function setCurrentFetchSoftTags(tags) {
	_getState().currentFetchSoftTags = [...tags];
}
/**
* Read the path-derived soft tags for the current render.
*
* Used by the "use cache" runtime to pass soft tags to the cache handler
* so that `revalidatePath()` invalidates "use cache" entries during the
* affected route's next request, even when the entry carries no hard tags.
*/
function getCurrentFetchSoftTags() {
	return _getState().currentFetchSoftTags;
}
function setCurrentFetchCacheMode(mode) {
	_getState().currentFetchCacheMode = mode;
}
function setCurrentForceDynamicFetchDefault(enabled) {
	_getState().currentForceDynamicFetchDefault = enabled;
}
function setRefreshStaleFetchesInForeground(enabled) {
	_getState().refreshStaleFetchesInForeground = enabled;
}
function isNoStoreFetch(cacheDirective, nextOpts) {
	return cacheDirective === "no-store" || cacheDirective === "no-cache" || nextOpts?.revalidate === 0;
}
function isCacheableFetch(cacheDirective, nextOpts) {
	return cacheDirective === "force-cache" || nextOpts?.revalidate === false || typeof nextOpts?.revalidate === "number" && nextOpts.revalidate > 0;
}
function hasExplicitRevalidateValue(nextOpts) {
	return nextOpts?.revalidate !== void 0;
}
function isFalsyRevalidate(nextOpts) {
	return !nextOpts?.revalidate;
}
function resolveSegmentCacheDirective(cacheDirective, nextOpts, mode, forceDynamicFetchDefault) {
	if (forceDynamicFetchDefault && (!mode || mode === "auto") && (cacheDirective === void 0 || cacheDirective === "default") && isFalsyRevalidate(nextOpts)) return "no-store";
	if (!mode || mode === "auto") return cacheDirective;
	switch (mode) {
		case "force-cache": return "force-cache";
		case "force-no-store": return "no-store";
		case "only-cache":
			if (isNoStoreFetch(cacheDirective, nextOpts)) throw new Error("Route segment config `fetchCache = \"only-cache\"` conflicts with no-store fetch.");
			return cacheDirective ?? "force-cache";
		case "only-no-store":
			if (isCacheableFetch(cacheDirective, nextOpts)) throw new Error("Route segment config `fetchCache = \"only-no-store\"` conflicts with cacheable fetch.");
			return cacheDirective ?? "no-store";
		case "default-cache": return cacheDirective ?? (hasExplicitRevalidateValue(nextOpts) ? void 0 : "force-cache");
		case "default-no-store": return cacheDirective ?? (hasExplicitRevalidateValue(nextOpts) ? void 0 : "no-store");
	}
	return cacheDirective;
}
function getFetchCacheDirective(input, init) {
	if (init?.cache !== void 0) return init.cache;
	if (!(input instanceof Request) || input.cache === "default") return;
	return input.cache;
}
function buildFetchDedupeKey(request) {
	const filteredHeaders = Array.from(request.headers.entries()).filter(([key]) => !HEADER_BLOCKLIST.includes(key.toLowerCase()));
	return JSON.stringify([
		request.method,
		filteredHeaders,
		request.mode,
		request.redirect,
		request.credentials,
		request.referrer,
		request.referrerPolicy,
		request.integrity
	]);
}
function createFetchDedupeCandidate(input, init) {
	if (init?.signal) return null;
	const method = init?.method?.toUpperCase();
	if (method && method !== "GET" && method !== "HEAD") return null;
	if (init?.keepalive) return null;
	const request = typeof input === "string" || input instanceof URL ? new Request(input, init) : input;
	if (request.method !== "GET" && request.method !== "HEAD" || request.keepalive) return null;
	return {
		url: request.url,
		key: buildFetchDedupeKey(request)
	};
}
function buildDedupeClone(body, source) {
	const cloned = new Response(body, {
		status: source.status,
		statusText: source.statusText,
		headers: new Headers(source.headers)
	});
	Object.defineProperty(cloned, "url", {
		value: source.url,
		configurable: true,
		enumerable: true,
		writable: false
	});
	if (_responseBodyRegistry && cloned.body) _responseBodyRegistry.register(cloned, new WeakRef(cloned.body));
	return cloned;
}
function cloneDedupeResponse(response) {
	if (!response.body) return [buildDedupeClone(null, response), buildDedupeClone(null, response)];
	const [body1, body2] = response.body.tee();
	return [buildDedupeClone(body1, response), buildDedupeClone(body2, response)];
}
function buildCachedFetchResponse(data, input) {
	const response = new Response(data.body, {
		status: data.status ?? 200,
		headers: data.headers
	});
	Object.defineProperty(response, "url", {
		value: data.url ?? getFetchObservationUrl(input),
		configurable: true,
		enumerable: true,
		writable: false
	});
	if (_responseBodyRegistry && response.body) _responseBodyRegistry.register(response, new WeakRef(response.body));
	return response;
}
function dedupeFetch(input, init) {
	const state = _getState();
	if (!state.isFetchDedupeActive) return originalFetch(input, init);
	const candidate = createFetchDedupeCandidate(input, init);
	if (!candidate) return originalFetch(input, init);
	const entriesByUrl = state.currentFetchDedupeEntries;
	let entries = entriesByUrl.get(candidate.url);
	if (!entries) {
		entries = [];
		entriesByUrl.set(candidate.url, entries);
	}
	for (const entry of entries) {
		if (entry.key !== candidate.key) continue;
		return entry.promise.then(() => {
			if (!entry.response) throw new Error("[vinext] Missing deduped fetch response");
			const [responseForCaller, responseForFutureCaller] = cloneDedupeResponse(entry.response);
			entry.response = responseForFutureCaller;
			return responseForCaller;
		});
	}
	const promise = originalFetch(input, init);
	const entry = {
		key: candidate.key,
		promise,
		response: null
	};
	entries.push(entry);
	return promise.then((response) => {
		const [responseForCaller, responseForFutureCaller] = cloneDedupeResponse(response);
		entry.response = responseForFutureCaller;
		return responseForCaller;
	}, (err) => {
		const idx = entries.indexOf(entry);
		if (idx !== -1) entries.splice(idx, 1);
		throw err;
	});
}
/**
* Create a patched fetch function with Next.js caching semantics.
*
* The patched fetch:
* 1. Checks `cache` and `next` options to determine caching behavior
* 2. On cache hit, returns the cached response without hitting the network
* 3. On cache miss, fetches from network, stores in cache, returns response
* 4. Respects `next.revalidate` for TTL-based revalidation
* 5. Respects `next.tags` for tag-based invalidation via revalidateTag()
*/
function createPatchedFetch() {
	return async function patchedFetch(input, init) {
		const nextOpts = init?.next;
		const cacheDirective = resolveSegmentCacheDirective(getFetchCacheDirective(input, init), nextOpts, _getState().currentFetchCacheMode, _getState().currentForceDynamicFetchDefault);
		if (!nextOpts && !cacheDirective) {
			recordDynamicFetchObservation(input);
			return dedupeFetch(input, init);
		}
		if (cacheDirective === "no-store" || cacheDirective === "no-cache" || nextOpts?.revalidate === 0) {
			const cleanInit = stripNextFromInit(init, cacheDirective);
			markUncachedFetchForPageOutput(input);
			return dedupeFetch(input, cleanInit);
		}
		if (!(cacheDirective === "force-cache" || nextOpts?.revalidate === false || typeof nextOpts?.revalidate === "number" && nextOpts.revalidate > 0) && hasAuthHeaders(input, init)) {
			const cleanInit = stripNextFromInit(init, cacheDirective);
			recordDynamicFetchObservation(input);
			return dedupeFetch(input, cleanInit);
		}
		let revalidateSeconds;
		if (cacheDirective === "force-cache") revalidateSeconds = nextOpts?.revalidate && typeof nextOpts.revalidate === "number" ? nextOpts.revalidate : ONE_YEAR_SECONDS;
		else if (nextOpts?.revalidate === false) revalidateSeconds = ONE_YEAR_SECONDS;
		else if (typeof nextOpts?.revalidate === "number" && nextOpts.revalidate > 0) revalidateSeconds = nextOpts.revalidate;
		else if (nextOpts?.tags && nextOpts.tags.length > 0) revalidateSeconds = ONE_YEAR_SECONDS;
		else {
			const cleanInit = stripNextFromInit(init, cacheDirective);
			recordDynamicFetchObservation(input);
			return dedupeFetch(input, cleanInit);
		}
		recordCacheableFetchObservation(input);
		recordFiniteFetchRevalidate(revalidateSeconds);
		const reqTags = _getState().currentRequestTags;
		const tags = encodeCacheTags(nextOpts?.tags ?? []);
		if (tags.length > 0) {
			for (const tag of tags) if (!reqTags.includes(tag)) reqTags.push(tag);
		}
		const softTags = _getState().currentFetchSoftTags;
		let fetchInit = stripNextFromInit(init, cacheDirective);
		let cacheKey;
		try {
			cacheKey = await buildFetchCacheKey(input, fetchInit);
			fetchInit = stripNextFromInit(fetchInit, cacheDirective);
		} catch (err) {
			if (err instanceof BodyTooLargeForCacheKeyError || err instanceof SkipCacheKeyGenerationError) {
				fetchInit = stripNextFromInit(fetchInit, cacheDirective);
				recordDynamicFetchObservation(input);
				return dedupeFetch(input, fetchInit);
			}
			throw err;
		}
		const handler = getDataCacheHandler();
		let mustBypassPendingRevalidation = _hasPendingRevalidatedTag([...tags, ...softTags]);
		try {
			let cached = mustBypassPendingRevalidation ? null : await handler.get(cacheKey, {
				kind: "FETCH",
				tags,
				softTags,
				revalidate: revalidateSeconds
			});
			if (cached?.value?.kind === "FETCH" && _hasPendingRevalidatedTag([
				...cached.value.tags ?? [],
				...tags,
				...softTags
			])) {
				mustBypassPendingRevalidation = true;
				cached = null;
			}
			if (cached?.value && cached.value.kind === "FETCH" && cached.cacheState !== "stale") {
				await lowerFetchCacheRevalidateIfNeeded(handler, cacheKey, cached.value, tags, revalidateSeconds);
				const cachedData = cached.value.data;
				return buildCachedFetchResponse(cachedData, input);
			}
			if (cached?.value && cached.value.kind === "FETCH" && cached.cacheState === "stale") {
				if (shouldRefreshStaleFetchInForeground()) {
					const freshResponse = await dedupeFetch(input, fetchInit);
					await writeFetchCacheResponse(handler, cacheKey, freshResponse, tags, revalidateSeconds);
					return freshResponse;
				}
				const staleData = cached.value.data;
				if (!pendingRefetches.has(cacheKey)) {
					const refetchPromise = originalFetch(input, fetchInit).then(async (freshResp) => {
						await writeFetchCacheResponse(handler, cacheKey, freshResp, tags, revalidateSeconds, { cloneForReturn: false });
					}).catch((err) => {
						const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
						console.error(`[vinext] fetch cache background revalidation failed for ${url} (key=${cacheKey.slice(0, 12)}...):`, err);
					}).finally(() => {
						if (pendingRefetches.get(cacheKey) === refetchPromise) pendingRefetches.delete(cacheKey);
						clearTimeout(timeoutId);
					});
					pendingRefetches.set(cacheKey, refetchPromise);
					const timeoutId = setTimeout(() => {
						if (pendingRefetches.get(cacheKey) === refetchPromise) pendingRefetches.delete(cacheKey);
					}, DEDUP_TIMEOUT_MS);
					getRequestExecutionContext()?.waitUntil(refetchPromise);
				}
				return buildCachedFetchResponse(staleData, input);
			}
		} catch (cacheErr) {
			console.error("[vinext] fetch cache read error:", cacheErr);
		}
		const response = await (mustBypassPendingRevalidation ? originalFetch(input, fetchInit) : dedupeFetch(input, fetchInit));
		const cacheValue = await buildFetchCacheValue(response, tags, revalidateSeconds);
		if (cacheValue) handler.set(cacheKey, cacheValue, {
			fetchCache: true,
			tags,
			revalidate: revalidateSeconds
		}).catch((err) => {
			console.error("[vinext] fetch cache write error:", err);
		});
		return response;
	};
}
/**
* Strip the `next` property from RequestInit before passing to real fetch.
* The `next` property is not a standard fetch option and would cause warnings
* in some environments.
*/
function stripNextFromInit(init, cacheOverride) {
	if (!init) return cacheOverride === void 0 ? void 0 : { cache: cacheOverride };
	const { next: _next, _ogBody, ...rest } = init;
	if (cacheOverride !== void 0) rest.cache = cacheOverride;
	if (_ogBody !== void 0) rest.body = _ogBody;
	return Object.keys(rest).length > 0 ? rest : void 0;
}
const _PATCH_KEY = Symbol.for("vinext.fetchCache.patchInstalled");
function _ensurePatchInstalled() {
	if (_g[_PATCH_KEY]) return;
	_g[_PATCH_KEY] = true;
	globalThis.fetch = createPatchedFetch();
}
/**
* Install the patched fetch and reset per-request tag state.
* Returns a cleanup function that clears tags.
*
* @deprecated Prefer `runWithFetchCache()` which uses `AsyncLocalStorage.run()`
* for proper per-request isolation in concurrent environments.
*
* Usage:
*   const cleanup = withFetchCache();
*   try { await render(); } finally { cleanup(); }
*/
function withFetchCache() {
	_ensurePatchInstalled();
	_resetFallbackState(true);
	return () => {
		_resetFallbackState(false);
	};
}
/**
* Run an async function with patched fetch caching enabled.
* Uses `AsyncLocalStorage.run()` for proper per-request isolation
* of collected fetch tags in concurrent server environments.
*/
async function runWithFetchCache(fn) {
	_ensurePatchInstalled();
	if (isInsideUnifiedScope()) return await runWithUnifiedStateMutation((uCtx) => {
		uCtx.cacheableFetchUrls = /* @__PURE__ */ new Set();
		uCtx.currentRequestTags = [];
		uCtx.currentFetchSoftTags = [];
		uCtx.dynamicFetchUrls = /* @__PURE__ */ new Set();
		uCtx.refreshStaleFetchesInForeground = false;
		uCtx.isFetchDedupeActive = true;
		uCtx.currentFetchDedupeEntries = /* @__PURE__ */ new Map();
	}, fn);
	return _als.run({
		cacheableFetchUrls: /* @__PURE__ */ new Set(),
		currentRequestTags: [],
		currentFetchSoftTags: [],
		currentFetchCacheMode: null,
		currentForceDynamicFetchDefault: false,
		dynamicFetchUrls: /* @__PURE__ */ new Set(),
		refreshStaleFetchesInForeground: false,
		isFetchDedupeActive: true,
		currentFetchDedupeEntries: /* @__PURE__ */ new Map()
	}, fn);
}
function runWithFetchDedupe(fn) {
	_ensurePatchInstalled();
	const state = _getState();
	if (state.isFetchDedupeActive) return fn();
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.isFetchDedupeActive = true;
		uCtx.currentFetchDedupeEntries = /* @__PURE__ */ new Map();
	}, fn);
	return _als.run({
		...state,
		isFetchDedupeActive: true,
		currentFetchDedupeEntries: /* @__PURE__ */ new Map()
	}, fn);
}
/**
* Install the patched fetch without creating a standalone ALS scope.
*
* `runWithFetchCache()` is the standalone helper: it installs the patch and
* creates an isolated per-request tag store. The unified request context owns
* that isolation itself via `currentRequestTags`, so callers inside
* `runWithRequestContext()` only need the process-global fetch monkey-patch.
*/
function ensureFetchPatch() {
	_ensurePatchInstalled();
}
/**
* Get the original (unpatched) fetch function.
* Useful for internal code that should bypass caching.
*/
function getOriginalFetch() {
	return originalFetch;
}
//#endregion
export { _resetPendingRefetches, addCollectedRequestTags, consumeDynamicFetchObservations, ensureFetchPatch, getCollectedFetchTags, getCurrentFetchSoftTags, getOriginalFetch, peekCacheableFetchObservations, peekDynamicFetchObservations, runWithFetchCache, runWithFetchDedupe, setCurrentFetchCacheMode, setCurrentFetchSoftTags, setCurrentForceDynamicFetchDefault, setRefreshStaleFetchesInForeground, withFetchCache };
