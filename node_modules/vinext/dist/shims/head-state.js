import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
import { _registerHeadStateAccessors } from "./head.js";
//#region src/shims/head-state.ts
const _FALLBACK_KEY = Symbol.for("vinext.head.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.head.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= {
	ssrHeadChildren: [],
	documentInitialHead: []
};
function _getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
function runWithHeadState(fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.ssrHeadChildren = [];
		uCtx.documentInitialHead = [];
	}, fn);
	return _als.run({
		ssrHeadChildren: [],
		documentInitialHead: []
	}, fn);
}
_registerHeadStateAccessors({
	getSSRHeadChildren() {
		return _getState().ssrHeadChildren;
	},
	resetSSRHead() {
		const s = _getState();
		s.ssrHeadChildren = [];
		s.documentInitialHead = [];
	},
	getDocumentInitialHead() {
		return _getState().documentInitialHead;
	},
	setDocumentInitialHead(head) {
		_getState().documentInitialHead = head;
	}
});
//#endregion
export { runWithHeadState };
