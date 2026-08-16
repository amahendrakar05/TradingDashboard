//#region src/server/navigation-trace.d.ts
declare const NAVIGATION_TRACE_SCHEMA_VERSION = 0;
type NavigationTraceSchemaVersion = 0;
declare const NavigationTraceReasonCodes: {
  cacheProofRejected: "NC_CACHE_REJECT";
  cacheReuseTokenRejected: "NC_CACHE_TOKEN_REJECT";
  commitCurrent: "NC_COMMIT";
  crossDocumentFlight: "NC_CROSS_DOC_FLIGHT";
  fetchFresh: "NC_FETCH_FRESH";
  invalidRscPayload: "NC_RSC_INVALID";
  interceptedCommitCurrent: "NC_INTERCEPT_COMMIT";
  interceptedRejectedIncompatibleRoot: "NC_INTERCEPT_REJECT_ROOT";
  interceptedRejectedMissingProof: "NC_INTERCEPT_REJECT_MISSING_PROOF";
  interceptedRejectedMissingSlotProof: "NC_INTERCEPT_REJECT_SLOT";
  interceptedRejectedTargetMismatch: "NC_INTERCEPT_REJECT_TARGET";
  interceptedRejectedUndeclaredTopology: "NC_INTERCEPT_REJECT_GRAPH";
  interceptedRejectedUnknownSource: "NC_INTERCEPT_REJECT_SOURCE";
  optimisticRouteShell: "NC_OPTIMISTIC_SHELL";
  prefetchOnly: "NC_PREFETCH_ONLY";
  prefetchResponseReuse: "NC_PREFETCH_REUSE";
  proceedToCommit: "NC_RSC_PROCEED";
  redirectFollow: "NC_RSC_REDIRECT_FOLLOW";
  redirectTerminalDepth: "NC_RSC_REDIRECT_DEPTH";
  redirectTerminalExternal: "NC_RSC_REDIRECT_EXTERNAL";
  requestWork: "NC_REQUEST";
  rootBoundaryChanged: "NC_ROOT";
  rootBoundaryUnknown: "NC_ROOT_UNKNOWN";
  rscCompatibilityMismatch: "NC_RSC_COMPAT_MISMATCH";
  rscNavigationError: "NC_RSC_NAV_ERROR";
  sameDocumentScroll: "NC_SAME_DOC_SCROLL";
  samePageSearch: "NC_SAME_PAGE_SEARCH";
  serverActionRedirectCompatibilityMismatch: "NC_SA_REDIRECT_COMPAT";
  serverActionRscCompatibilityMismatch: "NC_SA_RSC_COMPAT";
  staleOperation: "NC_STALE";
  streamedRedirectLoop: "NC_RSC_STREAMED_REDIRECT_LOOP";
  visitedResponseReuse: "NC_VISITED_REUSE";
};
declare const NavigationTraceTransactionCodes: {
  hardNavigate: "NT_HARD_NAVIGATE";
  noCommit: "NT_NO_COMMIT";
  visibleCommit: "NT_VISIBLE_COMMIT";
};
type NavigationTraceReasonCode = (typeof NavigationTraceReasonCodes)[keyof typeof NavigationTraceReasonCodes];
type NavigationTraceTransactionCode = (typeof NavigationTraceTransactionCodes)[keyof typeof NavigationTraceTransactionCodes];
type NavigationTraceCode = NavigationTraceReasonCode | NavigationTraceTransactionCode;
type NavigationTraceFieldName = "activeNavigationId" | "cacheProofCode" | "cacheProofMode" | "cacheProofReuseClass" | "cacheProofScope" | "cacheReuseTokenReason" | "currentRootLayoutTreePath" | "currentVisibleCommitVersion" | "nextRootLayoutTreePath" | "eventKind" | "fetchResultSource" | "freshFetchReason" | "operationLane" | "pendingOperationId" | "redirectDepth" | "redirectSignal" | "startedVisibleCommitVersion" | "startedNavigationId" | "targetHref" | "traverseDirection";
type NavigationTraceFieldValue = string | number | boolean | null;
type NavigationTraceFields = Readonly<Partial<Record<NavigationTraceFieldName, NavigationTraceFieldValue>>>;
type NavigationTraceEntry = Readonly<{
  code: NavigationTraceCode;
  fields: NavigationTraceFields;
}>;
type NavigationTrace = Readonly<{
  schemaVersion: NavigationTraceSchemaVersion;
  entries: readonly NavigationTraceEntry[];
}>;
declare function createNavigationLifecycleTraceFields(options: {
  activeNavigationId?: number;
  currentRootLayoutTreePath: string | null;
  currentVisibleCommitVersion: number;
  nextRootLayoutTreePath: string | null;
  startedNavigationId?: number;
  startedVisibleCommitVersion: number;
}): NavigationTraceFields;
declare function createNavigationTrace(code: NavigationTraceCode, fields?: NavigationTraceFields): NavigationTrace;
declare function prependNavigationTraceEntry(trace: NavigationTrace, code: NavigationTraceCode, fields?: NavigationTraceFields): NavigationTrace;
//#endregion
export { NAVIGATION_TRACE_SCHEMA_VERSION, NavigationTrace, NavigationTraceFields, NavigationTraceReasonCode, NavigationTraceReasonCodes, NavigationTraceTransactionCode, NavigationTraceTransactionCodes, createNavigationLifecycleTraceFields, createNavigationTrace, prependNavigationTraceEntry };