//#region src/shims/app-router-scroll-state.ts
const _SCROLL_INTENT_KEY = Symbol.for("vinext.appRouterScrollIntent");
function getScrollIntentStore() {
	const globalState = globalThis;
	globalState[_SCROLL_INTENT_KEY] ??= {
		nextId: 0,
		pending: null
	};
	return globalState[_SCROLL_INTENT_KEY];
}
function beginAppRouterScrollIntent(hash) {
	const store = getScrollIntentStore();
	store.nextId += 1;
	const intent = {
		commitId: null,
		hash,
		headElements: typeof document === "undefined" ? null : new Set(document.head?.children ?? []),
		id: store.nextId,
		targetHoistedInHead: false
	};
	store.pending = intent;
	return intent;
}
function clearAppRouterScrollIntent() {
	getScrollIntentStore().pending = null;
}
function getPendingAppRouterScrollIntent() {
	return getScrollIntentStore().pending;
}
function claimAppRouterScrollIntentForCommit(expected, commitId) {
	const store = getScrollIntentStore();
	const intent = store.pending;
	if (expected === null || expected === void 0 || intent === null) return;
	if (intent.id !== expected.id) return;
	store.pending = {
		...intent,
		commitId
	};
}
function markAppRouterScrollIntentHeadHoisted(expected, commitId) {
	const store = getScrollIntentStore();
	const intent = store.pending;
	if (expected === null || expected === void 0 || intent === null) return;
	if (intent.id !== expected.id) return;
	if (intent.commitId !== commitId) return;
	store.pending = {
		...intent,
		targetHoistedInHead: true
	};
}
function consumeAppRouterScrollIntent(expected, commitId) {
	if (expected === null || expected === void 0) return null;
	const store = getScrollIntentStore();
	const intent = store.pending;
	if (intent === null) return null;
	if (intent.id !== expected.id) return null;
	if (commitId !== void 0 && intent.commitId !== commitId) return null;
	store.pending = null;
	return intent;
}
//#endregion
export { beginAppRouterScrollIntent, claimAppRouterScrollIntentForCommit, clearAppRouterScrollIntent, consumeAppRouterScrollIntent, getPendingAppRouterScrollIntent, markAppRouterScrollIntentHeadHoisted };
