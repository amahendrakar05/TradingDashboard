import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { getHeadersAccessPhase } from "./headers.js";
//#region src/shims/cache-request-state.ts
const cacheLifeProfiles = {
	default: {
		revalidate: 900,
		expire: 4294967294
	},
	seconds: {
		stale: 30,
		revalidate: 1,
		expire: 60
	},
	minutes: {
		stale: 300,
		revalidate: 60,
		expire: 3600
	},
	hours: {
		stale: 300,
		revalidate: 3600,
		expire: 86400
	},
	days: {
		stale: 300,
		revalidate: 86400,
		expire: 604800
	},
	weeks: {
		stale: 300,
		revalidate: 604800,
		expire: 2592e3
	},
	max: {
		stale: 300,
		revalidate: 2592e3,
		expire: 31536e3
	}
};
let getCacheContext = null;
function _registerCacheContextAccessor(fn) {
	getCacheContext = fn;
}
function getRegisteredCacheContext() {
	return getCacheContext?.() ?? null;
}
const FALLBACK_KEY = Symbol.for("vinext.cache.fallback");
const globalState = globalThis;
const cacheAls = getOrCreateAls("vinext.cache.als");
const ACTION_DID_NOT_REVALIDATE = 0;
const ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC = 1;
const ACTION_DID_REVALIDATE_DYNAMIC_ONLY = 2;
const fallbackState = globalState[FALLBACK_KEY] ??= {
	actionRevalidationKind: ACTION_DID_NOT_REVALIDATE,
	pendingRevalidatedTags: /* @__PURE__ */ new Set(),
	pendingRevalidations: /* @__PURE__ */ new Set(),
	requestScopedCacheLife: null,
	unstableCacheObservations: /* @__PURE__ */ new Map(),
	unstableCacheRevalidation: "foreground"
};
function getCacheState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return cacheAls.getStore() ?? fallbackState;
}
function _runWithCacheState(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((context) => {
		context.actionRevalidationKind = ACTION_DID_NOT_REVALIDATE;
		context.requestScopedCacheLife = null;
		context.unstableCacheObservations = /* @__PURE__ */ new Map();
		context.unstableCacheRevalidation = "foreground";
	}, fn);
	const state = {
		actionRevalidationKind: ACTION_DID_NOT_REVALIDATE,
		pendingRevalidatedTags: /* @__PURE__ */ new Set(),
		pendingRevalidations: /* @__PURE__ */ new Set(),
		requestScopedCacheLife: null,
		unstableCacheObservations: /* @__PURE__ */ new Map(),
		unstableCacheRevalidation: "foreground"
	};
	return cacheAls.run(state, fn);
}
function _initRequestScopedCacheState() {
	const state = getCacheState();
	state.actionRevalidationKind = ACTION_DID_NOT_REVALIDATE;
	state.requestScopedCacheLife = null;
	state.unstableCacheObservations = /* @__PURE__ */ new Map();
}
function markActionRevalidation(kind) {
	if (getHeadersAccessPhase() !== "action") return;
	const state = getCacheState();
	state.actionRevalidationKind = state.actionRevalidationKind === 1 ? 1 : kind;
}
function getAndClearActionRevalidationKind() {
	const state = getCacheState();
	const kind = state.actionRevalidationKind;
	state.actionRevalidationKind = ACTION_DID_NOT_REVALIDATE;
	return kind;
}
function hasRequestScopedCacheState() {
	if (isInsideUnifiedScope() || cacheAls.getStore() !== void 0) return true;
	const phase = getHeadersAccessPhase();
	return phase === "action" || phase === "route-handler";
}
/** @internal */
function _markPendingRevalidatedTag(tag) {
	if (!hasRequestScopedCacheState()) return;
	getCacheState().pendingRevalidatedTags.add(tag);
}
/** @internal */
function _hasPendingRevalidatedTag(tags) {
	if (!hasRequestScopedCacheState()) return false;
	const pendingTags = getCacheState().pendingRevalidatedTags;
	return tags.some((tag) => pendingTags.has(tag));
}
/**
* Record a cache invalidation that must finish before the current action or
* route-handler request is finalized. The public revalidation APIs remain
* synchronous, matching Next.js, while the request boundary owns the await.
*
* Returns false outside a request-like phase so standalone calls can retain
* their historical background-work behavior without accumulating promises in
* the process-global fallback state.
*
* @internal
*/
function _queuePendingRevalidation(promise) {
	if (!hasRequestScopedCacheState()) return false;
	getCacheState().pendingRevalidations.add(promise);
	promise.catch(() => {});
	return true;
}
/**
* Await and clear every cache invalidation queued in the current request.
* Clearing before awaiting also lets a later drain observe work enqueued by
* an async continuation while this batch is settling.
*
* @internal
*/
async function _drainPendingRevalidations() {
	const state = getCacheState();
	let didReject = false;
	let firstRejection;
	while (state.pendingRevalidations.size > 0) {
		const pending = [...state.pendingRevalidations];
		state.pendingRevalidations.clear();
		const results = await Promise.allSettled(pending);
		for (const result of results) if (result.status === "rejected" && !didReject) {
			didReject = true;
			firstRejection = result.reason;
		}
	}
	if (didReject) throw firstRejection;
}
function _setRequestScopedCacheLife(config) {
	const state = getCacheState();
	if (state.requestScopedCacheLife === null) {
		state.requestScopedCacheLife = { ...config };
		return;
	}
	if (config.stale !== void 0) state.requestScopedCacheLife.stale = state.requestScopedCacheLife.stale !== void 0 ? Math.min(state.requestScopedCacheLife.stale, config.stale) : config.stale;
	if (config.revalidate !== void 0) state.requestScopedCacheLife.revalidate = state.requestScopedCacheLife.revalidate !== void 0 ? Math.min(state.requestScopedCacheLife.revalidate, config.revalidate) : config.revalidate;
	if (config.expire !== void 0) state.requestScopedCacheLife.expire = state.requestScopedCacheLife.expire !== void 0 ? Math.min(state.requestScopedCacheLife.expire, config.expire) : config.expire;
}
function _peekRequestScopedCacheLife() {
	const config = getCacheState().requestScopedCacheLife;
	return config === null ? null : { ...config };
}
function _consumeRequestScopedCacheLife() {
	const state = getCacheState();
	const config = state.requestScopedCacheLife;
	state.requestScopedCacheLife = null;
	return config;
}
function recordUnstableCacheObservation(observation) {
	getCacheState().unstableCacheObservations.set(observation.keyHash, observation);
}
function _peekUnstableCacheObservations() {
	return [...getCacheState().unstableCacheObservations.values()].sort((a, b) => a.keyHash.localeCompare(b.keyHash));
}
function shouldServeStaleUnstableCacheEntry() {
	return getCacheState().unstableCacheRevalidation === "background";
}
//#endregion
export { ACTION_DID_REVALIDATE_DYNAMIC_ONLY, ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC, _consumeRequestScopedCacheLife, _drainPendingRevalidations, _hasPendingRevalidatedTag, _initRequestScopedCacheState, _markPendingRevalidatedTag, _peekRequestScopedCacheLife, _peekUnstableCacheObservations, _queuePendingRevalidation, _registerCacheContextAccessor, _runWithCacheState, _setRequestScopedCacheLife, cacheLifeProfiles, getAndClearActionRevalidationKind, getRegisteredCacheContext, markActionRevalidation, recordUnstableCacheObservation, shouldServeStaleUnstableCacheEntry };
