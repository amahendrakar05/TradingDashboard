import { stripBasePath } from "../utils/base-path.js";
import { clearAppNavigationFailureTarget, getAppNavigationFailureTarget } from "../client/app-nav-failure-handler.js";
import { claimAppRouterScrollIntentForCommit, consumeAppRouterScrollIntent } from "../shims/app-router-scroll-state.js";
import { resolveServerActionOperationLane, shouldScheduleRefreshForDiscardedServerAction } from "./app-browser-action-result.js";
import { activateNavigationSnapshot, clearPendingPathname, commitClientNavigationState, createSnapshotPathAndSearch } from "../shims/navigation.js";
import { FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, createPendingNavigationCommit } from "./app-browser-state.js";
import { applyApprovedVisibleCommit, approveHmrVisibleCommit, approvePendingNavigationCommit, resolveAndClassifyNavigationCommit } from "./app-browser-visible-commit.js";
import { startTransition, useInsertionEffect, useLayoutEffect } from "react";
import { flushSync } from "react-dom";
//#region src/server/app-browser-navigation-controller.ts
const HARD_NAVIGATION_LOOP_GUARD_KEY = "__vinext_hard_navigation_target__";
function normalizeBrowserHref(href) {
	try {
		return new URL(href, window.location.href).href;
	} catch {
		return href;
	}
}
function readHardNavigationLoopGuard() {
	try {
		return window.sessionStorage.getItem(HARD_NAVIGATION_LOOP_GUARD_KEY);
	} catch {
		return null;
	}
}
function writeHardNavigationLoopGuard(targetHref) {
	try {
		window.sessionStorage.setItem(HARD_NAVIGATION_LOOP_GUARD_KEY, targetHref);
		return window.sessionStorage.getItem(HARD_NAVIGATION_LOOP_GUARD_KEY) === targetHref;
	} catch {
		return false;
	}
}
function clearHardNavigationLoopGuard() {
	try {
		window.sessionStorage.removeItem(HARD_NAVIGATION_LOOP_GUARD_KEY);
	} catch {}
}
function performHardNavigationWithLoopGuard(href, mode = "assign") {
	const targetHref = normalizeBrowserHref(href);
	const currentHref = normalizeBrowserHref(window.location.href);
	if (readHardNavigationLoopGuard() === targetHref && currentHref === targetHref) {
		clearHardNavigationLoopGuard();
		console.error(`[vinext] Prevented repeated hard navigation to ${targetHref}; leaving the current document in place to avoid a reload loop.`);
		return false;
	}
	if (!writeHardNavigationLoopGuard(targetHref) && currentHref === targetHref) {
		console.error(`[vinext] Hard navigation to ${targetHref} requires a reload-loop guard, but sessionStorage is unavailable; leaving the current document in place.`);
		return false;
	}
	if (mode === "replace") window.location.replace(href);
	else window.location.assign(href);
	return true;
}
function createBasePathStrippedPathAndSearch(url, basePath) {
	const pathname = stripBasePath(url.pathname, basePath);
	const query = new URLSearchParams(url.search).toString();
	return query === "" ? pathname : `${pathname}?${query}`;
}
function isSnapshotTargetHref(basePath, snapshot, targetHref) {
	try {
		const baseHref = typeof window === "undefined" ? "http://localhost" : window.location.href;
		return createBasePathStrippedPathAndSearch(new URL(targetHref, baseHref), basePath) === createSnapshotPathAndSearch(snapshot);
	} catch {
		return false;
	}
}
function createAppBrowserNavigationController(deps = {}) {
	const basePath = deps.basePath ?? "";
	const commitClientNavigationStateImpl = deps.commitClientNavigationState ?? commitClientNavigationState;
	const performHardNavigation = deps.performHardNavigation ?? performHardNavigationWithLoopGuard;
	const getRouteManifest = deps.getRouteManifest ?? (() => null);
	const syncHistoryStatePreviousNextUrl = deps.syncHistoryStatePreviousNextUrl ?? (() => {});
	let nextNavigationRenderId = 0;
	let activeNavigationId = 0;
	let pendingUserNavigationId = null;
	let pendingUserNavigationLane = null;
	let latestHmrUpdateId = 0;
	const pendingNavigationCommits = /* @__PURE__ */ new Map();
	const pendingNavigationFailureTargets = /* @__PURE__ */ new Map();
	const pendingNavigationPrePaintEffects = /* @__PURE__ */ new Map();
	let setBrowserRouterState = null;
	let browserRouterStateRef = null;
	let activePendingBrowserRouterState = null;
	let resolveBrowserRouterStateReady = null;
	let browserRouterStateReadyPromise = null;
	let browserRouterStateHasCommitted = false;
	function getBrowserRouterStateSetter() {
		if (!setBrowserRouterState) throw new Error("[vinext] Browser router state setter is not initialized");
		return setBrowserRouterState;
	}
	function getBrowserRouterState() {
		if (!browserRouterStateRef) throw new Error("[vinext] Browser router state is not initialized");
		return browserRouterStateRef.current;
	}
	function waitForBrowserRouterStateReady() {
		if (browserRouterStateRef || browserRouterStateHasCommitted) return Promise.resolve();
		if (!browserRouterStateReadyPromise) browserRouterStateReadyPromise = new Promise((resolve) => {
			resolveBrowserRouterStateReady = resolve;
		});
		return browserRouterStateReadyPromise;
	}
	function markBrowserRouterStateReady() {
		browserRouterStateHasCommitted = true;
		const resolveReady = resolveBrowserRouterStateReady;
		resolveBrowserRouterStateReady = null;
		browserRouterStateReadyPromise = null;
		resolveReady?.();
	}
	function beginNavigation() {
		latestHmrUpdateId += 1;
		activeNavigationId += 1;
		pendingUserNavigationId = activeNavigationId;
		pendingUserNavigationLane = null;
		return activeNavigationId;
	}
	function getActiveNavigationId() {
		return activeNavigationId;
	}
	function allocateRenderId() {
		nextNavigationRenderId += 1;
		return nextNavigationRenderId;
	}
	function hasBrowserRouterState() {
		return browserRouterStateRef !== null;
	}
	function isCurrentNavigation(navId) {
		return navId === activeNavigationId;
	}
	function beginPendingBrowserRouterState() {
		const setter = getBrowserRouterStateSetter();
		if (activePendingBrowserRouterState && !activePendingBrowserRouterState.settled) {
			activePendingBrowserRouterState.settled = true;
			activePendingBrowserRouterState.resolve(getBrowserRouterState());
		}
		let resolvePending;
		const promise = new Promise((resolve) => {
			resolvePending = resolve;
		});
		if (!resolvePending) throw new Error("[vinext] Failed to initialize browser router promise");
		const pending = {
			promise,
			resolve: resolvePending,
			settled: false
		};
		activePendingBrowserRouterState = pending;
		setter(promise);
		return pending;
	}
	function settlePendingBrowserRouterState(pending) {
		if (!pending || pending.settled) return;
		pending.settled = true;
		pending.resolve(getBrowserRouterState());
		if (activePendingBrowserRouterState === pending) activePendingBrowserRouterState = null;
	}
	function finalizeNavigation(navId, pending) {
		settlePendingBrowserRouterState(pending);
		if (isCurrentNavigation(navId)) {
			pendingUserNavigationId = null;
			pendingUserNavigationLane = null;
			clearPendingPathname(navId);
		}
	}
	function queuePrePaintNavigationEffect(renderId, effect) {
		if (!effect) return;
		pendingNavigationPrePaintEffects.set(renderId, effect);
	}
	/**
	* Run all queued pre-paint effects for renderIds up to and including the
	* given renderId. When React supersedes a startTransition update (rapid
	* clicks on same-route links), the superseded NavigationCommitSignal never
	* mounts, so its pre-paint effect never fires. By draining all effects
	* <= the committed renderId here, the winning transition cleans up after
	* any superseded ones, keeping the counter balanced.
	*
	* Invariant: each superseded navigation gets a commitClientNavigationState()
	* to balance the activateNavigationSnapshot() from its renderNavigationPayload call.
	*/
	function drainPrePaintEffects(upToRenderId) {
		for (const [id, effect] of pendingNavigationPrePaintEffects) {
			if (id > upToRenderId) continue;
			pendingNavigationPrePaintEffects.delete(id);
			if (id === upToRenderId) effect();
			else commitClientNavigationStateImpl(void 0, { releaseSnapshot: true });
		}
	}
	/**
	* Settle all pending navigation renders through the supplied renderId. Only
	* the exact render whose layout effect ran is a successful commit; older
	* superseded renders and cleanup-only settlements resolve as no-commit.
	*/
	function settleNavigationCommits(renderId, committed) {
		for (const [pendingId, pendingCommit] of pendingNavigationCommits) {
			if (pendingId > renderId) continue;
			pendingNavigationCommits.delete(pendingId);
			const didCommit = committed && pendingId === renderId;
			if (didCommit && pendingCommit.committedState !== null) pendingCommit.onCommittedState?.(pendingCommit.committedState);
			pendingCommit.resolve(didCommit);
		}
	}
	function clearCommittedNavigationFailureTargets(renderId) {
		for (const [pendingId, targetHref] of pendingNavigationFailureTargets) {
			if (pendingId > renderId) continue;
			pendingNavigationFailureTargets.delete(pendingId);
			clearAppNavigationFailureTarget(targetHref);
		}
	}
	async function hmrReplaceTree(nextElements, navigationSnapshot) {
		const hmrUpdateId = ++latestHmrUpdateId;
		const startedDuringUserNavigation = pendingUserNavigationLane === "navigation";
		if (!hasBrowserRouterState()) return;
		const pending = await createPendingNavigationCommit({
			currentState: getBrowserRouterState(),
			nextElements,
			navigationSnapshot,
			operationLane: "hmr",
			payloadOrigin: FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN,
			renderId: allocateRenderId(),
			type: "replace"
		});
		if (hmrUpdateId !== latestHmrUpdateId || startedDuringUserNavigation) return;
		if (!hasBrowserRouterState()) return;
		const approval = approveHmrVisibleCommit({
			currentState: getBrowserRouterState(),
			pending,
			routeManifest: deps.getRouteManifest?.() ?? null,
			targetHref: createSnapshotPathAndSearch(navigationSnapshot)
		});
		if (approval.approvedCommit) dispatchSynchronousVisibleCommit(approval.approvedCommit);
		else if (approval.decision.disposition === "hard-navigate") performHardNavigation(createSnapshotPathAndSearch(navigationSnapshot));
	}
	function NavigationCommitSignal({ renderId, children }) {
		useInsertionEffect(() => {
			clearCommittedNavigationFailureTargets(renderId);
		}, [renderId]);
		useLayoutEffect(() => {
			drainPrePaintEffects(renderId);
			settleNavigationCommits(renderId, true);
			return () => {
				settleNavigationCommits(renderId, false);
			};
		}, [renderId]);
		return children;
	}
	function dispatchApprovedVisibleCommit(renderId, commit, pendingRouterState, visibleCommitMode) {
		const setter = getBrowserRouterStateSetter();
		const pendingCommit = pendingNavigationCommits.get(renderId);
		const captureCandidateState = (state) => {
			if (pendingCommit) pendingCommit.committedState = state;
			return state;
		};
		if (pendingRouterState) {
			if (pendingRouterState.settled) return;
			const committedState = captureCandidateState(applyApprovedVisibleCommit(getBrowserRouterState(), commit));
			pendingRouterState.settled = true;
			pendingRouterState.resolve(committedState);
			if (activePendingBrowserRouterState === pendingRouterState) activePendingBrowserRouterState = null;
			return;
		}
		if (visibleCommitMode === "synchronous") {
			flushSync(() => {
				const committedState = captureCandidateState(applyApprovedVisibleCommit(getBrowserRouterState(), commit));
				setter(committedState);
			});
			return;
		}
		startTransition(() => {
			const committedState = captureCandidateState(applyApprovedVisibleCommit(getBrowserRouterState(), commit));
			setter(committedState);
		});
	}
	function dispatchSynchronousVisibleCommit(commit) {
		getBrowserRouterStateSetter()(applyApprovedVisibleCommit(getBrowserRouterState(), commit));
	}
	function createRestoredHistorySnapshotCommit(options) {
		const operation = {
			id: options.renderId,
			lane: "traverse",
			startedVisibleCommitVersion: options.currentState.visibleCommitVersion,
			state: "pending"
		};
		return {
			action: {
				bfcacheIds: options.restoredState.bfcacheIds,
				elements: options.restoredState.elements,
				interception: options.restoredState.interception,
				interceptionContext: options.restoredState.interceptionContext,
				layoutFlags: options.restoredState.layoutFlags,
				layoutIds: options.restoredState.layoutIds,
				navigationSnapshot: options.restoredState.navigationSnapshot,
				operation,
				previousNextUrl: options.restoredState.previousNextUrl,
				renderId: options.renderId,
				rootLayoutTreePath: options.restoredState.rootLayoutTreePath,
				reuseCurrentBfcacheIds: false,
				routeId: options.restoredState.routeId,
				skippedLayoutIds: [],
				slotBindings: options.restoredState.slotBindings,
				type: "traverse"
			},
			interception: options.restoredState.interception,
			interceptionContext: options.restoredState.interceptionContext,
			previousNextUrl: options.restoredState.previousNextUrl,
			rootLayoutTreePath: options.restoredState.rootLayoutTreePath,
			routeId: options.restoredState.routeId,
			restoredHistorySnapshot: true,
			skippedLayoutIds: []
		};
	}
	function restoreHistorySnapshotVisibleState(options) {
		if (!isSnapshotTargetHref(basePath, options.state.navigationSnapshot, options.targetHref)) return false;
		const currentState = getBrowserRouterState();
		const pending = createRestoredHistorySnapshotCommit({
			currentState,
			renderId: allocateRenderId(),
			restoredState: options.state
		});
		const approval = approvePendingNavigationCommit({
			activeNavigationId,
			currentState,
			pending,
			routeManifest: getRouteManifest(),
			startedNavigationId: options.navId,
			targetHref: options.targetHref
		});
		if (approval.approvedCommit === null) return false;
		options.beforeCommit?.();
		dispatchSynchronousVisibleCommit(approval.approvedCommit);
		return true;
	}
	function notifyDiscardedServerActionRevalidation(lifecycleOptions) {
		if (!shouldScheduleRefreshForDiscardedServerAction(lifecycleOptions?.revalidation ?? "none")) return;
		lifecycleOptions?.onDiscardedRevalidation?.();
	}
	async function renderNavigationPayload(options) {
		if (options.navId === pendingUserNavigationId) pendingUserNavigationLane = options.operationLane;
		const renderId = allocateRenderId();
		const failureTarget = getAppNavigationFailureTarget(options.targetHref);
		if (failureTarget) pendingNavigationFailureTargets.set(renderId, failureTarget);
		let resolveCommitted;
		const committed = new Promise((resolve) => {
			resolveCommitted = resolve;
			pendingNavigationCommits.set(renderId, {
				committedState: null,
				onCommittedState: options.onCommittedState,
				resolve
			});
		});
		let snapshotActivated = false;
		try {
			const pending = await createPendingNavigationCommit({
				currentState: getBrowserRouterState(),
				navigationCommitKind: options.navigationCommitKind,
				navigationId: options.navId,
				nextElements: options.nextElements,
				navigationSnapshot: options.navigationSnapshot,
				operationLane: options.operationLane,
				payloadOrigin: options.payloadOrigin,
				previousNextUrl: options.previousNextUrl,
				renderId,
				restoredBfcacheIds: options.restoredBfcacheIds,
				reuseCurrentBfcacheIds: options.reuseCurrentBfcacheIds,
				type: options.actionType
			});
			const approval = approvePendingNavigationCommit({
				activeNavigationId,
				currentState: getBrowserRouterState(),
				pending,
				routeManifest: getRouteManifest(),
				startedNavigationId: options.navId,
				targetHref: options.targetHref
			});
			if (approval.decision.disposition === "no-commit") {
				settlePendingBrowserRouterState(options.pendingRouterState);
				pendingNavigationFailureTargets.delete(renderId);
				if (failureTarget) clearAppNavigationFailureTarget(failureTarget);
				pendingNavigationCommits.delete(renderId);
				resolveCommitted?.(false);
				consumeAppRouterScrollIntent(options.scrollIntent ?? null);
				return "no-commit";
			}
			if (approval.decision.disposition === "hard-navigate") {
				settlePendingBrowserRouterState(options.pendingRouterState);
				pendingNavigationFailureTargets.delete(renderId);
				pendingNavigationCommits.delete(renderId);
				consumeAppRouterScrollIntent(options.scrollIntent ?? null);
				if (performHardNavigation(options.targetHref)) return "hard-navigate";
				if (failureTarget) clearAppNavigationFailureTarget(failureTarget);
				return "no-commit";
			}
			const approvedCommit = approval.approvedCommit;
			if (approvedCommit === null) throw new Error("[vinext] Commit decision did not approve a visible commit");
			queuePrePaintNavigationEffect(renderId, options.createNavigationCommitEffect({
				bfcacheIds: approvedCommit.action.bfcacheIds,
				href: options.targetHref,
				historyUpdateMode: options.historyUpdateMode,
				navId: options.navId,
				params: options.params,
				previousNextUrl: approvedCommit.previousNextUrl,
				targetHistoryIndex: options.targetHistoryIndex
			}));
			claimAppRouterScrollIntentForCommit(options.scrollIntent, renderId);
			activateNavigationSnapshot();
			snapshotActivated = true;
			dispatchApprovedVisibleCommit(renderId, approvedCommit, options.pendingRouterState, options.visibleCommitMode ?? "transition");
		} catch (error) {
			pendingNavigationFailureTargets.delete(renderId);
			pendingNavigationPrePaintEffects.delete(renderId);
			pendingNavigationCommits.delete(renderId);
			if (snapshotActivated) commitClientNavigationStateImpl(options.navId);
			settlePendingBrowserRouterState(options.pendingRouterState);
			resolveCommitted?.(false);
			throw error;
		}
		return committed.then((didCommit) => didCommit ? "committed" : "no-commit");
	}
	async function commitSameUrlNavigatePayload(nextElements, navigationSnapshot, returnValue, actionInitiationState, lifecycleOptions) {
		const currentState = actionInitiationState ?? getBrowserRouterState();
		const startedNavigationId = lifecycleOptions?.startedNavigationId ?? activeNavigationId;
		const targetHref = lifecycleOptions?.targetHref ?? window.location.href;
		const { approvedCommit, decision, pending, trace: _navigationTrace } = await resolveAndClassifyNavigationCommit({
			activeNavigationId,
			currentState,
			getActiveNavigationId: () => activeNavigationId,
			getCurrentStateForApproval: getBrowserRouterState,
			navigationSnapshot,
			nextElements,
			renderId: allocateRenderId(),
			operationLane: resolveServerActionOperationLane(lifecycleOptions?.revalidation ?? "none"),
			payloadOrigin: FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN,
			startedNavigationId,
			routeManifest: getRouteManifest(),
			targetHref,
			type: "navigate"
		});
		if (decision.disposition === "hard-navigate") {
			performHardNavigation(targetHref);
			return;
		}
		if (approvedCommit) {
			const latestApproval = approvePendingNavigationCommit({
				activeNavigationId,
				currentState: getBrowserRouterState(),
				pending,
				routeManifest: getRouteManifest(),
				startedNavigationId,
				targetHref
			});
			if (latestApproval.decision.disposition === "hard-navigate") {
				performHardNavigation(targetHref);
				return;
			}
			if (latestApproval.approvedCommit) {
				const approvedRevalidationCommit = latestApproval.approvedCommit;
				startTransition(() => {
					dispatchSynchronousVisibleCommit(approvedRevalidationCommit);
				});
				syncHistoryStatePreviousNextUrl(approvedRevalidationCommit.previousNextUrl, approvedRevalidationCommit.action.bfcacheIds);
			} else notifyDiscardedServerActionRevalidation(lifecycleOptions);
		} else if (decision.disposition === "no-commit") notifyDiscardedServerActionRevalidation(lifecycleOptions);
		if (returnValue) {
			if (!returnValue.ok) throw returnValue.data;
			return returnValue.data;
		}
	}
	function attachBrowserRouterState(setter, stateRef) {
		setBrowserRouterState = setter;
		browserRouterStateRef = stateRef;
		markBrowserRouterStateReady();
		return () => {
			if (setBrowserRouterState === setter) setBrowserRouterState = null;
			if (browserRouterStateRef === stateRef) {
				browserRouterStateRef = null;
				browserRouterStateHasCommitted = false;
			}
		};
	}
	return {
		beginNavigation,
		getActiveNavigationId,
		hasBrowserRouterState,
		getBrowserRouterState,
		isCurrentNavigation,
		performHardNavigation,
		waitForBrowserRouterStateReady,
		attachBrowserRouterState,
		beginPendingBrowserRouterState,
		finalizeNavigation,
		restoreHistorySnapshotVisibleState,
		renderNavigationPayload,
		commitSameUrlNavigatePayload,
		hmrReplaceTree,
		drainPrePaintEffects,
		clearCommittedNavigationFailureTargets,
		NavigationCommitSignal
	};
}
//#endregion
export { clearHardNavigationLoopGuard, createAppBrowserNavigationController, createBasePathStrippedPathAndSearch, createSnapshotPathAndSearch };
