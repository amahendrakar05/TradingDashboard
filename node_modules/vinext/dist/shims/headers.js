import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { MIDDLEWARE_SET_COOKIE_HEADER } from "../utils/protocol-headers.js";
import { FLIGHT_HEADERS, NEXT_HTML_REQUEST_ID_HEADER, NEXT_REQUEST_ID_HEADER } from "../server/headers.js";
import { buildRequestHeadersFromMiddlewareResponse } from "../utils/middleware-request-headers.js";
import { serializeSetCookie, validateCookieAttributeValue, validateCookieName } from "./internal/cookie-serialize.js";
import { parseEdgeRequestCookieHeader } from "../utils/parse-cookie.js";
import { createPprFallbackShellSuspensePromise } from "./ppr-fallback-shell.js";
//#region src/shims/headers.ts
/**
* next/headers shim
*
* Provides cookies() and headers() functions for App Router Server Components.
* These read from a request context set by the RSC handler before rendering.
*
* In Next.js 15+, cookies() and headers() return Promises (async).
* We support both the sync (legacy) and async patterns.
*/
const _FALLBACK_KEY = Symbol.for("vinext.nextHeadersShim.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.nextHeadersShim.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= {
	headersContext: null,
	dynamicUsageDetected: false,
	renderRequestApiUsage: /* @__PURE__ */ new Set(),
	connectionProbe: null,
	invalidDynamicUsageError: null,
	pendingSetCookies: [],
	draftModeCookieHeader: null,
	phase: "render"
};
const EXPIRED_COOKIE_DATE = (/* @__PURE__ */ new Date(0)).toUTCString();
function splitMiddlewareSetCookieHeader(value) {
	const cookies = [];
	let start = 0;
	let inExpires = false;
	let expiresCommaSeen = false;
	for (let i = 0; i < value.length; i++) {
		if (value.slice(i, i + 8).toLowerCase() === "expires=") {
			inExpires = true;
			expiresCommaSeen = false;
			i += 7;
			continue;
		}
		const ch = value[i];
		if (inExpires && ch === ";") {
			inExpires = false;
			expiresCommaSeen = false;
			continue;
		}
		if (ch !== ",") continue;
		if (inExpires && !expiresCommaSeen) {
			expiresCommaSeen = true;
			continue;
		}
		const cookie = value.slice(start, i).trim();
		if (cookie) cookies.push(cookie);
		start = i + 1;
		inExpires = false;
		expiresCommaSeen = false;
	}
	const cookie = value.slice(start).trim();
	if (cookie) cookies.push(cookie);
	return cookies;
}
function setCookieNameValue(setCookie) {
	const equalsIndex = setCookie.indexOf("=");
	if (equalsIndex <= 0) return null;
	const name = setCookie.slice(0, equalsIndex).trim();
	const valueEnd = setCookie.indexOf(";", equalsIndex + 1);
	const encodedValue = setCookie.slice(equalsIndex + 1, valueEnd === -1 ? void 0 : valueEnd);
	let value;
	try {
		value = decodeURIComponent(encodedValue);
	} catch {
		value = encodedValue;
	}
	return {
		name,
		value
	};
}
function rebuildCookiesFromHeader(ctx, cookieHeader) {
	ctx.cookies.clear();
	if (cookieHeader === null) return;
	const nextCookies = parseEdgeRequestCookieHeader(cookieHeader);
	for (const [name, value] of nextCookies) ctx.cookies.set(name, value);
}
function mergeMiddlewareSetCookies(ctx, rawHeader) {
	if (rawHeader === null) return false;
	let merged = false;
	for (const setCookie of splitMiddlewareSetCookieHeader(rawHeader)) {
		const entry = setCookieNameValue(setCookie);
		if (!entry) continue;
		ctx.cookies.set(entry.name, entry.value);
		merged = true;
	}
	return merged;
}
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
/**
* Dynamic usage flag — set when a component calls connection(), cookies(),
* headers(), or noStore() during rendering. When true, ISR caching is
* bypassed and the response gets Cache-Control: no-store.
*/
/**
* Mark the current render as requiring dynamic (uncached) rendering.
* Called by connection(), cookies(), headers(), and noStore().
*/
function markDynamicUsage() {
	const state = _getState();
	if (state.headersContext?.forceStatic) return;
	state.dynamicUsageDetected = true;
	forEachConnectionProbeTarget(state, (target) => {
		target.dynamicUsageDetected = true;
	});
}
function forEachConnectionProbeTarget(state, visit) {
	let target = state.connectionProbe?.dynamicUsageTarget ?? null;
	const seen = /* @__PURE__ */ new Set([state]);
	while (target && !seen.has(target)) {
		seen.add(target);
		visit(target);
		target = target.connectionProbe?.dynamicUsageTarget ?? null;
	}
}
function propagateInvalidDynamicUsageError(state, error) {
	forEachConnectionProbeTarget(state, (target) => {
		if (target.invalidDynamicUsageError == null) target.invalidDynamicUsageError = error;
	});
}
/**
* Measure dynamic usage in a child async scope without clearing the parent.
* Concurrent work that already belongs to the request (such as deferred
* metadata) keeps writing to the parent state and therefore remains visible
* to the final cache policy.
*/
async function runWithIsolatedDynamicUsage(fn) {
	const runInChildState = async (childState) => {
		return {
			result: await fn(),
			dynamicDetected: childState.dynamicUsageDetected
		};
	};
	if (isInsideUnifiedScope()) {
		let childState = null;
		return await runWithUnifiedStateMutation((context) => {
			context.dynamicUsageDetected = false;
			childState = context;
		}, () => {
			if (!childState) throw new Error("Dynamic usage scope was not initialized");
			return runInChildState(childState);
		});
	}
	const childState = {
		..._getState(),
		dynamicUsageDetected: false
	};
	return await _als.run(childState, () => runInChildState(childState));
}
function markRenderRequestApiUsage(kind) {
	_getState().renderRequestApiUsage.add(kind);
}
function throwIfStaticGenerationAccessError() {
	const accessError = _getState().headersContext?.accessError;
	if (accessError) throw accessError;
}
async function runWithConnectionProbe(fn) {
	const parentState = _getState();
	const parentInvalidDynamicUsageError = parentState.invalidDynamicUsageError;
	let interruptProbe = () => {};
	const interrupted = new Promise((resolve) => {
		interruptProbe = () => resolve({ completed: false });
	});
	const probe = {
		active: true,
		dynamicUsageTarget: parentState,
		interrupted: false,
		interrupt() {
			if (probe.interrupted) return;
			probe.interrupted = true;
			interruptProbe();
		},
		pending: new Promise(() => {})
	};
	const runInChildState = async (childState) => {
		try {
			const completed = Promise.resolve().then(fn).then((result) => ({
				completed: true,
				result
			}));
			return await Promise.race([completed, interrupted]);
		} finally {
			probe.active = false;
			childState.connectionProbe = parentState.connectionProbe ?? probe;
			if (childState.dynamicUsageDetected) parentState.dynamicUsageDetected = true;
			if (childState.invalidDynamicUsageError !== parentInvalidDynamicUsageError && parentState.invalidDynamicUsageError === parentInvalidDynamicUsageError) parentState.invalidDynamicUsageError = childState.invalidDynamicUsageError;
		}
	};
	if (isInsideUnifiedScope()) {
		let childState = null;
		return await runWithUnifiedStateMutation((context) => {
			context.connectionProbe = probe;
			childState = context;
		}, () => {
			if (!childState) throw new Error("Connection probe scope was not initialized");
			return runInChildState(childState);
		});
	}
	const childState = {
		...parentState,
		connectionProbe: probe
	};
	return await _als.run(childState, () => runInChildState(childState));
}
function suspendConnectionProbe() {
	const probe = _getState().connectionProbe;
	if (!probe?.active) return null;
	probe.interrupt();
	return probe.pending;
}
function peekRenderRequestApiUsage() {
	return [..._getState().renderRequestApiUsage].sort();
}
function consumeRenderRequestApiUsage() {
	const state = _getState();
	const observed = [...state.renderRequestApiUsage].sort();
	state.renderRequestApiUsage = /* @__PURE__ */ new Set();
	return observed;
}
/** Symbol used by cache-runtime.ts to store the "use cache" ALS on globalThis */
const _USE_CACHE_ALS_KEY = Symbol.for("vinext.cacheRuntime.contextAls");
/** Symbol used by cache.ts to store the unstable_cache ALS on globalThis */
const _UNSTABLE_CACHE_ALS_KEY = Symbol.for("vinext.unstableCache.als");
function _getGlobalCacheScopeStorage(key) {
	const value = Reflect.get(globalThis, key);
	if (!value || typeof value !== "object") return null;
	const getStore = Reflect.get(value, "getStore");
	if (typeof getStore !== "function") return null;
	return { getStore: () => getStore.call(value) };
}
function _getUseCacheGuardContext() {
	const store = _getGlobalCacheScopeStorage(_USE_CACHE_ALS_KEY)?.getStore();
	if (!store || typeof store !== "object") return null;
	return store;
}
function _isInsidePublicUseCache() {
	const ctx = _getUseCacheGuardContext();
	return ctx !== null && ctx.variant !== "private";
}
function _isInsideUnstableCache() {
	return _getGlobalCacheScopeStorage(_UNSTABLE_CACHE_ALS_KEY)?.getStore() === true;
}
/**
* Throw if the current execution is inside a "use cache" or unstable_cache()
* scope. Called by dynamic request APIs (headers, cookies, connection) to
* prevent request-specific data from being frozen into cached results.
*
* @param apiName - The name of the API being called (e.g. "connection()")
*/
function throwIfInsideCacheScope(apiName) {
	if (_isInsidePublicUseCache()) {
		const error = /* @__PURE__ */ new Error(`\`${apiName}\` cannot be called inside "use cache". If you need this data inside a cached function, call \`${apiName}\` outside and pass the required data as an argument.`);
		try {
			const cacheCtx = _getUseCacheGuardContext();
			if (cacheCtx) cacheCtx.invalidDynamicUsageError = error;
			const ctx = getRequestContext();
			if (ctx) ctx.invalidDynamicUsageError = error;
			propagateInvalidDynamicUsageError(_getState(), error);
		} catch {}
		throw error;
	}
	if (_isInsideUnstableCache()) {
		const error = /* @__PURE__ */ new Error(`\`${apiName}\` cannot be called inside a function cached with \`unstable_cache()\`. If you need this data inside a cached function, call \`${apiName}\` outside and pass the required data as an argument.`);
		try {
			const ctx = getRequestContext();
			if (ctx) ctx.invalidDynamicUsageError = error;
			propagateInvalidDynamicUsageError(_getState(), error);
		} catch {}
		throw error;
	}
}
/**
* Check, consume, and return any invalid dynamic usage error recorded during
* the render (e.g. cookies() called inside "use cache"). This error persists
* even if the throw was caught by user-code try/catch, so it can surface on
* client-side navigations where the static shell validation is skipped.
* Ported from Next.js: workStore.invalidDynamicUsageError in
* packages/next/src/server/app-render/app-render.tsx
* https://github.com/vercel/next.js/commit/f5e54c06726b571a042fce67417e40a29f6b8689
*/
function consumeInvalidDynamicUsageError() {
	const state = _getState();
	const err = state.invalidDynamicUsageError;
	state.invalidDynamicUsageError = null;
	return err;
}
/**
* Check and reset the dynamic usage flag.
* Called by the server after rendering to decide on caching.
*/
function consumeDynamicUsage() {
	const state = _getState();
	const used = state.dynamicUsageDetected;
	state.dynamicUsageDetected = false;
	return used;
}
/**
* Read the dynamic usage flag without resetting it.
* Used by the layout probe to fold a probe-scoped `markDynamicUsage()` into the
* per-layout observation before the isolated probe scope is discarded, so the
* observation captures `markDynamicUsage()` paths (e.g. `"use cache: private"`)
* that leave no other observable trace.
*/
function peekDynamicUsage() {
	return _getState().dynamicUsageDetected;
}
function _setStatePhase(state, phase) {
	const previous = state.phase;
	state.phase = phase;
	return previous;
}
function _areCookiesMutableInCurrentPhase() {
	const phase = _getState().phase;
	return phase === "action" || phase === "route-handler";
}
function setHeadersAccessPhase(phase) {
	return _setStatePhase(_getState(), phase);
}
function getHeadersAccessPhase() {
	return _getState().phase;
}
/**
* Set the headers/cookies context for the current RSC render.
* Called by the framework's RSC entry before rendering each request.
*
* @deprecated Prefer runWithHeadersContext() which uses als.run() for
* proper per-request isolation. This function mutates the ALS store
* in-place and is only safe for cleanup (ctx=null) within an existing
* als.run() scope.
*/
/**
* Returns the current live HeadersContext from ALS (or the fallback).
* Used after applyMiddlewareRequestHeaders() to build a post-middleware
* request context for afterFiles/fallback rewrite has/missing evaluation.
*/
function getHeadersContext() {
	return _getState().headersContext;
}
function setHeadersContext(ctx) {
	const state = _getState();
	if (ctx !== null) {
		state.headersContext = ctx;
		state.dynamicUsageDetected = false;
		state.renderRequestApiUsage = /* @__PURE__ */ new Set();
		state.pendingSetCookies = [];
		state.draftModeCookieHeader = null;
		state.phase = "render";
	} else {
		state.headersContext = null;
		state.phase = "render";
	}
}
function runWithHeadersContext(ctx, fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.headersContext = ctx;
		uCtx.dynamicUsageDetected = false;
		uCtx.renderRequestApiUsage = /* @__PURE__ */ new Set();
		uCtx.connectionProbe = null;
		uCtx.pendingSetCookies = [];
		uCtx.draftModeCookieHeader = null;
		uCtx.phase = "render";
	}, fn);
	const state = {
		headersContext: ctx,
		dynamicUsageDetected: false,
		renderRequestApiUsage: /* @__PURE__ */ new Set(),
		connectionProbe: null,
		invalidDynamicUsageError: null,
		pendingSetCookies: [],
		draftModeCookieHeader: null,
		phase: "render"
	};
	return _als.run(state, fn);
}
/**
* Apply middleware-forwarded request headers to the current headers context.
*
* When Next.js middleware calls `NextResponse.next()` or `NextResponse.rewrite()`
* with `{ request: { headers } }`, the modified headers are encoded on the
* middleware response. This function decodes that protocol and applies the
* resulting request header set to the live `HeadersContext`. When an override
* list is present, omitted headers are deleted as part of the rebuild.
*
* Cached `readonlyHeaders` and `readonlyCookies` snapshots on the
* HeadersContext must be invalidated whenever this function rebuilds the
* underlying `headers`/`cookies`. Otherwise a middleware that reads
* `headers()` (or `cookies()`) before returning a request-header override —
* for example `@clerk/nextjs`, whose `clerkClient()` reads `headers()` via
* `buildRequestLike()` during middleware execution — primes a sealed snapshot
* built from the *pre*-override request, and any subsequent `headers()` call
* from a Server Component would return that stale snapshot instead of the
* middleware-modified view.
*/
function applyMiddlewareRequestHeaders(middlewareResponseHeaders) {
	const state = _getState();
	if (!state.headersContext) return;
	const ctx = state.headersContext;
	const previousCookieHeader = ctx.headers.get("cookie");
	const middlewareSetCookieHeader = middlewareResponseHeaders.get(MIDDLEWARE_SET_COOKIE_HEADER);
	const nextHeaders = buildRequestHeadersFromMiddlewareResponse(ctx.headers, middlewareResponseHeaders);
	if (!nextHeaders && middlewareSetCookieHeader === null) return;
	if (nextHeaders) {
		ctx.headers = nextHeaders;
		ctx.readonlyHeaders = void 0;
		const nextCookieHeader = nextHeaders.get("cookie");
		if (previousCookieHeader !== nextCookieHeader) {
			rebuildCookiesFromHeader(ctx, nextCookieHeader);
			ctx.readonlyCookies = void 0;
			ctx.mutableCookies = void 0;
		}
	}
	if (mergeMiddlewareSetCookies(ctx, middlewareSetCookieHeader)) {
		ctx.readonlyCookies = void 0;
		ctx.mutableCookies = void 0;
	}
}
/** Methods on `Headers` that mutate state. Hoisted to module scope — static. */
const _HEADERS_MUTATING_METHODS = /* @__PURE__ */ new Set([
	"set",
	"delete",
	"append"
]);
var ReadonlyHeadersError = class ReadonlyHeadersError extends Error {
	constructor() {
		super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
	}
	static callable() {
		throw new ReadonlyHeadersError();
	}
};
var ReadonlyRequestCookiesError = class ReadonlyRequestCookiesError extends Error {
	constructor() {
		super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
	}
	static callable() {
		throw new ReadonlyRequestCookiesError();
	}
};
function _decorateRequestApiPromise(promise, target) {
	return new Proxy(promise, {
		get(promiseTarget, prop) {
			if (prop in promiseTarget) {
				const value = Reflect.get(promiseTarget, prop, promiseTarget);
				return typeof value === "function" ? value.bind(promiseTarget) : value;
			}
			const value = Reflect.get(target, prop, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
		has(promiseTarget, prop) {
			return prop in promiseTarget || prop in target;
		},
		ownKeys(promiseTarget) {
			return Array.from(/* @__PURE__ */ new Set([...Reflect.ownKeys(promiseTarget), ...Reflect.ownKeys(target)]));
		},
		getOwnPropertyDescriptor(promiseTarget, prop) {
			return Reflect.getOwnPropertyDescriptor(promiseTarget, prop) ?? Reflect.getOwnPropertyDescriptor(target, prop);
		}
	});
}
const _decoratedHeadersPromises = /* @__PURE__ */ new WeakMap();
const _decoratedCookiesPromises = /* @__PURE__ */ new WeakMap();
function _getOrCreateDecoratedRequestApiPromise(cache, target) {
	const cached = cache.get(target);
	if (cached) return cached;
	const promise = _decorateRequestApiPromise(Promise.resolve(target), target);
	cache.set(target, promise);
	return promise;
}
function _decorateRejectedRequestApiPromise(error) {
	const normalizedError = error instanceof Error ? error : new Error(String(error));
	const promise = Promise.reject(normalizedError);
	promise.catch(() => {});
	return _decorateRequestApiPromise(promise, new Proxy({}, { get(_target, prop) {
		if (prop === "then" || prop === "catch" || prop === "finally") return;
		throw normalizedError;
	} }));
}
function _decorateSuspendingRequestApiPromise(promise) {
	return new Proxy(promise, {
		get(promiseTarget, prop) {
			if (prop === "then" || prop === "catch" || prop === "finally") {
				const value = Reflect.get(promiseTarget, prop, promiseTarget);
				return typeof value === "function" ? value.bind(promiseTarget) : value;
			}
			throw promise;
		},
		getOwnPropertyDescriptor() {
			throw promise;
		},
		has() {
			throw promise;
		},
		ownKeys() {
			throw promise;
		}
	});
}
function _sealHeaders(headers) {
	return new Proxy(headers, { get(target, prop) {
		if (typeof prop === "string" && _HEADERS_MUTATING_METHODS.has(prop)) throw new ReadonlyHeadersError();
		const value = Reflect.get(target, prop, target);
		return typeof value === "function" ? value.bind(target) : value;
	} });
}
function _wrapMutableCookies(cookies) {
	return new Proxy(cookies, { get(target, prop) {
		if (prop === "set" || prop === "delete") return (...args) => {
			if (!_areCookiesMutableInCurrentPhase()) throw new ReadonlyRequestCookiesError();
			return Reflect.get(target, prop, target).apply(target, args);
		};
		const value = Reflect.get(target, prop, target);
		return typeof value === "function" ? value.bind(target) : value;
	} });
}
function _sealCookies(cookies) {
	return new Proxy(cookies, { get(target, prop) {
		if (prop === "set" || prop === "delete") throw new ReadonlyRequestCookiesError();
		const value = Reflect.get(target, prop, target);
		return typeof value === "function" ? value.bind(target) : value;
	} });
}
function _getMutableCookies(ctx) {
	if (!ctx.mutableCookies) ctx.mutableCookies = _wrapMutableCookies(new RequestCookies(ctx.cookies));
	return ctx.mutableCookies;
}
function _getReadonlyCookies(ctx) {
	if (!ctx.readonlyCookies) ctx.readonlyCookies = _sealCookies(new RequestCookies(ctx.cookies));
	return ctx.readonlyCookies;
}
function _getReadonlyHeaders(ctx) {
	if (!ctx.readonlyHeaders) {
		const cleaned = new Headers(ctx.headers);
		for (const header of FLIGHT_HEADERS) cleaned.delete(header);
		cleaned.delete(NEXT_REQUEST_ID_HEADER);
		cleaned.delete(NEXT_HTML_REQUEST_ID_HEADER);
		ctx.readonlyHeaders = _sealHeaders(cleaned);
	}
	return ctx.readonlyHeaders;
}
/**
* Create a HeadersContext from a standard Request object.
*
* Performance note: In Workerd (Cloudflare Workers), `new Headers(request.headers)`
* copies the entire header map across the V8/C++ boundary, which shows up as
* ~815 ms self-time in production profiles when requests carry many headers.
* We defer this copy with a lazy proxy:
*
* - Reads (`get`, `has`, `entries`, …) are forwarded directly to the original
*   immutable `request.headers` — zero copy cost on the hot path.
* - The first mutating call (`set`, `delete`, `append`) materialises
*   `new Headers(request.headers)` once, then applies the mutation to the copy.
*   All subsequent operations go to the copy.
*
* This means the ~815 ms copy only occurs when middleware actually rewrites
* request headers via `NextResponse.next({ request: { headers } })`, which is
* uncommon.  Pure read requests (the vast majority) pay zero copy cost.
*
* Cookie parsing is also deferred: the `cookie` header string is not split
* until the first call to `cookies()` or `draftMode()`.
*/
function headersContextFromRequest(request, options) {
	let _mutable = null;
	const headersProxy = new Proxy(request.headers, { get(target, prop) {
		const src = _mutable ?? target;
		if (typeof prop === "string" && _HEADERS_MUTATING_METHODS.has(prop)) return (...args) => {
			if (!_mutable) _mutable = new Headers(target);
			return _mutable[prop](...args);
		};
		const value = Reflect.get(src, prop, src);
		return typeof value === "function" ? value.bind(src) : value;
	} });
	let _cookies = null;
	function getCookies() {
		if (_cookies) return _cookies;
		_cookies = parseEdgeRequestCookieHeader(headersProxy.get("cookie") || "");
		return _cookies;
	}
	return {
		headers: headersProxy,
		get cookies() {
			return getCookies();
		},
		draftModeSecret: options?.draftModeSecret
	};
}
/**
* Read-only Headers instance from the incoming request.
* Returns a Promise in Next.js 15+ style (but resolves synchronously since
* the context is already available).
*/
function headers() {
	markRenderRequestApiUsage("headers");
	try {
		throwIfInsideCacheScope("headers()");
	} catch (error) {
		return _decorateRejectedRequestApiPromise(error);
	}
	const state = _getState();
	if (!state.headersContext) return _decorateRejectedRequestApiPromise(/* @__PURE__ */ new Error("headers() can only be called from a Server Component, Route Handler, or Server Action. Make sure you're not calling it from a Client Component."));
	if (state.headersContext.accessError) return _decorateRejectedRequestApiPromise(state.headersContext.accessError);
	markDynamicUsage();
	const fallbackShellPromise = createPprFallbackShellSuspensePromise("`headers()`");
	if (fallbackShellPromise) return _decorateSuspendingRequestApiPromise(fallbackShellPromise);
	const readonlyHeaders = _getReadonlyHeaders(state.headersContext);
	return _getOrCreateDecoratedRequestApiPromise(_decoratedHeadersPromises, readonlyHeaders);
}
/**
* Cookie jar from the incoming request.
* Returns a ReadonlyRequestCookies-like object.
*/
function cookiesImpl() {
	markRenderRequestApiUsage("cookies");
	try {
		throwIfInsideCacheScope("cookies()");
	} catch (error) {
		return _decorateRejectedRequestApiPromise(error);
	}
	const state = _getState();
	if (!state.headersContext) return _decorateRejectedRequestApiPromise(/* @__PURE__ */ new Error("cookies() can only be called from a Server Component, Route Handler, or Server Action."));
	if (state.headersContext.accessError) return _decorateRejectedRequestApiPromise(state.headersContext.accessError);
	markDynamicUsage();
	const fallbackShellPromise = createPprFallbackShellSuspensePromise("`cookies()`");
	if (fallbackShellPromise) return _decorateSuspendingRequestApiPromise(fallbackShellPromise);
	const cookieStore = _areCookiesMutableInCurrentPhase() ? _getMutableCookies(state.headersContext) : _getReadonlyCookies(state.headersContext);
	return _getOrCreateDecoratedRequestApiPromise(_decoratedCookiesPromises, cookieStore);
}
function cookies() {
	return cookiesImpl();
}
/** Accumulated Set-Cookie headers from cookies().set() / .delete() calls */
/**
* Get and clear all pending Set-Cookie headers generated by cookies().set()/delete().
* Called by the framework after rendering to attach headers to the response.
*/
function getAndClearPendingCookies() {
	const state = _getState();
	const cookies = state.pendingSetCookies;
	state.pendingSetCookies = [];
	return cookies;
}
const DRAFT_MODE_COOKIE = "__prerender_bypass";
const DRAFT_MODE_EXPIRED_DATE = (/* @__PURE__ */ new Date(0)).toUTCString();
/**
* Get any Set-Cookie header generated by draftMode().enable()/disable().
* Called by the framework after rendering to attach the header to the response.
*/
function getDraftModeCookieHeader() {
	const state = _getState();
	const header = state.draftModeCookieHeader;
	state.draftModeCookieHeader = null;
	return header;
}
function validateDraftModeSecret(secret) {
	if (secret.length === 0) throw new Error("[vinext] draft mode secret must be a non-empty string.");
	return secret;
}
function createDraftModeSecret() {
	const crypto = globalThis.crypto;
	if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	throw new Error("[vinext] draft mode secret is not initialized. This should be initialized by the server entry before handling requests.");
}
function ensureContextDraftModeSecret(ctx) {
	if (ctx.draftModeSecret !== void 0) return validateDraftModeSecret(ctx.draftModeSecret);
	const secret = createDraftModeSecret();
	ctx.draftModeSecret = secret;
	return secret;
}
function isDraftModeRequest(request, draftModeSecret) {
	const cookieHeader = request.headers.get("cookie");
	if (!cookieHeader) return false;
	return parseEdgeRequestCookieHeader(cookieHeader).get(DRAFT_MODE_COOKIE) === validateDraftModeSecret(draftModeSecret);
}
/**
* Read draft mode from the live request context without recording request API
* usage. `null` means there is no active request context, which lets framework
* callers fall back to an explicitly supplied request when needed.
*/
function getActiveDraftModeState() {
	const context = _getState().headersContext;
	if (!context) return null;
	if (context.draftModeEnabled !== void 0) return context.draftModeEnabled;
	const secret = context.draftModeSecret;
	if (secret === void 0) return false;
	return context.cookies.get(DRAFT_MODE_COOKIE) === validateDraftModeSecret(secret);
}
/**
* Read the active request's draft-mode state without recording request API usage.
* Internal cache implementations use this to bypass persistent reads and writes,
* matching Next.js's request-level `workStore.isDraftMode` guard.
*/
function isDraftModeEnabled() {
	return getActiveDraftModeState() ?? false;
}
function draftModeCookieAttributes() {
	if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") return "Path=/; HttpOnly; SameSite=Lax";
	return "Path=/; HttpOnly; SameSite=None; Secure";
}
function createDraftModeScopeError(expression) {
	return /* @__PURE__ */ new Error(`${expression} can only be called from a Server Component, Route Handler, or Server Action.`);
}
function requireActiveDraftModeContext(state, expectedContext, expression) {
	const currentContext = state.headersContext;
	if (currentContext !== expectedContext) throw createDraftModeScopeError(expression);
	if (currentContext.accessError) throw currentContext.accessError;
	return currentContext;
}
/**
* Draft mode — check/toggle via a `__prerender_bypass` cookie.
*
* - `isEnabled`: true if the bypass cookie is present in the request
* - `enable()`: sets the bypass cookie (for Route Handlers)
* - `disable()`: clears the bypass cookie
*
* Unlike `headers()` / `cookies()`, calling `draftMode()` itself is allowed
* inside `"use cache"` and `unstable_cache()` scopes — reads of `isEnabled`
* are non-dynamic and supported in cached functions. Only the mutating
* `enable()` / `disable()` methods throw when invoked inside a cache scope.
* Ported from Next.js: packages/next/src/server/request/draft-mode.ts
* (`getDraftModeProviderForCacheScope` + `trackDynamicDraftMode`).
*/
async function draftMode() {
	markRenderRequestApiUsage("draftMode");
	const state = _getState();
	const context = state.headersContext;
	if (!context) throw createDraftModeScopeError("draftMode()");
	const secret = ensureContextDraftModeSecret(context);
	return {
		get isEnabled() {
			return context.draftModeEnabled ?? context.cookies.get(DRAFT_MODE_COOKIE) === secret;
		},
		enable() {
			throwIfInsideCacheScope("draftMode().enable()");
			const activeContext = requireActiveDraftModeContext(state, context, "draftMode().enable()");
			markDynamicUsage();
			activeContext.draftModeEnabled = true;
			activeContext.cookies.set(DRAFT_MODE_COOKIE, secret);
			state.draftModeCookieHeader = `${DRAFT_MODE_COOKIE}=${secret}; ${draftModeCookieAttributes()}`;
		},
		disable() {
			throwIfInsideCacheScope("draftMode().disable()");
			const activeContext = requireActiveDraftModeContext(state, context, "draftMode().disable()");
			markDynamicUsage();
			activeContext.draftModeEnabled = false;
			activeContext.cookies.delete(DRAFT_MODE_COOKIE);
			state.draftModeCookieHeader = `${DRAFT_MODE_COOKIE}=; ${draftModeCookieAttributes()}; Expires=${DRAFT_MODE_EXPIRED_DATE}`;
		}
	};
}
var RequestCookies = class {
	_cookies;
	constructor(cookies) {
		this._cookies = cookies;
	}
	get(name) {
		const value = this._cookies.get(name);
		if (value === void 0) return void 0;
		return {
			name,
			value
		};
	}
	getAll(nameOrOptions) {
		const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions?.name;
		const result = [];
		for (const [cookieName, value] of this._cookies) if (name === void 0 || cookieName === name) result.push({
			name: cookieName,
			value
		});
		return result;
	}
	has(name) {
		return this._cookies.has(name);
	}
	set(nameOrOptions, value, options) {
		let cookieName;
		let cookieValue;
		let opts;
		if (typeof nameOrOptions === "string") {
			cookieName = nameOrOptions;
			cookieValue = value ?? "";
			opts = options;
		} else {
			cookieName = nameOrOptions.name;
			cookieValue = nameOrOptions.value;
			opts = nameOrOptions;
		}
		validateCookieName(cookieName);
		this._cookies.set(cookieName, cookieValue);
		const sameSite = opts?.sameSite === true ? "Strict" : typeof opts?.sameSite === "string" ? opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1) : void 0;
		_getState().pendingSetCookies.push(serializeSetCookie(cookieName, cookieValue, {
			...opts,
			expires: typeof opts?.expires === "number" ? new Date(opts.expires) : opts?.expires,
			sameSite
		}));
		return this;
	}
	delete(nameOrOptions) {
		const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name;
		const path = typeof nameOrOptions === "string" ? "/" : nameOrOptions.path ?? "/";
		const domain = typeof nameOrOptions === "string" ? void 0 : nameOrOptions.domain;
		validateCookieName(name);
		validateCookieAttributeValue(path, "Path");
		if (domain) validateCookieAttributeValue(domain, "Domain");
		this._cookies.delete(name);
		const parts = [`${name}=`, `Path=${path}`];
		if (domain) parts.push(`Domain=${domain}`);
		parts.push(`Expires=${EXPIRED_COOKIE_DATE}`);
		_getState().pendingSetCookies.push(parts.join("; "));
		return this;
	}
	get size() {
		return this._cookies.size;
	}
	[Symbol.iterator]() {
		return new Map(Array.from(this._cookies, ([name, value]) => [name, {
			name,
			value
		}])).entries();
	}
	toString() {
		const parts = [];
		for (const [name, value] of this._cookies) parts.push(`${name}=${value}`);
		return parts.join("; ");
	}
};
//#endregion
export { applyMiddlewareRequestHeaders, consumeDynamicUsage, consumeInvalidDynamicUsageError, consumeRenderRequestApiUsage, cookies, draftMode, getActiveDraftModeState, getAndClearPendingCookies, getDraftModeCookieHeader, getHeadersAccessPhase, getHeadersContext, headers, headersContextFromRequest, isDraftModeEnabled, isDraftModeRequest, markDynamicUsage, markRenderRequestApiUsage, peekDynamicUsage, peekRenderRequestApiUsage, runWithConnectionProbe, runWithHeadersContext, runWithIsolatedDynamicUsage, setHeadersAccessPhase, setHeadersContext, suspendConnectionProbe, throwIfInsideCacheScope, throwIfStaticGenerationAccessError };
