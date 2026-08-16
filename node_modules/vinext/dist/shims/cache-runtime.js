import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { VINEXT_RSC_MARKER_HEADER } from "../server/headers.js";
import { getDataCacheHandler } from "./cache-handler.js";
import { trackPprFallbackShellCacheTask } from "./ppr-fallback-shell.js";
import { markDynamicUsage } from "./headers.js";
import { _hasPendingRevalidatedTag, _registerCacheContextAccessor, _setRequestScopedCacheLife, cacheLifeProfiles } from "./cache-request-state.js";
import { addCollectedRequestTags, getCurrentFetchSoftTags } from "./fetch-cache.js";
import { isMarkedAppPagePropsObject, markAppPagePropsForUseCache } from "./internal/app-page-props-cache-key.js";
//#region src/shims/cache-runtime.ts
/**
* "use cache" runtime
*
* This module provides the runtime for "use cache" directive support.
* Functions marked with "use cache" are transformed by the vinext:use-cache
* Vite plugin to wrap them with `registerCachedFunction()`.
*
* The runtime:
* 1. Generates a cache key from deployment/build ID + function identity + serialized arguments
* 2. Checks the CacheHandler for a cached value
* 3. On HIT: returns the cached value (deserialized via RSC stream)
* 4. On MISS: creates an AsyncLocalStorage context for cacheLife/cacheTag,
*    calls the original function, serializes the result via RSC stream,
*    collects metadata, stores the result
*
* Serialization uses the RSC protocol (renderToReadableStream /
* createFromReadableStream / encodeReply) from @vitejs/plugin-rsc.
* This correctly handles React elements, client references, Promises,
* and all RSC-serializable types — unlike JSON.stringify which silently
* drops $$typeof Symbols and function values.
*
* When RSC APIs are unavailable (e.g. in unit tests), falls back to
* JSON.stringify/parse with the same stableStringify cache key generation.
*
* Cache variants:
* - "use cache"           — shared cache (default profile)
* - "use cache: remote"   — shared cache (explicit)
* - "use cache: private"  — per-request cache (not shared across requests)
*/
/** Threshold below which expire is considered "dynamic" (5 minutes in seconds). */
const DYNAMIC_EXPIRE = 300;
/**
* Used purely as `cause` for the nested-dynamic cache error: its captured stack
* points at the inner "use cache" invocation that propagated a dynamic cache
* life up to the outer cache. Constructed eagerly while the caller is still on
* the synchronous stack.
*/
var NestedDynamicUseCacheError = class extends Error {
	constructor() {
		super("This \"use cache\" has a dynamic cache life that was propagated to its parent.");
		this.name = "Nested dynamic \"use cache\"";
	}
};
/**
* Returns the human-readable phrase describing the current context for use in
* nested-dynamic error messages. The throw is gated to fire only during the
* build's prerender phase (`VINEXT_PRERENDER=1`) or development; this phrase
* tells the user which one they're in so the message isn't misleading.
*
* `VINEXT_PRERENDER` takes priority over `NODE_ENV=development`: if the
* prerender flag is set, the user really is prerendering regardless of
* NODE_ENV (this matters for scenarios like a dev-config prerender). Defaults
* to "during prerendering" to match Next.js wording when called from a
* context we don't recognize (the throw also wouldn't fire in that case).
*/
function nestedCacheContextPhrase() {
	if (typeof process === "undefined") return "during prerendering";
	if (process.env.VINEXT_PRERENDER === "1") return "during prerendering";
	if (process.env.NODE_ENV === "development") return "in development";
	return "during prerendering";
}
function getNestedCacheZeroRevalidateErrorMessage() {
	return `A "use cache" with zero \`revalidate\` is nested inside another "use cache" that has no explicit \`cacheLife\`, which is not allowed ${nestedCacheContextPhrase()}. Add \`cacheLife()\` to the outer "use cache" to choose whether it should be prerendered (with non-zero \`revalidate\`) or remain dynamic (with zero \`revalidate\`). Read more: https://nextjs.org/docs/messages/nested-use-cache-no-explicit-cachelife`;
}
function getNestedCacheShortExpireErrorMessage() {
	return `A "use cache" with short \`expire\` (under 5 minutes) is nested inside another "use cache" that has no explicit \`cacheLife\`, which is not allowed ${nestedCacheContextPhrase()}. Add \`cacheLife()\` to the outer "use cache" to choose whether it should be prerendered (with longer \`expire\`) or remain dynamic (with short \`expire\`). Read more: https://nextjs.org/docs/messages/nested-use-cache-no-explicit-cachelife`;
}
const cacheContextStorage = getOrCreateAls("vinext.cacheRuntime.contextAls");
_registerCacheContextAccessor(() => cacheContextStorage.getStore() ?? null);
/**
* Get the current cache context. Returns null if not inside a "use cache" function.
*/
function getCacheContext() {
	return cacheContextStorage.getStore() ?? null;
}
function getUseCacheDeploymentIdDefine() {
	try {
		return process.env.__VINEXT_DEPLOYMENT_ID || process.env.NEXT_DEPLOYMENT_ID;
	} catch (error) {
		if (error instanceof ReferenceError) return void 0;
		throw error;
	}
}
function getUseCacheBuildIdDefine() {
	try {
		return process.env.__VINEXT_BUILD_ID;
	} catch (error) {
		if (error instanceof ReferenceError) return void 0;
		throw error;
	}
}
function getUseCacheKeySeed() {
	return getUseCacheDeploymentIdDefine() || getUseCacheBuildIdDefine();
}
/**
* Build the shared-cache key for a "use cache" function from its build-scoped
* identity and serialized arguments.
*
* This is a logical handler key, not a storage key. Backend-specific adapters
* are responsible for mapping it to their physical key constraints after
* applying any storage prefixes.
*
* Exported for testing.
*/
function buildUseCacheKey(id, keySeed, argsKey) {
	const scopedId = keySeed ? `build:${encodeURIComponent(keySeed)}:${id}` : id;
	return argsKey === void 0 ? `use-cache:${scopedId}` : `use-cache:${scopedId}:${argsKey}`;
}
const NOT_LOADED = Symbol("not-loaded");
let _rscModule = NOT_LOADED;
async function getRscModule() {
	if (_rscModule !== NOT_LOADED) return _rscModule;
	try {
		_rscModule = await import("@vitejs/plugin-rsc/react/rsc");
	} catch {
		_rscModule = null;
	}
	return _rscModule;
}
/** Collect a ReadableStream<Uint8Array> into a single Uint8Array. */
async function collectStream(stream) {
	const reader = stream.getReader();
	const chunks = [];
	let totalLength = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		totalLength += value.length;
	}
	if (chunks.length === 1) return chunks[0];
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}
/** Encode a Uint8Array as a base64 string for storage. Uses Node Buffer. */
function uint8ToBase64(bytes) {
	return Buffer.from(bytes).toString("base64");
}
/** Decode a base64 string back to Uint8Array. Uses Node Buffer. */
function base64ToUint8(base64) {
	return new Uint8Array(Buffer.from(base64, "base64"));
}
/** Create a ReadableStream from a Uint8Array. */
function uint8ToStream(bytes) {
	return new ReadableStream({ start(controller) {
		controller.enqueue(bytes);
		controller.close();
	} });
}
/**
* Convert an encodeReply result (string | FormData) to a cache key string.
* For FormData (binary args), produces a deterministic SHA-256 hash over
* the sorted entries. We can't hash `new Response(formData).arrayBuffer()`
* because multipart boundaries are non-deterministic across serializations.
*
* Exported for testing.
*/
async function replyToCacheKey(reply) {
	if (typeof reply === "string") return reply;
	const entries = [...reply.entries()];
	const valStr = (v) => typeof v === "string" ? v : v.name;
	entries.sort((a, b) => a[0].localeCompare(b[0]) || valStr(a[1]).localeCompare(valStr(b[1])));
	const parts = [];
	for (const [name, value] of entries) if (typeof value === "string") parts.push(`${name}=s:${value}`);
	else {
		const bytes = new Uint8Array(await value.arrayBuffer());
		parts.push(`${name}=b:${value.type}:${value.size}:${Buffer.from(bytes).toString("base64")}`);
	}
	const payload = new TextEncoder().encode(parts.join("\0"));
	const hashBuffer = await crypto.subtle.digest("SHA-256", payload);
	return Buffer.from(new Uint8Array(hashBuffer)).toString("base64url");
}
/**
* Resolve collected cacheLife configs into a single effective config.
* The "minimum-wins" rule: if multiple cacheLife() calls are made,
* each field takes the smallest value across all calls.
*/
function resolveCacheLife(configs) {
	if (configs.length === 0) return { ...cacheLifeProfiles.default };
	if (configs.length === 1) return { ...configs[0] };
	const result = {};
	for (const config of configs) {
		if (config.stale !== void 0) result.stale = result.stale !== void 0 ? Math.min(result.stale, config.stale) : config.stale;
		if (config.revalidate !== void 0) result.revalidate = result.revalidate !== void 0 ? Math.min(result.revalidate, config.revalidate) : config.revalidate;
		if (config.expire !== void 0) result.expire = result.expire !== void 0 ? Math.min(result.expire, config.expire) : config.expire;
	}
	return result;
}
const _PRIVATE_FALLBACK_KEY = Symbol.for("vinext.cacheRuntime.privateFallback");
const _g = globalThis;
const _privateAls = getOrCreateAls("vinext.cacheRuntime.privateAls");
const _privateFallbackState = _g[_PRIVATE_FALLBACK_KEY] ??= { _privateCache: /* @__PURE__ */ new Map() };
function _getPrivateState() {
	if (isInsideUnifiedScope()) {
		const ctx = getRequestContext();
		if (ctx._privateCache === null) ctx._privateCache = /* @__PURE__ */ new Map();
		return ctx;
	}
	return _privateAls.getStore() ?? _privateFallbackState;
}
function runWithPrivateCache(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx._privateCache = /* @__PURE__ */ new Map();
	}, fn);
	const state = { _privateCache: /* @__PURE__ */ new Map() };
	return _privateAls.run(state, fn);
}
/**
* Clear the private per-request cache. Should be called at the start of each request.
* Only needed when not using runWithPrivateCache() (legacy path).
*/
function clearPrivateCache() {
	if (isInsideUnifiedScope()) {
		getRequestContext()._privateCache = /* @__PURE__ */ new Map();
		return;
	}
	const state = _privateAls.getStore();
	if (state) state._privateCache = /* @__PURE__ */ new Map();
	else _privateFallbackState._privateCache = /* @__PURE__ */ new Map();
}
/**
* Register a function as a cached function. This is called by the Vite
* transform for each "use cache" function.
*
* @param fn - The original async function
* @param id - A stable identifier for the function (module path + export name)
* @param variant - Cache variant: "" (default/shared), "remote", "private"
* @returns A wrapper function that checks cache before calling the original
*/
function registerCachedFunction(fn, id, variant, options = {}) {
	const cacheVariant = variant ?? "";
	const omitAppPageSearchParamsFromFirstArg = options.appPageDefaultExport === true;
	const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
	const cachedFn = (...args) => trackPprFallbackShellCacheTask(async () => {
		const rsc = await getRscModule();
		const keySeed = getUseCacheKeySeed();
		let cacheKey;
		try {
			const processedArgs = args.length > 0 ? unwrapThenableObjectArray(args, { omitAppPageSearchParamsFromFirstArg }) : [];
			if (rsc && args.length > 0) {
				const tempRefs = rsc.createClientTemporaryReferenceSet();
				cacheKey = buildUseCacheKey(id, keySeed, await replyToCacheKey(await rsc.encodeReply(processedArgs, { temporaryReferences: tempRefs })));
			} else cacheKey = buildUseCacheKey(id, keySeed, processedArgs.length > 0 ? stableStringify(processedArgs) : void 0);
		} catch {
			return fn(...args);
		}
		if (cacheVariant === "private") {
			const parentCtx = cacheContextStorage.getStore();
			if (parentCtx && parentCtx.variant !== "private") throwPrivateUseCacheInsidePublicUseCacheError();
			if (typeof process !== "undefined" && process.env.VINEXT_PRERENDER === "1") markDynamicUsage();
			const privateCache = _getPrivateState()._privateCache;
			const privateHit = privateCache.get(cacheKey);
			if (privateHit !== void 0) return privateHit;
			const result = await executeWithContext(fn, args, cacheVariant);
			privateCache.set(cacheKey, result);
			return result;
		}
		if (isDev) return executeWithContext(fn, args, cacheVariant);
		const handler = getDataCacheHandler();
		const softTags = getCurrentFetchSoftTags();
		let existing = null;
		if (!_hasPendingRevalidatedTag(softTags)) try {
			existing = await handler.get(cacheKey, {
				kind: "FETCH",
				softTags
			});
		} catch (error) {
			console.error("[vinext] use cache: handler.get failed; treating as a cache miss:", error);
		}
		if (existing?.value && existing.value.kind === "FETCH" && existing.cacheState !== "stale" && !_hasPendingRevalidatedTag([...existing.value.tags ?? [], ...softTags])) try {
			propagateCacheTagsToRequest(existing.value.tags);
			if (rsc && existing.value.data.headers["x-vinext-rsc"] === "1") {
				const stream = uint8ToStream(base64ToUint8(existing.value.data.body));
				const result = await rsc.createFromReadableStream(stream);
				recordRequestScopedCacheControl(existing.cacheControl);
				return result;
			}
			const result = JSON.parse(existing.value.data.body);
			recordRequestScopedCacheControl(existing.cacheControl);
			return result;
		} catch {}
		const { result, ctx, effectiveLife } = await runCachedFunctionWithContext(fn, args, cacheVariant);
		recordRequestScopedCacheLife(effectiveLife);
		propagateCacheTagsToRequest(ctx.tags);
		const revalidateSeconds = effectiveLife.revalidate ?? cacheLifeProfiles.default.revalidate ?? 900;
		try {
			let body;
			const headers = {};
			if (rsc) {
				body = uint8ToBase64(await collectStream(rsc.renderToReadableStream(result)));
				headers[VINEXT_RSC_MARKER_HEADER] = "1";
			} else {
				body = JSON.stringify(result);
				if (body === void 0) return result;
			}
			const cacheValue = {
				kind: "FETCH",
				data: {
					headers,
					body,
					url: cacheKey
				},
				tags: ctx.tags,
				revalidate: revalidateSeconds
			};
			await handler.set(cacheKey, cacheValue, {
				fetchCache: true,
				tags: ctx.tags,
				cacheControl: {
					revalidate: revalidateSeconds,
					expire: effectiveLife.expire
				}
			});
		} catch {}
		return result;
	}, cacheVariant);
	Object.defineProperty(cachedFn, "length", {
		value: fn.length,
		configurable: true
	});
	cachedFn[USE_CACHE_FUNCTION_SYMBOL] = true;
	return cachedFn;
}
/** @internal Symbol used to identify "use cache" wrapper functions. */
const USE_CACHE_FUNCTION_SYMBOL = Symbol.for("vinext.useCacheFunction");
function throwPrivateUseCacheInsidePublicUseCacheError() {
	const error = /* @__PURE__ */ new Error("\"use cache: private\" must not be used within \"use cache\". It can only be nested inside of another \"use cache: private\".");
	const ctx = getRequestContext();
	if (ctx) ctx.invalidDynamicUsageError = error;
	throw error;
}
function recordRequestScopedCacheControl(cacheControl) {
	if (cacheControl === void 0) return;
	_setRequestScopedCacheLife({
		revalidate: cacheControl.revalidate,
		expire: cacheControl.expire
	});
}
function recordRequestScopedCacheLife(cacheLife) {
	_setRequestScopedCacheLife(cacheLife);
}
/**
* Bubble a `"use cache"` scope's tags toward where they can drive invalidation.
*
* When this cache is nested inside another (`parentCtx` present), the tags flow
* into the parent scope so they end up on the outer cache entry — mirroring
* Next.js's `propagateCacheLifeAndTagsToRevalidateStore`. The outermost scope
* (no parent) instead records onto the surrounding request's collected tags, so
* the enclosing page / route-handler ISR entry carries them and `revalidateTag`
* can evict the rendered output (issue #1453).
*
* Used by both the data cache HIT and MISS paths. On MISS the parent-bubble for
* the *executed* scope also happens in `runCachedFunctionWithContext`; this keeps
* the HIT path (where that function never runs) correct without dropping a nested
* inner entry's stored tags. Deduped to keep tag lists tidy.
*/
function propagateCacheTagsToRequest(tags) {
	if (!tags || tags.length === 0) return;
	const parentCtx = cacheContextStorage.getStore();
	if (parentCtx) {
		for (const tag of tags) if (!parentCtx.tags.includes(tag)) parentCtx.tags.push(tag);
		return;
	}
	addCollectedRequestTags(tags);
}
async function executeWithContext(fn, args, variant) {
	const { result, ctx: _ctx, effectiveLife } = await runCachedFunctionWithContext(fn, args, variant);
	recordRequestScopedCacheLife(effectiveLife);
	return result;
}
async function runCachedFunctionWithContext(fn, args, variant) {
	const parentCtx = cacheContextStorage.getStore();
	let eagerError;
	if (parentCtx && parentCtx.variant !== "private") {
		eagerError = new NestedDynamicUseCacheError();
		if (typeof Error.captureStackTrace === "function") Error.captureStackTrace(eagerError, runCachedFunctionWithContext);
	}
	const ctx = {
		tags: [],
		lifeConfigs: [],
		variant: variant || "default",
		hasExplicitRevalidate: false,
		hasExplicitExpire: false,
		dynamicNestedCacheError: void 0,
		invalidDynamicUsageError: void 0
	};
	const result = await cacheContextStorage.run(ctx, () => fn(...args));
	if (ctx.invalidDynamicUsageError) throw ctx.invalidDynamicUsageError;
	const effectiveLife = resolveCacheLife(ctx.lifeConfigs);
	if (parentCtx) {
		parentCtx.lifeConfigs.push(effectiveLife);
		for (const tag of ctx.tags) if (!parentCtx.tags.includes(tag)) parentCtx.tags.push(tag);
	}
	if (parentCtx && eagerError && (effectiveLife.revalidate === 0 || effectiveLife.expire !== void 0 && effectiveLife.expire < DYNAMIC_EXPIRE)) parentCtx.dynamicNestedCacheError ??= eagerError;
	if (typeof process !== "undefined" && (process.env.VINEXT_PRERENDER === "1" || process.env.NODE_ENV === "development") && ctx.dynamicNestedCacheError) {
		if (effectiveLife.revalidate === 0 && !ctx.hasExplicitRevalidate) throw new Error(getNestedCacheZeroRevalidateErrorMessage(), { cause: ctx.dynamicNestedCacheError });
		if (effectiveLife.expire !== void 0 && effectiveLife.expire < DYNAMIC_EXPIRE && !ctx.hasExplicitExpire) throw new Error(getNestedCacheShortExpireErrorMessage(), { cause: ctx.dynamicNestedCacheError });
	}
	return {
		result,
		ctx,
		effectiveLife
	};
}
function unwrapThenableObjects(value, options = {}) {
	if (value === null || value === void 0 || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => unwrapThenableObjects(item));
	if (typeof value.then === "function") {
		const keys = Object.keys(value);
		if (keys.length > 0) {
			const plain = {};
			for (const key of keys) plain[key] = unwrapThenableObjects(value[key]);
			return plain;
		}
		return value;
	}
	const result = {};
	for (const key of Object.keys(value)) {
		if (key === "searchParams" && (options.omitAppPageSearchParamsAtRoot || isMarkedAppPagePropsObject(value))) continue;
		result[key] = unwrapThenableObjects(value[key]);
	}
	return result;
}
function unwrapThenableObjectArray(values, options) {
	return values.map((value, index) => unwrapThenableObjects(value, { omitAppPageSearchParamsAtRoot: index === 0 && options.omitAppPageSearchParamsFromFirstArg }));
}
function stableStringify(value, seen) {
	if (value === void 0) return "undefined";
	if (value === null) return "null";
	if (typeof value === "function") throw new Error("Cannot serialize function");
	if (typeof value === "symbol") throw new Error("Cannot serialize symbol");
	if (Array.isArray(value)) {
		if (!seen) seen = /* @__PURE__ */ new Set();
		if (seen.has(value)) throw new Error("Circular reference");
		seen.add(value);
		const result = "[" + value.map((v) => stableStringify(v, seen)).join(",") + "]";
		seen.delete(value);
		return result;
	}
	if (typeof value === "object" && value !== null) {
		if (value instanceof Date) return `Date(${value.getTime()})`;
		if (!seen) seen = /* @__PURE__ */ new Set();
		if (seen.has(value)) throw new Error("Circular reference");
		seen.add(value);
		const result = "{" + Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k], seen)}`).join(",") + "}";
		seen.delete(value);
		return result;
	}
	return JSON.stringify(value);
}
//#endregion
export { NestedDynamicUseCacheError, buildUseCacheKey, cacheContextStorage, clearPrivateCache, getCacheContext, markAppPagePropsForUseCache, registerCachedFunction, replyToCacheKey, runWithPrivateCache };
