import { RouteManifest } from "../routing/app-route-graph.js";
import { CacheEntryReuseProof } from "./cache-proof.js";
import { AppElements, AppElementsInterception, AppElementsSlotBinding, LayoutFlags } from "./app-elements-wire.js";
import { NavigationTrace } from "./navigation-trace.js";
import { OperationLane } from "./operation-token.js";
import { BfcacheIdMap, HistoryTraversalIntent, createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, isHistoryStateBfcacheVersionCurrent, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent } from "./app-history-state.js";
import { createBfcacheSegmentStateKeyMap, createInitialBfcacheIdMap, createNextBfcacheIdMap, preserveBfcacheIdsForMergedElements } from "./app-bfcache-identity.js";
import { ClientNavigationRenderSnapshot } from "../shims/navigation.js";

//#region src/server/app-browser-state.d.ts
type OperationRecordBase = {
  id: number;
  lane: OperationLane;
  navigationCommitKind?: "authoritative" | "detached";
  navigationId?: number;
  startedVisibleCommitVersion: number;
};
type PendingOperationRecord = OperationRecordBase & {
  state: "pending";
};
type CommittedOperationRecord = OperationRecordBase & {
  state: "committed";
  visibleCommitVersion: number;
};
type OperationRecord = PendingOperationRecord | CommittedOperationRecord;
type AppRouterState = {
  activeOperation: OperationRecord | null;
  bfcacheIds: BfcacheIdMap;
  elements: AppElements;
  interception: AppElementsInterception | null;
  interceptionContext: string | null;
  layoutFlags: LayoutFlags;
  layoutIds: readonly string[];
  previousNextUrl: string | null;
  renderId: number;
  navigationSnapshot: ClientNavigationRenderSnapshot;
  rootLayoutTreePath: string | null;
  routeId: string;
  slotBindings: readonly AppElementsSlotBinding[];
  visibleCommitVersion: number;
};
type AppRouterAction = {
  bfcacheIds: BfcacheIdMap;
  cacheEntryReuseProof?: CacheEntryReuseProof;
  elements: AppElements;
  interception: AppElementsInterception | null;
  interceptionContext: string | null;
  layoutFlags: LayoutFlags;
  layoutIds: readonly string[];
  navigationSnapshot: ClientNavigationRenderSnapshot;
  operation: PendingOperationRecord;
  previousNextUrl: string | null;
  renderId: number;
  rootLayoutTreePath: string | null;
  reuseCurrentBfcacheIds: boolean;
  routeId: string;
  skippedLayoutIds: readonly string[];
  slotBindings: readonly AppElementsSlotBinding[];
  type: "navigate" | "replace" | "traverse";
};
type PendingNavigationCommit = {
  action: AppRouterAction;
  cacheEntryReuseProof?: CacheEntryReuseProof;
  interception: AppElementsInterception | null;
  interceptionContext: string | null;
  previousNextUrl: string | null;
  rootLayoutTreePath: string | null;
  routeId: string;
  restoredHistorySnapshot?: boolean;
  skippedLayoutIds: readonly string[];
};
type AppNavigationPayloadOrigin = Readonly<{
  origin: "committed-cache";
} | {
  origin: "fresh";
} | {
  origin: "visited-cache";
}>;
declare const COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN: AppNavigationPayloadOrigin;
declare const FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN: AppNavigationPayloadOrigin;
declare const VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN: AppNavigationPayloadOrigin;
type PendingNavigationCommitDisposition = "dispatch" | "hard-navigate" | "skip";
type CacheRestorableAppPayloadMetadata = Readonly<{
  cacheEntryReuseProof?: CacheEntryReuseProof;
  dynamicStaleTimeSeconds?: number;
  skippedLayoutIds: readonly string[];
}>;
type DispatchPendingNavigationCommitDispositionDecision = {
  disposition: "dispatch";
  preserveAbsentSlots: boolean;
  preserveElementIds: readonly string[];
  preservePreviousSlotIds: readonly string[];
  trace: NavigationTrace;
};
type NonDispatchPendingNavigationCommitDispositionDecision = {
  disposition: Exclude<PendingNavigationCommitDisposition, "dispatch">;
  preserveElementIds: readonly [];
  trace: NavigationTrace;
};
type PendingNavigationCommitDispositionDecision = DispatchPendingNavigationCommitDispositionDecision | NonDispatchPendingNavigationCommitDispositionDecision;
declare function isCompleteAppPayloadMetadata(metadata: CacheRestorableAppPayloadMetadata): boolean;
declare function isCacheRestorableAppPayloadMetadata(metadata: CacheRestorableAppPayloadMetadata): metadata is CacheRestorableAppPayloadMetadata & {
  cacheEntryReuseProof: CacheEntryReuseProof;
};
declare function resolveInterceptionContextFromPreviousNextUrl(previousNextUrl: string | null, basePath?: string): string | null;
type ResolveServerActionRequestStateOptions = {
  actionId: string;
  basePath: string;
  elements: AppElements;
  interceptionContext?: string | null;
  previousNextUrl: string | null;
};
type ResolveServerActionRequestStateResult = {
  headers: Headers;
};
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
declare function resolveServerActionRequestState(options: ResolveServerActionRequestStateOptions): ResolveServerActionRequestStateResult;
declare function resolvePendingNavigationCommitDispositionDecision(options: {
  activeNavigationId: number;
  currentState: AppRouterState;
  pending: PendingNavigationCommit;
  routeManifest?: RouteManifest | null;
  startedNavigationId: number;
  targetHref?: string;
}): PendingNavigationCommitDispositionDecision;
declare function createPendingNavigationCommit(options: {
  currentState: AppRouterState;
  navigationCommitKind?: "authoritative" | "detached";
  navigationId?: number;
  nextElements: Promise<AppElements>;
  navigationSnapshot: ClientNavigationRenderSnapshot;
  operationLane: OperationLane;
  payloadOrigin: AppNavigationPayloadOrigin;
  previousNextUrl?: string | null;
  renderId: number;
  restoredBfcacheIds?: BfcacheIdMap | null;
  reuseCurrentBfcacheIds?: boolean;
  type: "navigate" | "replace" | "traverse";
}): Promise<PendingNavigationCommit>;
//#endregion
export { AppNavigationPayloadOrigin, AppRouterAction, AppRouterState, type BfcacheIdMap, COMMITTED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, CommittedOperationRecord, FRESH_APP_NAVIGATION_PAYLOAD_ORIGIN, type HistoryTraversalIntent, type OperationLane, PendingNavigationCommit, PendingOperationRecord, VISITED_CACHE_APP_NAVIGATION_PAYLOAD_ORIGIN, createBfcacheSegmentStateKeyMap, createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, createInitialBfcacheIdMap, createNextBfcacheIdMap, createPendingNavigationCommit, isCacheRestorableAppPayloadMetadata, isCompleteAppPayloadMetadata, isHistoryStateBfcacheVersionCurrent, preserveBfcacheIdsForMergedElements, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent, resolveInterceptionContextFromPreviousNextUrl, resolvePendingNavigationCommitDispositionDecision, resolveServerActionRequestState };