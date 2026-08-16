import { readHistoryStateTraversalIndex } from "./app-history-state.js";
import "./app-browser-state.js";
//#region src/server/app-browser-popstate.ts
function hasSavedScrollPosition(state) {
	return Boolean(state && typeof state === "object" && "__vinext_scrollY" in state);
}
function restoreSynchronousPopstateScrollPosition(deps, state) {
	const navId = deps.getActiveNavigationId();
	deps.markScrollRestoreConsumed(navId);
	deps.restorePopstateScrollPosition(state, { shouldContinue: () => deps.isCurrentNavigation(navId) });
}
function scheduleAfterFrame(callback) {
	if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
		window.requestAnimationFrame(callback);
		return;
	}
	queueMicrotask(callback);
}
function createPopstateTraversalIntent(historyState) {
	return {
		direction: "unknown",
		historyState,
		targetHistoryIndex: readHistoryStateTraversalIndex(historyState)
	};
}
function createPopstateRestoreHandler(deps) {
	return (event) => {
		deps.notifyAppRouterTransitionStart(window.location.href);
		const pendingNavigation = deps.getNavigate()?.(window.location.href, 0, "traverse", void 0, void 0, false, createPopstateTraversalIntent(event.state)) ?? Promise.resolve();
		const popstateNavId = deps.getActiveNavigationId();
		deps.setPendingNavigation(pendingNavigation);
		const shouldRestoreSavedScroll = hasSavedScrollPosition(event.state);
		const shouldRestoreScrollForNavigation = () => deps.isCurrentNavigation(popstateNavId) && !deps.shouldSkipScrollRestore(popstateNavId);
		if (shouldRestoreSavedScroll) scheduleAfterFrame(() => {
			if (shouldRestoreScrollForNavigation()) deps.restorePopstateScrollPosition(event.state, { shouldContinue: shouldRestoreScrollForNavigation });
		});
		pendingNavigation.finally(() => {
			if (shouldRestoreScrollForNavigation() && !shouldRestoreSavedScroll) deps.restorePopstateScrollPosition(event.state);
			if (deps.getPendingNavigation() === pendingNavigation) deps.setPendingNavigation(null);
		});
	};
}
//#endregion
export { createPopstateRestoreHandler, restoreSynchronousPopstateScrollPosition };
