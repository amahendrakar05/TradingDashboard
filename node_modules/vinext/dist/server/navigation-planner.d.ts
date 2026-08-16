import { RouteManifest } from "../routing/app-route-graph.js";
import { CacheEntryReuseDecision, CacheEntryReuseProof } from "./cache-proof.js";
import { AppElementsSlotBinding } from "./app-elements-wire.js";
import { NavigationTrace, NavigationTraceFields } from "./navigation-trace.js";
import { OperationLane, OperationToken } from "./operation-token.js";

//#region src/server/navigation-planner.d.ts
type RouteSnapshot = {
  interception: InterceptionSnapshot | null;
  interceptionContext: string | null;
  routeId: string;
  layoutIds: readonly string[];
  mountedParallelSlots: readonly MountedParallelSlotSnapshot[];
  rootBoundaryId: string | null;
  displayUrl: string;
  matchedUrl: string;
  slotBindings: readonly ParallelSlotBindingSnapshot[];
};
type InterceptionSnapshot = {
  sourceMatchedUrl: string;
  sourceRouteId: string;
  slotId: string;
  targetMatchedUrl: string;
  targetRouteId: string;
};
type MountedParallelSlotSnapshot = {
  slotId: string;
  ownerLayoutId: string | null;
};
type ParallelSlotBindingSnapshot = AppElementsSlotBinding;
type NavigationPlannerState = {
  nextOperationToken: OperationToken;
  traceFields?: NavigationTraceFields;
  visibleCommitVersion: number;
  visibleSnapshot: RouteSnapshot;
};
type RefreshScope = "visible";
type TraverseDirection = "back" | "forward" | "unknown";
type NavigationEvent = {
  kind: "navigate";
  href: string;
  mode: "push" | "replace";
} | {
  kind: "refresh";
  scope: RefreshScope;
} | {
  kind: "traverse";
  direction: TraverseDirection;
  historyState: unknown;
} | {
  kind: "prefetch";
  href: string;
} | {
  kind: "flightResponseArrived";
  token: OperationToken;
  result: FlightResult;
};
type RequestedWork = {
  kind: "flight";
  href: string;
  mode: "push" | "replace" | "refresh";
} | {
  direction: TraverseDirection;
  historyState: unknown;
  kind: "traverseFlight";
} | {
  kind: "prefetch";
  href: string;
};
type CommitProposal = {
  cacheEntryReuseDecision?: AcceptedCacheEntryReuseDecision;
  preserveAbsentSlots: boolean;
  preserveElementIds: readonly string[];
  preservePreviousSlotIds: readonly string[];
  reason: "currentRootBoundary" | "interceptedCurrentRootBoundary" | "unprovenTopologyFallback";
  targetSnapshot: RouteSnapshot;
};
type NoCommitReason = "prefetchOnly";
type HardNavigationReason = "cacheProofRejected" | "cacheReuseTokenRejected" | "interceptionProofRejected" | "rootBoundaryChanged";
type RootBoundaryTransition = "currentRootBoundary" | "rootBoundaryChanged" | "rootBoundaryUnknown";
type NavigationDecision = {
  kind: "requestWork";
  token: OperationToken;
  work: RequestedWork;
  trace: NavigationTrace;
} | {
  kind: "proposeCommit";
  token: OperationToken;
  proposal: CommitProposal;
  trace: NavigationTrace;
} | {
  kind: "noCommit";
  token: OperationToken;
  reason: NoCommitReason;
  trace: NavigationTrace;
} | {
  kind: "hardNavigate";
  token: OperationToken;
  url: string;
  reason: HardNavigationReason;
  trace: NavigationTrace;
};
type FlightResult = {
  cacheEntryReuseProof?: CacheEntryReuseProof;
  href: string;
  restoredHistorySnapshot?: boolean;
  targetSnapshot: RouteSnapshot;
};
type RscFetchResultSource = "cached" | "live";
type RscFetchResultFacts = {
  source: RscFetchResultSource;
  currentHref: string;
  origin: string;
  effectiveHistoryUpdateMode: "push" | "replace";
  redirectDepth: number;
  requestPreviousNextUrl: string | null;
  clientCompatibilityId: string | null;
  responseOk: boolean;
  isRscContentType: boolean;
  hasBody: boolean;
  compatibilityIdHeader: string | null;
  responseUrl: string | null;
  streamedRedirectTarget: string | null;
  streamedRedirectType?: "push" | "replace" | null;
};
type RscRedirectFollow = {
  href: string;
  historyUpdateMode: "push" | "replace";
  previousNextUrl: string | null;
  redirectDepth: number;
};
type RscFetchResultHardNavReason = "invalidRscPayload" | "rscCompatibilityMismatch" | "externalRedirectTarget" | "redirectDepthExhausted" | "streamedRedirectLoop";
type RscFetchResultDecision = {
  kind: "proceedToCommit";
  discardBody: false;
  trace: NavigationTrace;
} | {
  kind: "followRedirect";
  discardBody: boolean;
  redirect: RscRedirectFollow;
  trace: NavigationTrace;
} | {
  kind: "hardNavigate";
  discardBody: boolean;
  url: string;
  hardNavigationMode?: "assign" | "replace";
  reason: RscFetchResultHardNavReason;
  trace: NavigationTrace;
};
type EarlyNavigationIntentFacts = {
  basePath: string;
  currentHref: string;
  mode: "push" | "replace";
  scroll: boolean;
  targetHref: string;
};
type EarlyNavigationIntentDecision = {
  kind: "sameDocumentScroll";
  hash: string;
  mode: "push" | "replace";
  scroll: boolean;
  trace: NavigationTrace;
} | {
  kind: "flightNavigation";
  bypassNavigationCache: boolean;
  trace: NavigationTrace;
};
type NavigationReuseNavigationKind = "navigate" | "refresh" | "traverse";
type VisitedResponseCacheCandidateFacts = {
  candidate: "missing";
  navigationKind: NavigationReuseNavigationKind;
} | {
  candidate: "present";
  fresh: boolean;
  mountedSlotsMatch: boolean;
  navigationKind: NavigationReuseNavigationKind;
};
type VisitedResponseCacheCandidateDecision = {
  kind: "miss";
} | {
  kind: "evict";
  reason: "mountedSlotsMismatch" | "refresh" | "stale";
} | {
  kind: "reuse";
};
type NavigationReuseCandidateAvailability = {
  status: "available";
} | {
  status: "unavailable";
};
type OptimisticRouteShellCandidateAvailability = {
  status: "available";
} | {
  status: "unavailable";
  reason: "routeManifestMissing";
};
type NavigationReuseFacts = {
  bypassNavigationCache: boolean;
  navigationKind: NavigationReuseNavigationKind;
  optimisticRouteShell: OptimisticRouteShellCandidateAvailability;
  prefetch: NavigationReuseCandidateAvailability;
  targetHref: string;
  visitedResponse: NavigationReuseCandidateAvailability;
};
type FreshFetchReason = "cacheBypassed" | "cacheMiss" | "refresh" | "routeManifestMissing";
type NavigationReuseDecision = {
  kind: "reuseVisitedResponse";
  trace: NavigationTrace;
} | {
  kind: "consumePrefetch";
  trace: NavigationTrace;
} | {
  kind: "attemptOptimisticRouteShell";
  trace: NavigationTrace;
} | {
  kind: "fetchFresh";
  reason: FreshFetchReason;
  trace: NavigationTrace;
};
type NavigationPrefetchProbeFacts = {
  bypassNavigationCache: boolean;
  navigationKind: NavigationReuseNavigationKind;
  visitedResponse: NavigationReuseCandidateAvailability;
};
type NavigationPrefetchProbeDecision = {
  kind: "probe";
} | {
  kind: "skip";
  reason: "cacheBypassed" | "refresh" | "visitedResponseAvailable";
};
type NavigationPlannerInput = {
  routeManifest: RouteManifest | null;
  state: NavigationPlannerState;
  event: NavigationEvent;
};
type AcceptedCacheEntryReuseDecision = Extract<CacheEntryReuseDecision, {
  canReuse: true;
}>;
declare function classifyRscFetchResult(facts: RscFetchResultFacts): RscFetchResultDecision;
declare function classifyEarlyNavigationIntent(facts: EarlyNavigationIntentFacts): EarlyNavigationIntentDecision;
declare function classifyVisitedResponseCacheCandidate(facts: VisitedResponseCacheCandidateFacts): VisitedResponseCacheCandidateDecision;
declare function classifyNavigationReuse(facts: NavigationReuseFacts): NavigationReuseDecision;
declare function classifyNavigationPrefetchProbe(facts: NavigationPrefetchProbeFacts): NavigationPrefetchProbeDecision;
declare function classifyRootBoundaryTransition(currentRootBoundaryId: string | null, nextRootBoundaryId: string | null): RootBoundaryTransition;
declare function resolveSameLayoutAncestorPersistence(currentSnapshot: RouteSnapshot, targetSnapshot: RouteSnapshot): readonly string[];
declare function resolveMountedParallelSlotPersistence(currentSnapshot: RouteSnapshot, targetSnapshot: RouteSnapshot): readonly string[];
declare function resolveCurrentRootBoundaryElementPersistence(currentSnapshot: RouteSnapshot, targetSnapshot: RouteSnapshot): readonly string[];
/**
 * Default/unmatched slot preservation law:
 *
 * A target default/unmatched slot may reuse previous content only when:
 * - the slot's owner layout is part of the preserved layout ancestor set;
 * - the current visible snapshot proves the same slot had renderable content;
 * - the navigation is not a traversal.
 *
 * Wire absence and UNMATCHED_SLOT markers are not semantic proof.
 */
