import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { _registerRouterStateAccessors } from "./router.js";
import { registerRoutePatternForWarningAccessor } from "./internal/route-pattern-for-warning.js";
//#region src/shims/router-state.ts
/**
* Server-only Pages Router state backed by AsyncLocalStorage.
*
* Provides request-scoped isolation for SSR context (pathname, query,
* locale) so concurrent requests on Workers don't share state.
*
* This module is server-only — it imports node:async_hooks and must NOT
* be bundled for the browser.
*/
const _FALLBACK_KEY = Symbol.for("vinext.router.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.router.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= { ssrContext: null };
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
function runWithRouterState(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.ssrContext = null;
	}, fn);
	return _als.run({ ssrContext: null }, fn);
}
_registerRouterStateAccessors({
	getSSRContext() {
		return _getState().ssrContext;
	},
	setSSRContext(ctx) {
		_getState().ssrContext = ctx;
	}
});
registerRoutePatternForWarningAccessor(() => _getState().ssrContext?.pathname ?? null);
//#endregion
export { runWithRouterState };
