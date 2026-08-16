import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope } from "./unified-request-context.js";
import { getRequestExecutionContext, runWithExecutionContext } from "./request-context.js";
import { MemoryCacheHandler, NoOpCacheHandler, configureMemoryCacheHandler, getCacheHandler, getDataCacheHandler, setCacheHandler, setDataCacheHandler } from "./cache-handler.js";
import { getCdnCacheAdapter } from "./cdn-cache.js";
import { fnv1a64 } from "../utils/hash.js";
import { makeHangingPromise } from "./internal/make-hanging-promise.js";
import { getHeadersAccessPhase, isDraftModeEnabled, markDynamicUsage } from "./headers.js";
import { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLifeProfiles, getAndClearActionRevalidationKind, getRegisteredCacheContext, markActionRevalidation, recordUnstableCacheObservation, shouldServeStaleUnstableCacheEntry } from "./cache-request-state.js";
import { encodeCacheTag, encodeCacheTags } from "../utils/encode-cache-tag.js";
import { addCollectedRequestTags, getCurrentFetchSoftTags } from "./fetch-cache.js";
import { workUnitAsyncStorage } from "./internal/work-unit-async-storage.js";
//#region src/shims/cache.ts
/**
* next/cache shim
*
* Provides the Next.js caching API surface: revalidateTag, revalidatePath,
* unstable_cache. Backed by a pluggable CacheHandler that defaults to
* in-memory but can be swapped for Cloudflare KV, Redis, DynamoDB, etc.
*
* The CacheHandler interface matches Next.js 16's CacheHandler class, so
* existing community adapters (@neshca/cache-handler, @opennextjs/aws, etc.)
* can be used directly.
*
* Recommended configuration is declarative, via the `cache` option on the
* `vinext()` plugin in vite.config.ts:
*   import { kvDataAdapter } from '@vinext/cloudflare/cache/kv-data-adapter';
*   vinext({ cache: { data: kvDataAdapter({ binding: 'VINEXT_KV_CACHE' }) } })
*
* The imperative `setCacheHandler` / `setDataCacheHandler` setters are
* deprecated for consumers and retained only as the internal registration
* target used by the generated cache-adapter module.
*/
const _g = globalThis;
function scheduleRevalidation(promise) {
	const executionContext = getRequestExecutionContext();
	const queued = _queuePendingRevalidation(promise);
	if (executionContext) executionContext.waitUntil(promise);
	else if (!queued) promise.catch((error) => {
		console.error("[vinext] cache revalidation failed:", error);
	});
}
/**
* Revalidate cached data associated with a specific cache tag.
*
* Works with both `fetch(..., { next: { tags: ['myTag'] } })` and
* `unstable_cache(fn, keys, { tags: ['myTag'] })`.
*
* Next.js 16 updated signature: accepts a cacheLife profile as second argument
* for stale-while-revalidate (SWR) behavior. The single-argument form is
* deprecated but still supported for backward compatibility.
*
* @param tag - Cache tag to revalidate
* @param profile - cacheLife profile name (e.g. 'max', 'hours') or inline { expire: number }
*/
function revalidateTag(tag, profile) {
	let durations;
	if (typeof profile === "string") {
		const resolved = cacheLifeProfiles[profile];
		if (resolved) durations = { expire: resolved.expire };
	} else if (profile && typeof profile === "object") durations = profile;
	if (!profile || !durations || durations.expire === 0) markActionRevalidation(1);
	const encodedTag = encodeCacheTag(tag);
	_markPendingRevalidatedTag(encodedTag);
	return scheduleRevalidation(_invalidateEncodedTag(encodedTag, durations));
}
/**
* Invalidate one already-encoded tag across both cache layers.
*
* Ordering is intentional and load-bearing: invalidate the data cache store
* FIRST (covers fetch data, `"use cache"`, and page entries stored there by the
* default CDN adapter), THEN ask the CDN adapter to purge its edge (a no-op for
* the default adapter). Purging the edge before the store is invalidated would
* let the edge re-fetch and re-cache stale data.
*/
async function _invalidateEncodedTag(encoded, durations) {
	await getDataCacheHandler().revalidateTag(encoded, durations);
	await getCdnCacheAdapter().revalidateTag(encoded, durations);
}
/**
* Revalidate cached data associated with a specific path.
*
* Invalidation works through implicit tags generated at render time by
* `buildAppPageCacheTags`, matching Next.js's getDerivedTags:
*
* - `type: "layout"` → invalidates `_N_T_<path>/layout`, cascading to all
*   descendant pages (they carry ancestor layout tags from render time).
* - `type: "page"` → invalidates `_N_T_<path>/page`, targeting only the
*   exact route's page component.
* - No type → invalidates `_N_T_<path>` (broader, exact path).
*
* The `type` parameter is App Router only — Pages Router does not generate
* layout/page hierarchy tags, so only no-type invalidation applies there.
*/
function revalidatePath(path, type) {
	markActionRevalidation(1);
	const stem = path.endsWith("/") ? path.slice(0, -1) : path;
	const encodedTag = encodeCacheTag(type ? `_N_T_${stem}/${type}` : `_N_T_${stem || "/"}`);
	_markPendingRevalidatedTag(encodedTag);
	return scheduleRevalidation(_invalidateEncodedTag(encodedTag));
}
/**
* No-op shim for API compatibility.
*
* In Next.js, calling `refresh()` inside a Server Action triggers a
* client-side router refresh so the user immediately sees updated data.
* vinext reports the dynamic-only invalidation through the Server Action
* response header that the client router already understands.
*/
function refresh() {
	markActionRevalidation(2);
}
/**
* Expire a cache tag immediately (Next.js 16).
*
* Server Actions-only API that expires a tag so the next request
* fetches fresh data. Unlike `revalidateTag`, which uses stale-while-revalidate,
* `updateTag` invalidates synchronously within the same request context.
*
* Throws if called outside a Server Action — e.g. from a Route Handler or
* during render — matching Next.js's enforcement. For Route Handlers, callers
* should use `revalidateTag` instead.
*
* @see https://nextjs.org/docs/app/api-reference/functions/updateTag
*/
function updateTag(tag) {
	if (getHeadersAccessPhase() !== "action") throw new Error("updateTag can only be called from within a Server Action. To invalidate cache tags in Route Handlers or other contexts, use revalidateTag instead. See more info here: https://nextjs.org/docs/app/api-reference/functions/updateTag");
	markActionRevalidation(1);
	const encodedTag = encodeCacheTag(tag);
	_markPendingRevalidatedTag(encodedTag);
	return scheduleRevalidation(_invalidateEncodedTag(encodedTag));
}
/**
* Opt out of static rendering and indicate a particular component should not be cached.
*
* In Next.js, calling noStore() inside a Server Component ensures the component
* is dynamically rendered. In our implementation, this is a no-op since we don't
* have the same static/dynamic rendering split — all server rendering is on-demand.
* It's provided for API compatibility so apps importing it don't break.
*/
function unstable_noStore() {
	if (isInsideUnstableCacheScope()) return;
	markDynamicUsage();
}
/**
* A fulfilled thenable that React can unwrap synchronously via `use()`
* without ever suspending. Reusing a single instance avoids allocating
* on every call — matching Next.js's browser/client implementation.
*
* @see https://github.com/vercel/next.js/blob/canary/packages/next/src/client/request/io.browser.ts
*/
const _resolvedIOPromise = Promise.resolve(void 0);
_resolvedIOPromise.status = "fulfilled";
_resolvedIOPromise.value = void 0;
/**
* Marks an IO boundary in server components by returning a resolved promise
* during requests and a hanging promise during prerendering.
*
* See: https://github.com/vercel/next.js/pull/92521
* Guard removed: https://github.com/vercel/next.js/pull/92923
* Stabilized (renamed from unstable_io): https://github.com/vercel/next.js/pull/93621
*
* Ported from Next.js: packages/next/src/server/request/io.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/request/io.ts
*
* Behavior by work unit type:
* - request → resolve immediately (no delay needed for dynamic SSR)
* - prerender / prerender-client / prerender-runtime → hang (prevent
*   execution past IO boundary during static generation)
* - cache / private-cache / unstable-cache → resolve immediately
*   (caches capture IO results at fill time)
* - generate-static-params → resolve immediately (build time, no prerender to stall)
* - prerender-legacy → resolve immediately (no cache components)
*
* When no work unit store is present (e.g. client-side, standalone script),
* resolves immediately — matching the browser/client implementation.
*/
function io() {
	const workUnitStore = workUnitAsyncStorage.getStore();
	if (workUnitStore) switch (workUnitStore.type) {
		case "request": return _resolvedIOPromise;
		case "prerender":
		case "prerender-client":
		case "prerender-runtime": return makeHangingPromise(workUnitStore.renderSignal, workUnitStore.route ?? "unknown", "`io()`");
		case "cache":
		case "private-cache":
		case "unstable-cache":
		case "generate-static-params":
		case "prerender-legacy": return _resolvedIOPromise;
		default: return _resolvedIOPromise;
	}
	return _resolvedIOPromise;
}
/**
* @deprecated Use `io` instead. Kept as a transitional alias since vinext
* shipped the unstable name longer than upstream Next.js (see #805). Will be
* removed in a future minor.
*/
function unstable_io() {
	if (!_unstableIoWarned) {
		_unstableIoWarned = true;
		console.warn("[vinext] `unstable_io` is deprecated. Import `io` from 'next/cache' instead.");
	}
	return io();
}
let _unstableIoWarned = false;
/**
* Set the cache lifetime for a "use cache" function.
*
* Accepts either a built-in profile name (e.g., "hours", "days") or a custom
* configuration object. In Next.js, this only works inside "use cache" functions.
*
* When called inside a "use cache" function, this sets the cache TTL.
* The "minimum-wins" rule applies: if called multiple times, the shortest
* duration for each field wins.
*
* When called outside a "use cache" context, this is a validated no-op.
*/
function cacheLife(profile) {
	let resolvedConfig;
	if (typeof profile === "string") {
		if (!cacheLifeProfiles[profile]) {
			console.warn(`[vinext] cacheLife: unknown profile "${profile}". Available profiles: ${Object.keys(cacheLifeProfiles).join(", ")}`);
			return;
		}
		resolvedConfig = { ...cacheLifeProfiles[profile] };
	} else if (typeof profile === "object" && profile !== null) {
		if (profile.expire !== void 0 && profile.revalidate !== void 0 && profile.expire < profile.revalidate) console.warn("[vinext] cacheLife: expire must be >= revalidate");
		resolvedConfig = {
			...cacheLifeProfiles.default,
			...profile
		};
	} else return;
	try {
		const ctx = getRegisteredCacheContext();
		if (ctx) {
			ctx.lifeConfigs.push(resolvedConfig);
			if (resolvedConfig.revalidate !== void 0) ctx.hasExplicitRevalidate = true;
			if (resolvedConfig.expire !== void 0) ctx.hasExplicitExpire = true;
			_setRequestScopedCacheLife(resolvedConfig);
			return;
		}
	} catch {}
	_setRequestScopedCacheLife(resolvedConfig);
}
/**
* Tag a "use cache" function's cached result for on-demand revalidation.
*
* Tags set here can be invalidated via revalidateTag(). In Next.js, this only
* works inside "use cache" functions.
*
* When called inside a "use cache" function, tags are attached to the cached
* entry. They can later be invalidated via revalidateTag().
*
* When called outside a "use cache" context, this is a no-op.
*/
function cacheTag(...tags) {
	try {
		const ctx = getRegisteredCacheContext();
		if (ctx) ctx.tags.push(...encodeCacheTags(tags));
	} catch {}
}
/**
* @deprecated Use `cacheLife` instead. `unstable_cacheLife` was stabilized
* upstream and the `unstable_`-prefixed name will be removed in a future
* version of Next.js. Kept as a delegating alias for parity.
*
* Emits a one-time deprecation warning via `console.error` (matching Next.js),
* then delegates to `cacheLife`.
*
* Ported from Next.js: packages/next/cache.js
* https://github.com/vercel/next.js/blob/canary/packages/next/cache.js
*
* Asserted by Next.js test:
* test/e2e/app-dir/cache-components-errors/cache-components-unstable-deprecations.test.ts
*/
let _unstableCacheLifeWarned = false;
function unstable_cacheLife(profile) {
	if (!_unstableCacheLifeWarned) {
		_unstableCacheLifeWarned = true;
		console.error(/* @__PURE__ */ new Error("`unstable_cacheLife` was recently stabilized and should be imported as `cacheLife`. The `unstable` prefixed form will be removed in a future version of Next.js."));
	}
	return cacheLife(profile);
}
/**
* @deprecated Use `cacheTag` instead. `unstable_cacheTag` was stabilized
* upstream and the `unstable_`-prefixed name will be removed in a future
* version of Next.js. Kept as a delegating alias for parity.
*
* Emits a one-time deprecation warning via `console.error` (matching Next.js),
* then delegates to `cacheTag`.
*
* Ported from Next.js: packages/next/cache.js
* https://github.com/vercel/next.js/blob/canary/packages/next/cache.js
*
* Asserted by Next.js test:
* test/e2e/app-dir/cache-components-errors/cache-components-unstable-deprecations.test.ts
*/
let _unstableCacheTagWarned = false;
function unstable_cacheTag(...tags) {
	if (!_unstableCacheTagWarned) {
		_unstableCacheTagWarned = true;
		console.error(/* @__PURE__ */ new Error("`unstable_cacheTag` was recently stabilized and should be imported as `cacheTag`. The `unstable` prefixed form will be removed in a future version of Next.js."));
	}
	return cacheTag(...tags);
}
/**
* AsyncLocalStorage to track whether we're inside an unstable_cache() callback.
* Stored on globalThis via Symbol so headers.ts can detect the scope without
* a direct import (avoiding circular dependencies).
*/
const _unstableCacheAls = getOrCreateAls("vinext.unstableCache.als");
function serializeUnstableCacheResult(value) {
	return JSON.stringify(value === void 0 ? { undef: true } : { v: value });
}
function deserializeUnstableCacheResult(body) {
	const wrapper = JSON.parse(body);
	return "undef" in wrapper ? void 0 : wrapper.v;
}
function tryDeserializeUnstableCacheResult(body) {
	try {
		return {
			ok: true,
			value: deserializeUnstableCacheResult(body)
		};
	} catch {
		return { ok: false };
	}
}
/**
* Check if the current execution context is inside an unstable_cache() callback.
* Used by headers(), cookies(), and connection() to throw errors when
* dynamic request APIs are called inside a cache scope.
*/
function isInsideUnstableCacheScope() {
	return _unstableCacheAls.getStore() === true;
}
const _UNSTABLE_CACHE_PENDING_REVALIDATIONS_KEY = Symbol.for("vinext.unstableCache.pendingRevalidations");
function getPendingUnstableCacheRevalidations() {
	const existing = _g[_UNSTABLE_CACHE_PENDING_REVALIDATIONS_KEY];
	if (existing instanceof Map) return existing;
	const pending = /* @__PURE__ */ new Map();
	_g[_UNSTABLE_CACHE_PENDING_REVALIDATIONS_KEY] = pending;
	return pending;
}
function waitUntilUnstableCacheRevalidation(promise) {
	if (!isInsideUnifiedScope()) return;
	getRequestContext().executionContext?.waitUntil(promise);
}
function scheduleUnstableCacheBackgroundRevalidation(cacheKey, refresh) {
	const pending = getPendingUnstableCacheRevalidations();
	if (pending.has(cacheKey)) return;
	const trackedRevalidation = refresh().then(() => void 0).catch((err) => {
		console.error(`[vinext] unstable_cache background revalidation failed for ${cacheKey}:`, err);
	}).finally(() => {
		if (pending.get(cacheKey) === trackedRevalidation) pending.delete(cacheKey);
	});
	pending.set(cacheKey, trackedRevalidation);
	waitUntilUnstableCacheRevalidation(trackedRevalidation);
}
async function refreshUnstableCacheResult(fn, args, cacheKey, tags, revalidateSeconds) {
	const result = await _unstableCacheAls.run(true, () => fn(...args));
	const cacheValue = {
		kind: "FETCH",
		data: {
			headers: {},
			body: serializeUnstableCacheResult(result),
			url: cacheKey
		},
		tags,
		revalidate: typeof revalidateSeconds === "number" ? revalidateSeconds : false
	};
	await getDataCacheHandler().set(cacheKey, cacheValue, {
		fetchCache: true,
		tags,
		revalidate: revalidateSeconds
	});
	return result;
}
/**
* Wrap an async function with caching.
*
* Returns a new function that caches results. The cache key is derived
* from keyParts + serialized arguments.
*/
function unstable_cache(fn, keyParts, options) {
	const baseKey = keyParts ? keyParts.join(":") : fnv1a64(fn.toString());
	const tags = encodeCacheTags(options?.tags ?? []);
	const revalidateSeconds = options?.revalidate;
	const cachedFn = async (...args) => {
		const argsKey = JSON.stringify(args);
		const cacheKey = `unstable_cache:${baseKey}:${argsKey}`;
		addCollectedRequestTags(tags);
		recordUnstableCacheObservation({
			kind: "unstable_cache",
			keyHash: fnv1a64(cacheKey),
			revalidate: typeof revalidateSeconds === "number" ? revalidateSeconds : revalidateSeconds === false ? false : null,
			tagCount: tags.length,
			tagHash: tags.length > 0 ? fnv1a64(JSON.stringify(tags)) : null
		});
		const isDraftMode = isDraftModeEnabled();
		if (!isDraftMode) {
			const softTags = getCurrentFetchSoftTags();
			const existing = _hasPendingRevalidatedTag([...tags, ...softTags]) ? null : await getDataCacheHandler().get(cacheKey, {
				kind: "FETCH",
				tags,
				softTags
			});
			if (existing?.value && existing.value.kind === "FETCH") {
				const cached = tryDeserializeUnstableCacheResult(existing.value.data.body);
				if (cached.ok) if (existing.cacheState === "stale") {
					if (shouldServeStaleUnstableCacheEntry()) {
						scheduleUnstableCacheBackgroundRevalidation(cacheKey, () => refreshUnstableCacheResult(fn, args, cacheKey, tags, revalidateSeconds));
						return cached.value;
					}
				} else return cached.value;
			}
		}
		if (isDraftMode) return await _unstableCacheAls.run(true, () => fn(...args));
		return await refreshUnstableCacheResult(fn, args, cacheKey, tags, revalidateSeconds);
	};
	return cachedFn;
}
//#endregion
export { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, MemoryCacheHandler, NoOpCacheHandler, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLife, cacheLifeProfiles, cacheTag, configureMemoryCacheHandler, getAndClearActionRevalidationKind, getCacheHandler, getDataCacheHandler, getRegisteredCacheContext, getRequestExecutionContext, io, isInsideUnstableCacheScope, markActionRevalidation, unstable_noStore as noStore, unstable_noStore, recordUnstableCacheObservation, refresh, revalidatePath, revalidateTag, runWithExecutionContext, setCacheHandler, setDataCacheHandler, shouldServeStaleUnstableCacheEntry, unstable_cache, unstable_cacheLife, unstable_cacheTag, unstable_io, updateTag };
