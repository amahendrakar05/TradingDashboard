import { normalizePathnameForRouteMatch } from "../routing/utils.js";
import { stripBasePath } from "../utils/base-path.js";
import { NEXT_ACTION_HEADER, RSC_ACTION_HEADER, VINEXT_INTERCEPTION_CONTEXT_HEADER, VINEXT_MOUNTED_SLOTS_HEADER } from "./headers.js";
import { normalizePath } from "./normalize-path.js";
import { AppElementsWire } from "./app-elements-wire.js";
import { getMountedSlotIds, getMountedSlotIdsHeader } from "./app-elements.js";
import { createRscRequestHeaders } from "./app-rsc-cache-busting.js";
import { createCacheEntryReuseProof } from "./cache-proof.js";
import { createBfcacheSegmentStateKeyMap, createInitialBfcacheIdMap, createNextBfcacheIdMap, preserveBfcacheIdsForMergedElements } from "./app-bfcache-identity.js";
import { createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, isHistoryStateBfcacheVersionCurrent, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent } from "./app-history-state.js";
import { NavigationTraceReasonCodes, createNavigationLifecycleTraceFields, createNavigationTrace } from "./navigation-trace.js";
import { verifyOperationTokenForCommit } from "./operation-token.js";
import { navigationPlanner, resolveDefaultOrUnmatchedSlotPersistenceForLayouts } from "./navigation-planner.js";
import { createSnapshotPathAndSearch } from "../shims/navigation.js";
//#region src/server/app-browser-state.ts
const COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN = { origin: "committed-cache" };
const FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN = { origin: "fresh" };
const VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN = { origin: "visited-cache" };
function createOperationRecord(options) {
	return {
		id: options.id,
		lane: options.lane,
		...options.navigationCommitKind !== void 0 ? { navigationCommitKind: options.navigationCommitKind } : {},
		...options.navigationId !== void 0 ? { navigationId: options.navigationId } : {},
		startedVisibleCommitVersion: options.startedVisibleCommitVersion,
		state: "pending"
	};
}
function isCompleteAppPayloadMetadata(metadata) {
	return metadata.skippedLayoutIds.length === 0;
}
function isCacheRestorableAppPayloadMetadata(metadata) {
	return metadata.cacheEntryReuseProof !== void 0 && isCompleteAppPayloadMetadata(metadata);
}
function requiresCacheEntryReuseProof(origin) {
	switch (origin.origin) {
		case "committed-cache":
		case "fresh": return false;
		case "visited-cache": return true;
		default: throw new Error("[vinext] Unknown App Router payload origin: " + String(origin));
	}
}
function normalizeNavigationSnapshotMatchedUrl(pathname) {
	return normalizePath(normalizePathnameForRouteMatch(pathname));
}
function createRouteSnapshotRouteId(options) {
	if (options.interception !== null) return options.routeId;
	const parsed = AppElementsWire.parseElementKey(options.routeId);
	if (parsed?.kind !== "route" || parsed.interceptionContext === null) return options.routeId;
	return AppElementsWire.encodeRouteId(parsed.path, null);
}
function resolveInterceptionContextFromPreviousNextUrl(previousNextUrl, basePath = "") {
	if (previousNextUrl === null) return null;
	return stripBasePath(new URL(previousNextUrl, "http://localhost").pathname, basePath);
}
/**
* Pure: builds the fetch Headers for a server-action POST. Carries the same
* interception-context and mounted-slots headers the refresh path already
* sends, so the server-action re-render can rebuild the intercepted tree
* instead of replacing it with the direct route.
*
* Next.js sends `Next-URL: state.previousNextUrl || state.nextUrl` on action
* POSTs when `hasInterceptionRouteInCurrentTree(state.tree)`. Vinext's
* X-Vinext-Interception-Context is the equivalent signal for the server-side
* `findIntercept` lookup.
*/
function resolveServerActionRequestState(options) {
	const headers = createRscRequestHeaders();
	headers.set(RSC_ACTION_HEADER, options.actionId);
	headers.set(NEXT_ACTION_HEADER, options.actionId);
	const interceptionContext = resolveInterceptionContextFromPreviousNextUrl(options.previousNextUrl, options.basePath) ?? options.interceptionContext ?? null;
	if (interceptionContext !== null) headers.set(VINEXT_INTERCEPTION_CONTEXT_HEADER, interceptionContext);
	const mountedSlotsHeader = getMountedSlotIdsHeader(options.elements);
	if (mountedSlotsHeader !== null) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
	return { headers };
}
function resolvePendingNavigationCommitDispositionDecision(options) {
	const traceFields = createPendingNavigationTraceFields(options);
	const targetSnapshot = createPendingRouteSnapshot(options.pending);
	const token = createPendingNavigationOperationToken({
		pending: options.pending,
		routeManifest: options.routeManifest ?? null,
		startedNavigationId: options.startedNavigationId,
		targetSnapshot
	});
	if (options.pending.action.operation.navigationCommitKind === "detached" && options.currentState.activeOperation?.navigationId === options.startedNavigationId && options.currentState.activeOperation.navigationCommitKind === "authoritative") return {
		disposition: "skip",
		preserveElementIds: [],
		trace: createNavigationTrace(NavigationTraceReasonCodes.staleOperation, traceFields)
	};
	const visibleCommitVersion = options.currentState.activeOperation?.navigationId === options.startedNavigationId && options.currentState.activeOperation.navigationCommitKind === "detached" && options.pending.action.operation.navigationCommitKind === "authoritative" ? options.pending.action.operation.startedVisibleCommitVersion : options.currentState.visibleCommitVersion;
	const verdict = verifyOperationTokenForCommit(token, {
		activeNavigationId: options.activeNavigationId,
		visibleCommitVersion
	});
	if (!verdict.authorized) return {
		disposition: "skip",
		preserveElementIds: [],
		trace: createNavigationTrace(NavigationTraceReasonCodes.staleOperation, traceFields)
	};
	const decision = mapNavigationDecisionToPendingDisposition(planPendingRootBoundaryFlightResponse({
		currentState: options.currentState,
		pending: options.pending,
		routeManifest: options.routeManifest ?? null,
		targetHref: options.targetHref,
		targetSnapshot,
		token: verdict.token,
		traceFields
	}));
	return mergeSkippedLayoutPreservation({
		currentState: options.currentState,
		decision,
		pending: options.pending
	});
}
function createPendingNavigationTraceFields(options) {
	return {
		...createNavigationLifecycleTraceFields({
			activeNavigationId: options.activeNavigationId,
			currentRootLayoutTreePath: options.currentState.rootLayoutTreePath,
			currentVisibleCommitVersion: options.currentState.visibleCommitVersion,
			nextRootLayoutTreePath: options.pending.rootLayoutTreePath,
			startedNavigationId: options.startedNavigationId,
			startedVisibleCommitVersion: options.pending.action.operation.startedVisibleCommitVersion
		}),
		...options.targetHref !== void 0 ? { targetHref: options.targetHref } : {}
	};
}
function createMountedParallelSlotSnapshots(elements) {
	const snapshots = [];
	for (const slotId of getMountedSlotIds(elements)) {
		const parsed = AppElementsWire.parseElementKey(slotId);
		if (parsed?.kind !== "slot") continue;
		snapshots.push({
			ownerLayoutId: AppElementsWire.encodeLayoutId(parsed.treePath),
			slotId
		});
	}
	return snapshots;
}
function createVisibleRouteSnapshot(state) {
	const displayUrl = createSnapshotPathAndSearch(state.navigationSnapshot);
	const matchedUrl = state.interception?.targetMatchedUrl ?? normalizeNavigationSnapshotMatchedUrl(state.navigationSnapshot.pathname);
	return {
		displayUrl,
		interception: state.interception,
		interceptionContext: state.interceptionContext,
		layoutIds: state.layoutIds,
		matchedUrl,
		mountedParallelSlots: createMountedParallelSlotSnapshots(state.elements),
		rootBoundaryId: state.rootLayoutTreePath,
		routeId: createRouteSnapshotRouteId({
			interception: state.interception,
			routeId: state.routeId
		}),
		slotBindings: state.slotBindings
	};
}
function createPendingRouteSnapshot(pending) {
	const displayUrl = createSnapshotPathAndSearch(pending.action.navigationSnapshot);
	const matchedUrl = pending.action.interception?.targetMatchedUrl ?? normalizeNavigationSnapshotMatchedUrl(pending.action.navigationSnapshot.pathname);
	return {
		displayUrl,
		interception: pending.action.interception,
		interceptionContext: pending.action.interceptionContext,
		layoutIds: pending.action.layoutIds,
		matchedUrl,
		mountedParallelSlots: createMountedParallelSlotSnapshots(pending.action.elements),
		rootBoundaryId: pending.rootLayoutTreePath,
		routeId: createRouteSnapshotRouteId({
			interception: pending.action.interception,
			routeId: pending.routeId
		}),
		slotBindings: pending.action.slotBindings
	};
}
function createPendingNavigationOperationToken(options) {
	return {
		baseVisibleCommitVersion: options.pending.action.operation.startedVisibleCommitVersion,
		deploymentVersion: null,
		graphVersion: options.routeManifest?.graphVersion ?? null,
		lane: options.pending.action.operation.lane,
		navigationId: options.startedNavigationId,
		operationId: options.pending.action.operation.id,
		targetSnapshotFingerprint: createRootBoundarySnapshotFingerprint(options.targetSnapshot)
	};
}
function createRootBoundarySnapshotFingerprint(snapshot) {
	return `${snapshot.routeId}|root:${snapshot.rootBoundaryId ?? "unknown"}`;
}
function planPendingRootBoundaryFlightResponse(options) {
	const cacheEntryReuseProof = options.pending.cacheEntryReuseProof;
	return navigationPlanner.plan({
		routeManifest: options.routeManifest,
		state: {
			nextOperationToken: options.token,
			traceFields: options.traceFields,
			visibleCommitVersion: options.currentState.visibleCommitVersion,
			visibleSnapshot: createVisibleRouteSnapshot(options.currentState)
		},
		event: {
			kind: "flightResponseArrived",
			result: {
				...cacheEntryReuseProof ? { cacheEntryReuseProof } : {},
				...options.pending.restoredHistorySnapshot ? { restoredHistorySnapshot: true } : {},
				href: options.targetHref ?? options.targetSnapshot.displayUrl,
				targetSnapshot: options.targetSnapshot
			},
			token: options.token
		}
	});
}
function mapNavigationDecisionToPendingDisposition(decision) {
	switch (decision.kind) {
		case "proposeCommit": return {
			disposition: "dispatch",
			preserveAbsentSlots: decision.proposal.preserveAbsentSlots,
			preserveElementIds: decision.proposal.preserveElementIds,
			preservePreviousSlotIds: decision.proposal.preservePreviousSlotIds,
			trace: decision.trace
		};
		case "hardNavigate": return {
			disposition: "hard-navigate",
			preserveElementIds: [],
			trace: decision.trace
		};
		case "noCommit": return {
			disposition: "skip",
			preserveElementIds: [],
			trace: decision.trace
		};
		case "requestWork": throw new Error(`[vinext] Root-boundary commit planning returned requestWork (${decision.work.kind}); flightResponseArrived should never request work`);
		default: throw new Error("[vinext] Unknown navigation decision: " + String(decision));
	}
}
function mergeSkippedLayoutPreservation(options) {
	if (options.decision.disposition !== "dispatch") return options.decision;
	if (options.pending.skippedLayoutIds.length === 0) return options.decision;
	const currentLayoutIds = new Set(options.currentState.layoutIds);
	const targetLayoutIds = new Set(options.pending.action.layoutIds);
	const preserveElementIds = [...options.decision.preserveElementIds];
	const seenPreservedIds = new Set(preserveElementIds);
	const newlyPreservedLayoutIds = [];
	for (const id of options.pending.skippedLayoutIds) {
		if (seenPreservedIds.has(id)) continue;
		if (AppElementsWire.parseElementKey(id)?.kind !== "layout") continue;
		if (!currentLayoutIds.has(id) || !targetLayoutIds.has(id)) continue;
		if (!Object.hasOwn(options.currentState.elements, id)) continue;
		preserveElementIds.push(id);
		seenPreservedIds.add(id);
		newlyPreservedLayoutIds.push(id);
	}
	if (newlyPreservedLayoutIds.length === 0) return options.decision;
	const preservePreviousSlotIds = mergeSkippedLayoutSlotPreservation({
		currentSlotBindings: options.currentState.slotBindings,
		preservePreviousSlotIds: options.decision.preservePreviousSlotIds,
		skippedLayoutIds: newlyPreservedLayoutIds,
		targetSlotBindings: options.pending.action.slotBindings
	});
	return {
		...options.decision,
		preserveElementIds,
		preservePreviousSlotIds
	};
}
function mergeSkippedLayoutSlotPreservation(options) {
	const ownedSlotIds = resolveDefaultOrUnmatchedSlotPersistenceForLayouts({
		currentSlotBindings: options.currentSlotBindings,
		preservedLayoutIds: options.skippedLayoutIds,
		targetSlotBindings: options.targetSlotBindings
	});
	if (ownedSlotIds.length === 0) return options.preservePreviousSlotIds;
	const preservePreviousSlotIds = [...options.preservePreviousSlotIds];
	const seenSlotIds = new Set(preservePreviousSlotIds);
	for (const slotId of ownedSlotIds) {
		if (seenSlotIds.has(slotId)) continue;
		preservePreviousSlotIds.push(slotId);
		seenSlotIds.add(slotId);
	}
	return preservePreviousSlotIds;
}
async function createPendingNavigationCommit(options) {
	const elements = await options.nextElements;
	const metadata = AppElementsWire.readMetadata(elements);
	const cacheEntryReuseProof = metadata.cacheEntryReuseProof ?? (requiresCacheEntryReuseProof(options.payloadOrigin) ? createCacheEntryReuseProof(null) : void 0);
	const requestedPreviousNextUrl = options.previousNextUrl !== void 0 ? options.previousNextUrl : options.currentState.previousNextUrl;
	const previousNextUrl = metadata.interception === null ? null : requestedPreviousNextUrl;
	return {
		action: {
			bfcacheIds: createNextBfcacheIdMap({
				current: options.currentState.bfcacheIds,
				currentElements: options.currentState.elements,
				currentPathname: options.currentState.navigationSnapshot.pathname,
				elements,
				nextPathname: options.navigationSnapshot.pathname,
				restored: options.restoredBfcacheIds,
				reuseCurrent: options.reuseCurrentBfcacheIds
			}),
			...cacheEntryReuseProof ? { cacheEntryReuseProof } : {},
			elements,
			interception: metadata.interception,
			interceptionContext: metadata.interceptionContext,
			layoutIds: metadata.layoutIds,
			layoutFlags: metadata.layoutFlags,
			slotBindings: metadata.slotBindings,
			navigationSnapshot: options.navigationSnapshot,
			operation: createOperationRecord({
				id: options.renderId,
				lane: options.operationLane,
				navigationCommitKind: options.navigationCommitKind,
				navigationId: options.navigationId,
				startedVisibleCommitVersion: options.currentState.visibleCommitVersion
			}),
			previousNextUrl,
			renderId: options.renderId,
			rootLayoutTreePath: metadata.rootLayoutTreePath,
			reuseCurrentBfcacheIds: options.reuseCurrentBfcacheIds ?? true,
			routeId: metadata.routeId,
			skippedLayoutIds: metadata.skippedLayoutIds,
			type: options.type
		},
		...cacheEntryReuseProof ? { cacheEntryReuseProof } : {},
		interception: metadata.interception,
		interceptionContext: metadata.interceptionContext,
		previousNextUrl,
		rootLayoutTreePath: metadata.rootLayoutTreePath,
		routeId: metadata.routeId,
		skippedLayoutIds: metadata.skippedLayoutIds
	};
}
//#endregion
export { COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, createBfcacheSegmentStateKeyMap, createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, createInitialBfcacheIdMap, createNextBfcacheIdMap, createPendingNavigationCommit, isCacheRestorableAppPayloadMetadata, isCompleteAppPayloadMetadata, isHistoryStateBfcacheVersionCurrent, preserveBfcacheIdsForMergedElements, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent, resolveInterceptionContextFromPreviousNextUrl, resolvePendingNavigationCommitDispositionDecision, resolveServerActionRequestState };
