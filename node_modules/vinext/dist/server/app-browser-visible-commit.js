import { normalizeAppElementsSlotBindings } from "./app-elements-wire.js";
import "./app-elements.js";
import { mergeElements } from "../shims/slot.js";
import { preserveBfcacheIdsForMergedElements } from "./app-bfcache-identity.js";
import { NavigationTraceReasonCodes, NavigationTraceTransactionCodes, createNavigationTrace, prependNavigationTraceEntry } from "./navigation-trace.js";
import { createPendingNavigationCommit, resolvePendingNavigationCommitDispositionDecision } from "./app-browser-state.js";
//#region src/server/app-browser-visible-commit.ts
const approvedVisibleCommitBrand = Symbol("ApprovedVisibleCommit");
function applyApprovedVisibleCommit(state, commit) {
	assertApprovedVisibleCommit(commit);
	return reduceApprovedVisibleCommitState(state, commit);
}
function assertApprovedVisibleCommit(commit) {
	if (commit[approvedVisibleCommitBrand] !== true) throw new Error("[vinext] Visible router state mutation requires ApprovedVisibleCommit");
}
function commitOperationRecord(operation, visibleCommitVersion) {
	return {
		id: operation.id,
		lane: operation.lane,
		...operation.navigationCommitKind !== void 0 ? { navigationCommitKind: operation.navigationCommitKind } : {},
		...operation.navigationId !== void 0 ? { navigationId: operation.navigationId } : {},
		startedVisibleCommitVersion: operation.startedVisibleCommitVersion,
		state: "committed",
		visibleCommitVersion
	};
}
function commitVisibleRouterState(state, nextState, operation) {
	const visibleCommitVersion = state.visibleCommitVersion + 1;
	return {
		...nextState,
		activeOperation: commitOperationRecord(operation, visibleCommitVersion),
		visibleCommitVersion
	};
}
function mergeSlotBindings(previousBindings, nextBindings, layoutIds, preservePreviousSlotIds) {
	if (preservePreviousSlotIds.length === 0) return nextBindings;
	const preservedSlotIds = new Set(preservePreviousSlotIds);
	const previousBindingsBySlotId = /* @__PURE__ */ new Map();
	for (const binding of previousBindings) {
		if (!preservedSlotIds.has(binding.slotId)) continue;
		previousBindingsBySlotId.set(binding.slotId, binding);
	}
	const mergedBindings = [];
	const seenSlotIds = /* @__PURE__ */ new Set();
	for (const binding of nextBindings) {
		const previousBinding = previousBindingsBySlotId.get(binding.slotId);
		mergedBindings.push(previousBinding ?? binding);
		seenSlotIds.add(binding.slotId);
	}
	for (const slotId of preservePreviousSlotIds) {
		if (seenSlotIds.has(slotId)) continue;
		const previousBinding = previousBindingsBySlotId.get(slotId);
		if (previousBinding) mergedBindings.push(previousBinding);
	}
	return normalizeAppElementsSlotBindings(mergedBindings, { layoutIds });
}
function reduceApprovedVisibleCommitState(state, commit) {
	const { action } = commit;
	switch (action.type) {
		case "traverse":
		case "navigate":
		case "replace": {
			const bfcacheCompatiblePreserveElementIds = action.reuseCurrentBfcacheIds && action.operation.lane !== "refresh" ? commit.decision.preserveElementIds.filter((id) => {
				const previousBfcacheId = state.bfcacheIds[id];
				return previousBfcacheId !== void 0 && action.bfcacheIds[id] === previousBfcacheId;
			}) : [];
			const preservedSlotOwnerElementIdSet = new Set(bfcacheCompatiblePreserveElementIds);
			const preservePreviousSlotIds = action.reuseCurrentBfcacheIds ? commit.decision.preservePreviousSlotIds.filter((slotId) => {
				const targetBinding = action.slotBindings.find((binding) => binding.slotId === slotId);
				return targetBinding?.ownerLayoutId !== null && targetBinding?.ownerLayoutId !== void 0 && preservedSlotOwnerElementIdSet.has(targetBinding.ownerLayoutId);
			}) : [];
			const hmrPreservedSlotOwnerLayoutIds = action.operation.lane === "hmr" ? bfcacheCompatiblePreserveElementIds.filter((id) => preservePreviousSlotIds.some((slotId) => {
				return action.slotBindings.find((binding) => binding.slotId === slotId)?.ownerLayoutId === id;
			})) : [];
			const hmrPreserveElementIds = action.operation.lane === "hmr" && state.routeId === action.routeId && Object.hasOwn(state.elements, state.routeId) ? [state.routeId, ...hmrPreservedSlotOwnerLayoutIds] : hmrPreservedSlotOwnerLayoutIds;
			const hmrUniquePreserveElementIds = hmrPreserveElementIds.length > 1 ? [...new Set(hmrPreserveElementIds)] : hmrPreserveElementIds;
			const preserveElementIds = action.operation.lane === "hmr" ? hmrUniquePreserveElementIds : bfcacheCompatiblePreserveElementIds;
			const mergedElements = mergeElements(state.elements, action.elements, {
				clearAbsentSlots: action.type === "traverse" || !action.reuseCurrentBfcacheIds,
				preserveAbsentSlots: action.reuseCurrentBfcacheIds && commit.decision.preserveAbsentSlots,
				preserveElementIds,
				preservePreviousSlotIds
			});
			return commitVisibleRouterState(state, {
				bfcacheIds: preserveBfcacheIdsForMergedElements({
					elements: mergedElements,
					next: action.bfcacheIds,
					previous: action.reuseCurrentBfcacheIds ? state.bfcacheIds : {}
				}),
				elements: mergedElements,
				interception: action.interception,
				interceptionContext: action.interceptionContext,
				layoutFlags: mergeLayoutFlags(state.layoutFlags, action.layoutFlags, preserveElementIds),
				layoutIds: action.layoutIds,
				navigationSnapshot: action.navigationSnapshot,
				previousNextUrl: action.previousNextUrl,
				renderId: action.renderId,
				rootLayoutTreePath: action.rootLayoutTreePath,
				routeId: action.routeId,
				slotBindings: mergeSlotBindings(state.slotBindings, action.slotBindings, action.layoutIds, preservePreviousSlotIds)
			}, action.operation);
		}
		default: {
			const _exhaustive = action.type;
			throw new Error("[vinext] Unknown router action: " + String(_exhaustive));
		}
	}
}
function resolvePendingNavigationCommitDecision(options) {
	const decision = resolvePendingNavigationCommitDispositionDecision(options);
	switch (decision.disposition) {
		case "skip": return {
			disposition: "no-commit",
			trace: decision.trace
		};
		case "hard-navigate": return {
			disposition: "hard-navigate",
			trace: decision.trace
		};
		case "dispatch": return createVisibleCommitDecision(decision.trace, decision.preserveElementIds, decision.preserveAbsentSlots, decision.preservePreviousSlotIds);
		default: throw new Error("[vinext] Unknown navigation commit disposition: " + String(decision));
	}
}
function createVisibleCommitDecision(trace = createNavigationTrace(NavigationTraceReasonCodes.commitCurrent), preserveElementIds = [], preserveAbsentSlots = false, preservePreviousSlotIds = []) {
	return {
		disposition: "commit",
		preserveAbsentSlots,
		preserveElementIds: [...preserveElementIds],
		preservePreviousSlotIds: [...preservePreviousSlotIds],
		trace
	};
}
function mergeLayoutFlags(previousFlags, nextFlags, preserveElementIds) {
	const merged = { ...nextFlags };
	for (const id of preserveElementIds) {
		if (Object.hasOwn(merged, id)) continue;
		const value = previousFlags[id];
		if (value) merged[id] = value;
	}
	return merged;
}
function createApprovedVisibleCommit(options) {
	return {
		[approvedVisibleCommitBrand]: true,
		action: options.pending.action,
		decision: options.decision,
		interception: options.pending.interception,
		interceptionContext: options.pending.interceptionContext,
		previousNextUrl: options.pending.previousNextUrl,
		rootLayoutTreePath: options.pending.rootLayoutTreePath,
		routeId: options.pending.routeId
	};
}
function createCommitTransactionFields(pending) {
	return {
		operationLane: pending.action.operation.lane,
		pendingOperationId: pending.action.operation.id,
		startedVisibleCommitVersion: pending.action.operation.startedVisibleCommitVersion
	};
}
function prependCommitTransactionTrace(trace, code, pending) {
	return prependNavigationTraceEntry(trace, code, createCommitTransactionFields(pending));
}
function addCommitTransactionTrace(decision, pending) {
	switch (decision.disposition) {
		case "commit": return {
			...decision,
			trace: prependCommitTransactionTrace(decision.trace, NavigationTraceTransactionCodes.visibleCommit, pending)
		};
		case "hard-navigate": return {
			...decision,
			trace: prependCommitTransactionTrace(decision.trace, NavigationTraceTransactionCodes.hardNavigate, pending)
		};
		case "no-commit": return {
			...decision,
			trace: prependCommitTransactionTrace(decision.trace, NavigationTraceTransactionCodes.noCommit, pending)
		};
		default: throw new Error("[vinext] Unknown commit decision: " + String(decision));
	}
}
function approveHmrVisibleCommit(options) {
	const { currentState, pending } = options;
	if (pending.action.operation.lane !== "hmr") throw new Error("[vinext] HMR visible commit approval requires an HMR pending operation");
	const tracedDecision = addCommitTransactionTrace(resolvePendingNavigationCommitDecision({
		activeNavigationId: pending.action.operation.id,
		currentState,
		pending,
		routeManifest: options.routeManifest,
		startedNavigationId: pending.action.operation.id,
		targetHref: options.targetHref
	}), pending);
	if (tracedDecision.disposition === "commit") return {
		approvedCommit: createApprovedVisibleCommit({
			decision: tracedDecision,
			pending
		}),
		decision: tracedDecision
	};
	return {
		approvedCommit: null,
		decision: tracedDecision
	};
}
function approvePendingNavigationCommit(options) {
	const decision = addCommitTransactionTrace(resolvePendingNavigationCommitDecision({
		activeNavigationId: options.activeNavigationId,
		currentState: options.currentState,
		pending: options.pending,
		routeManifest: options.routeManifest ?? null,
		startedNavigationId: options.startedNavigationId,
		targetHref: options.targetHref
	}), options.pending);
	switch (decision.disposition) {
		case "commit": return {
			approvedCommit: createApprovedVisibleCommit({
				decision,
				pending: options.pending
			}),
			decision
		};
		case "hard-navigate":
		case "no-commit": return {
			approvedCommit: null,
			decision
		};
		default: throw new Error("[vinext] Unknown commit decision: " + String(decision));
	}
}
async function resolveAndClassifyNavigationCommit(options) {
	const pending = await createPendingNavigationCommit({
		currentState: options.currentState,
		navigationCommitKind: void 0,
		navigationId: options.startedNavigationId,
		nextElements: options.nextElements,
		navigationSnapshot: options.navigationSnapshot,
		operationLane: options.operationLane,
		payloadOrigin: options.payloadOrigin,
		previousNextUrl: options.previousNextUrl,
		renderId: options.renderId,
		type: options.type
	});
	const approvalState = options.getCurrentStateForApproval?.() ?? options.currentState;
	const approval = approvePendingNavigationCommit({
		activeNavigationId: options.getActiveNavigationId?.() ?? options.activeNavigationId,
		currentState: approvalState,
		pending,
		routeManifest: options.routeManifest ?? null,
		startedNavigationId: options.startedNavigationId,
		targetHref: options.targetHref
	});
	return {
		approvedCommit: approval.approvedCommit,
		decision: approval.decision,
		pending,
		trace: approval.decision.trace
	};
}
//#endregion
export { applyApprovedVisibleCommit, approveHmrVisibleCommit, approvePendingNavigationCommit, resolveAndClassifyNavigationCommit };
