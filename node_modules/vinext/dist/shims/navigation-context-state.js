import * as React$1 from "react";
//#region src/shims/navigation-context-state.ts
const LAYOUT_SEGMENT_CONTEXT_KEY = Symbol.for("vinext.layoutSegmentContext");
const SERVER_INSERTED_HTML_CONTEXT_KEY = Symbol.for("vinext.serverInsertedHTMLContext");
const BFCACHE_ID_MAP_CONTEXT_KEY = Symbol.for("vinext.bfcacheIdMapContext");
const BFCACHE_SEGMENT_ID_CONTEXT_KEY = Symbol.for("vinext.bfcacheSegmentIdContext");
const GLOBAL_HYDRATION_CONTEXT_KEY = Symbol.for("vinext.navigation.clientHydrationContext");
const NAVIGATION_FALLBACK_STATE_KEY = Symbol.for("vinext.navigation.fallback");
function createContextIfAvailable(defaultValue) {
	return typeof React$1.createContext === "function" ? React$1.createContext(defaultValue) : null;
}
function getServerInsertedHTMLContext() {
	const globalState = globalThis;
	if (!globalState[SERVER_INSERTED_HTML_CONTEXT_KEY]) globalState[SERVER_INSERTED_HTML_CONTEXT_KEY] = createContextIfAvailable(null);
	return globalState[SERVER_INSERTED_HTML_CONTEXT_KEY] ?? null;
}
const ServerInsertedHTMLContext = getServerInsertedHTMLContext();
function getLayoutSegmentContext() {
	const globalState = globalThis;
	if (!globalState[LAYOUT_SEGMENT_CONTEXT_KEY]) globalState[LAYOUT_SEGMENT_CONTEXT_KEY] = createContextIfAvailable({ children: [] });
	return globalState[LAYOUT_SEGMENT_CONTEXT_KEY] ?? null;
}
function getBfcacheIdMapContext() {
	const globalState = globalThis;
	if (!globalState[BFCACHE_ID_MAP_CONTEXT_KEY]) globalState[BFCACHE_ID_MAP_CONTEXT_KEY] = createContextIfAvailable(null);
	return globalState[BFCACHE_ID_MAP_CONTEXT_KEY] ?? null;
}
function getBfcacheSegmentIdContext() {
	const globalState = globalThis;
	if (!globalState[BFCACHE_SEGMENT_ID_CONTEXT_KEY]) globalState[BFCACHE_SEGMENT_ID_CONTEXT_KEY] = createContextIfAvailable(null);
	return globalState[BFCACHE_SEGMENT_ID_CONTEXT_KEY] ?? null;
}
const GLOBAL_ACCESSORS_KEY = Symbol.for("vinext.navigation.globalAccessors");
function getFallbackState() {
	const globalState = globalThis;
	return globalState[NAVIGATION_FALLBACK_STATE_KEY] ??= {
		serverContext: null,
		serverInsertedHTMLCallbacks: []
	};
}
function getGlobalAccessors() {
	return globalThis[GLOBAL_ACCESSORS_KEY];
}
function getClientHydrationContext() {
	const globalState = globalThis;
	if (Object.prototype.hasOwnProperty.call(globalState, GLOBAL_HYDRATION_CONTEXT_KEY)) return globalState[GLOBAL_HYDRATION_CONTEXT_KEY] ?? null;
}
function setClientHydrationContext(context) {
	globalThis[GLOBAL_HYDRATION_CONTEXT_KEY] = context;
}
function clearClientHydrationContext() {
	if (typeof window !== "undefined") setClientHydrationContext(null);
}
let getServerContext = () => {
	if (typeof window !== "undefined") {
		const hydrationContext = getClientHydrationContext();
		return hydrationContext !== void 0 ? hydrationContext : getFallbackState().serverContext;
	}
	return getGlobalAccessors()?.getServerContext() ?? getFallbackState().serverContext;
};
let setServerContext = (context) => {
	if (typeof window !== "undefined") {
		getFallbackState().serverContext = context;
		setClientHydrationContext(context);
		return;
	}
	const accessors = getGlobalAccessors();
	if (accessors) accessors.setServerContext(context);
	else getFallbackState().serverContext = context;
};
let getInsertedHTMLCallbacks = () => getGlobalAccessors()?.getInsertedHTMLCallbacks() ?? getFallbackState().serverInsertedHTMLCallbacks;
let clearInsertedHTMLCallbacks = () => {
	const accessors = getGlobalAccessors();
	if (accessors) accessors.clearInsertedHTMLCallbacks();
	else getFallbackState().serverInsertedHTMLCallbacks = [];
};
/**
* Register request-scoped accessors supplied by navigation-state.ts.
* The global accessor key also bridges separate Vite module instances.
*/
function _registerStateAccessors(accessors) {
	getServerContext = accessors.getServerContext;
	setServerContext = accessors.setServerContext;
	getInsertedHTMLCallbacks = accessors.getInsertedHTMLCallbacks;
	clearInsertedHTMLCallbacks = accessors.clearInsertedHTMLCallbacks;
}
function getNavigationContext() {
	return getServerContext();
}
function setNavigationContext(context) {
	setServerContext(context);
}
function registerServerInsertedHTMLCallback(callback) {
	getInsertedHTMLCallbacks().push(callback);
}
function renderInsertedHTMLCallbacks(clear) {
	const callbacks = getInsertedHTMLCallbacks();
	const results = [];
	for (const callback of callbacks) try {
		const result = callback();
		if (result != null) results.push(result);
	} catch {}
	if (clear) callbacks.length = 0;
	return results;
}
function flushServerInsertedHTML() {
	return renderInsertedHTMLCallbacks(true);
}
function renderServerInsertedHTML() {
	return renderInsertedHTMLCallbacks(false);
}
function clearServerInsertedHTML() {
	clearInsertedHTMLCallbacks();
}
//#endregion
export { GLOBAL_ACCESSORS_KEY, ServerInsertedHTMLContext, _registerStateAccessors, clearClientHydrationContext, clearServerInsertedHTML, flushServerInsertedHTML, getBfcacheIdMapContext, getBfcacheSegmentIdContext, getLayoutSegmentContext, getNavigationContext, registerServerInsertedHTMLCallback, renderServerInsertedHTML, setNavigationContext };
