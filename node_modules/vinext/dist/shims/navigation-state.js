import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { GLOBAL_ACCESSORS_KEY, _registerStateAccessors } from "./navigation-context-state.js";
import "./navigation-server.js";
//#region src/shims/navigation-state.ts
/**
* Server-only navigation state backed by AsyncLocalStorage.
*
* This module provides request-scoped isolation for navigation context
* and useServerInsertedHTML callbacks. Without ALS, concurrent requests
* on Cloudflare Workers would share module-level state and leak data
* (pathnames, params, CSS-in-JS styles) between requests.
*
* This module is server-only — it imports node:async_hooks and must NOT
* be bundled for the browser. The dual-environment navigation.ts shim
* uses a registration pattern so it works in both environments.
*/
const _FALLBACK_KEY = Symbol.for("vinext.navigation.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.navigation.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= {
	serverContext: null,
	serverInsertedHTMLCallbacks: []
};
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
function runWithNavigationContext(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.serverContext = null;
		uCtx.serverInsertedHTMLCallbacks = [];
	}, fn);
	return _als.run({
		serverContext: null,
		serverInsertedHTMLCallbacks: []
	}, fn);
}
function runWithServerInsertedHTMLState(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.serverInsertedHTMLCallbacks = [];
	}, fn);
	const state = {
		serverContext: (_als.getStore() ?? _fallbackState).serverContext,
		serverInsertedHTMLCallbacks: []
	};
	return _als.run(state, fn);
}
const _accessors = {
	getServerContext() {
		return _getState().serverContext;
	},
	setServerContext(ctx) {
		_getState().serverContext = ctx;
	},
	getInsertedHTMLCallbacks() {
		return _getState().serverInsertedHTMLCallbacks;
	},
	clearInsertedHTMLCallbacks() {
		_getState().serverInsertedHTMLCallbacks = [];
	}
};
_registerStateAccessors(_accessors);
globalThis[GLOBAL_ACCESSORS_KEY] = _accessors;
//#endregion
export { runWithNavigationContext, runWithServerInsertedHTMLState };