declare function resolveDefaultOrUnmatchedSlotPersistenceForLayouts(options: {
  currentSlotBindings: readonly ParallelSlotBindingSnapshot[];
  preservedLayoutIds: readonly string[];
  targetSlotBindings: readonly ParallelSlotBindingSnapshot[];
}): readonly string[];
declare function planNavigation(input: NavigationPlannerInput): NavigationDecision;
type ServerActionResultFacts = {
  actionRedirectHref: string | null;
  actionRedirectType: "push" | "replace";
  clientCompatibilityId: string | null;
  compatibilityIdHeader: string | null;
  currentHref: string;
  isRscContentType: boolean;
  origin: string;
  responseUrl: string | null;
};
type ServerActionResultDecision = {
  kind: "proceed";
  trace: NavigationTrace;
} | {
  kind: "hardNavigate";
  url: string;
  historyMode?: "assign" | "replace";
  clearClientNavigationCaches: boolean;
  reason: "serverActionRedirectCompatibilityMismatch" | "serverActionRscCompatibilityMismatch";
  trace: NavigationTrace;
};
type RscNavigationErrorFacts = {
  currentHref: string;
};
type RscNavigationErrorDecision = {
  kind: "hardNavigate";
  url: string;
  reason: "rscNavigationError";
  trace: NavigationTrace;
};
declare function classifyServerActionResult(facts: ServerActionResultFacts): ServerActionResultDecision;
declare function classifyRscNavigationError(facts: RscNavigationErrorFacts): RscNavigationErrorDecision;
declare const navigationPlanner: {
  classifyEarlyNavigationIntent: typeof classifyEarlyNavigationIntent;
  classifyNavigationPrefetchProbe: typeof classifyNavigationPrefetchProbe;
  classifyNavigationReuse: typeof classifyNavigationReuse;
  classifyRscFetchResult: typeof classifyRscFetchResult;
  classifyRscNavigationError: typeof classifyRscNavigationError;
  classifyRootBoundaryTransition: typeof classifyRootBoundaryTransition;
  classifyServerActionResult: typeof classifyServerActionResult;
  classifyVisitedResponseCacheCandidate: typeof classifyVisitedResponseCacheCandidate;
  plan: typeof planNavigation;
  resolveCurrentRootBoundaryElementPersistence: typeof resolveCurrentRootBoundaryElementPersistence;
  resolveMountedParallelSlotPersistence: typeof resolveMountedParallelSlotPersistence;
  resolveSameLayoutAncestorPersistence: typeof resolveSameLayoutAncestorPersistence;
};
//#endregion
export { EarlyNavigationIntentDecision, EarlyNavigationIntentFacts, FlightResult, InterceptionSnapshot, MountedParallelSlotSnapshot, NavigationDecision, NavigationEvent, NavigationPlannerInput, NavigationPlannerState, NavigationReuseDecision, NavigationReuseFacts, type OperationLane, type OperationToken, ParallelSlotBindingSnapshot, RefreshScope, RootBoundaryTransition, RouteSnapshot, RscFetchResultDecision, RscFetchResultFacts, RscNavigationErrorDecision, RscNavigationErrorFacts, ServerActionResultDecision, ServerActionResultFacts, TraverseDirection, VisitedResponseCacheCandidateFacts, navigationPlanner, resolveDefaultOrUnmatchedSlotPersistenceForLayouts };