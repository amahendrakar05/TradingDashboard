import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { _registerI18nStateAccessors } from "./i18n-context.js";
//#region src/shims/i18n-state.ts
/**
* Server-only i18n state backed by AsyncLocalStorage.
*
* Provides request-scoped isolation for i18n context (locale,
* defaultLocale, domainLocales, hostname) so concurrent requests
* on Workers or Node.js don't share mutable locale state.
*
* This module is server-only — it imports node:async_hooks and must NOT
* be bundled for the browser.
*/
const _FALLBACK_KEY = Symbol.for("vinext.i18n.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.i18n.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= { i18nContext: null };
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
function runWithI18nState(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.i18nContext = null;
	}, fn);
	return _als.run({ i18nContext: null }, fn);
}
_registerI18nStateAccessors({
	getI18nContext() {
		return _getState().i18nContext;
	},
	setI18nContext(ctx) {
		_getState().i18nContext = ctx;
	}
});
//#endregion
export { runWithI18nState };
