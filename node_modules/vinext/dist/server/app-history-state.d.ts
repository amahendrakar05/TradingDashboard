import { TraverseDirection } from "./navigation-planner.js";

//#region src/server/app-history-state.d.ts
type HistoryStateRecord = {
  [key: string]: unknown;
};
type BfcacheIdMap = Readonly<Record<string, string>>;
type HistoryTraversalIntent = {
  direction: TraverseDirection;
  historyState: unknown;
  targetHistoryIndex: number | null;
};
type HistoryStateSnapshotRestoreDecision<TState> = {
  kind: "restore";
  state: TState;
  targetHistoryIndex: number;
} | {
  kind: "skip";
  reason: "guarded" | "missing-history-index" | "missing-snapshot" | "stale-bfcache-version";
  targetHistoryIndex: number | null;
};
declare class HistoryStateSnapshotCache<TState> {
  #private;
  constructor(options: {
    maxEntries: number;
  });
  clear(): void;
  remember(options: {
    bfcacheVersion: number;
    historyIndex: number | null;
    state: TState;
  }): void;
  resolveRestore(options: {
    currentBfcacheVersion: number;
    guarded: boolean;
    historyState: unknown;
  }): HistoryStateSnapshotRestoreDecision<TState>;
}
declare class RestorableClientStateController<TState> {
  #private;
  constructor(options: {
    initialHistoryState: unknown;
    maxHistoryStateSnapshots: number;
  });
  get currentBfcacheVersion(): number;
  beginCacheInvalidationGuard(): () => void;
  isCacheInvalidationGuarded(): boolean;
  isCurrentBfcacheVersion(historyState: unknown): boolean;
  readCurrentBfcacheVersionHistoryIds(historyState: unknown): BfcacheIdMap | null;
  invalidateClientState(): void;
  rememberHistoryStateSnapshot(options: {
    historyIndex: number | null;
    state: TState;
  }): void;
  resolveHistoryStateSnapshotRestore(historyState: unknown): HistoryStateSnapshotRestoreDecision<TState>;
}
declare function createHistoryStateWithPreviousNextUrl(state: unknown, previousNextUrl: string | null): HistoryStateRecord | null;
declare function createHistoryStateWithNavigationMetadata(state: unknown, metadata: {
  bfcacheIds?: BfcacheIdMap | null;
  bfcacheVersion?: number | null;
  previousNextUrl: string | null;
  traversalIndex?: number | null;
}): HistoryStateRecord | null;
declare function createExternalHistoryStatePreservingMetadata(callerState: unknown, currentHistoryState: unknown): unknown;
declare function readHistoryStatePreviousNextUrl(state: unknown): string | null;
declare function readHistoryStateBfcacheIds(state: unknown): BfcacheIdMap | null;
declare function readHistoryStateBfcacheVersion(state: unknown): number | null;
/**
 * Whether a history entry's stored bfcache version matches the document's
 * current version. A missing/invalid stored version (null) is NEVER current:
 * coercing it to 0 would let un-versioned entries (older builds / external
 * pushState) pass the gate on a fresh document whose current version is 0,
 * defeating the document-scoped stale-id rejection. App-written entries always
 * carry an explicit version, so the legitimate first-document path (0 === 0)
 * still matches.
 */
declare function isHistoryStateBfcacheVersionCurrent(state: unknown, currentVersion: number): boolean;
declare function createHashOnlyHistoryStatePreservingNavigationMetadata(state: unknown): unknown;
declare function readHistoryStateTraversalIndex(state: unknown): number | null;
declare function resolveHistoryTraversalIntent(options: {
  currentHistoryIndex: number | null;
  historyState: unknown;
}): HistoryTraversalIntent;
//#endregion
export { BfcacheIdMap, HistoryStateSnapshotCache, HistoryTraversalIntent, RestorableClientStateController, createExternalHistoryStatePreservingMetadata, createHashOnlyHistoryStatePreservingNavigationMetadata, createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, isHistoryStateBfcacheVersionCurrent, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent };