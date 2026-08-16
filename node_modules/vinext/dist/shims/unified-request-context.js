import { getOrCreateAls } from "./internal/als-registry.js";
//#region src/shims/unified-request-context.ts
const _REQUEST_CONTEXT_ALS_KEY = Symbol.for("vinext.requestContext.als");
const _g = globalThis;
const _als = getOrCreateAls("vinext.unifiedRequestContext.als");
function _getInheritedExecutionContext() {
	const unifiedStore = _als.getStore();
	if (unifiedStore) return unifiedStore.executionContext;
	return _g[_REQUEST_CONTEXT_ALS_KEY]?.getStore() ?? null;
}
/**
* Create a fresh `UnifiedRequestContext` with defaults for all fields.
* Pass partial overrides for the fields you need to pre-populate.
*/
function createRequestContext(opts) {
	return {
		headersContext: null,
		actionRevalidationKind: 0,
		pendingRevalidatedTags: /* @__PURE__ */ new Set(),
		pendingRevalidations: /* @__PURE__ */ new Set(),
		dynamicUsageDetected: false,
		renderRequestApiUsage: /* @__PURE__ */ new Set(),
		connectionProbe: null,
		invalidDynamicUsageError: null,
		pendingSetCookies: [],
		draftModeCookieHeader: null,
		phase: "render",
		i18nContext: null,
		serverContext: null,
		serverInsertedHTMLCallbacks: [],
		requestScopedCacheLife: null,
		unstableCacheObservations: /* @__PURE__ */ new Map(),
		unstableCacheRevalidation: "foreground",
		_privateCache: null,
		cacheableFetchUrls: /* @__PURE__ */ new Set(),
		currentRequestTags: [],
		currentFetchSoftTags: [],
		currentFetchCacheMode: null,
		currentForceDynamicFetchDefault: false,
		dynamicFetchUrls: /* @__PURE__ */ new Set(),
		refreshStaleFetchesInForeground: false,
		isFetchDedupeActive: false,
		currentFetchDedupeEntries: /* @__PURE__ */ new Map(),
		executionContext: _getInheritedExecutionContext(),
		requestCache: /* @__PURE__ */ new WeakMap(),
		ssrContext: null,
		ssrHeadChildren: [],
		documentInitialHead: [],
		rootParams: null,
		...opts
	};
}
function runWithRequestContext(ctx, fn) {
	return _als.run(ctx, fn);
}
function runWithUnifiedStateMutation(mutate, fn) {
	const parentCtx = _als.getStore();
	if (!parentCtx) return fn();
	const childCtx = { ...parentCtx };
	mutate(childCtx);
	return _als.run(childCtx, fn);
}
/**
* Get the current unified request context.
* Returns the ALS store when inside a `runWithRequestContext()` scope,
* or a fresh detached context otherwise. Unlike the legacy per-shim fallback
* singletons, this detached value is ephemeral — mutations do not persist
* across calls. This is intentional to prevent state leakage outside request
* scopes.
*
* Only direct callers observe this detached fallback. Shim `_getState()`
* helpers should continue to gate on `isInsideUnifiedScope()` and fall back
* to their standalone ALS/fallback singletons outside the unified scope.
* If called inside a standalone `runWithExecutionContext()` scope, the
* detached context still reflects that inherited `executionContext`.
*/
function getRequestContext() {
	return _als.getStore() ?? createRequestContext();
}
/**
* Check whether the current execution is inside a `runWithRequestContext()` scope.
* Shim modules use this to decide whether to read from the unified store
* or fall back to their own standalone ALS.
*/
function isInsideUnifiedScope() {
	return _als.getStore() != null;
}
//#endregion
export { createRequestContext, getRequestContext, isInsideUnifiedScope, runWithRequestContext, runWithUnifiedStateMutation };
