import { BfcacheIdMap, HistoryTraversalIntent } from "./app-history-state.js";
import { AppRouterState } from "./app-browser-state.js";
import { HistoryUpdateMode } from "./app-browser-navigation-controller.js";

//#region src/server/app-browser-history-controller.d.ts
/**
 * Visible router-state metadata at the instant a hash-only navigation commits.
 * `null` means the browser router tree has not committed yet, so the controller
 * falls back to reading the same facts off the live history entry.
 */
type VisibleNavigationMetadata = {
  bfcacheIds: BfcacheIdMap | null;
  previousNextUrl: string | null;
};
type AppBrowserHistoryControllerDeps = {
  initialHistoryState: unknown;
  maxHistoryStateSnapshots: number; /** Reads `window.history.state`. Injected so the controller stays unit-testable. */
  readHistoryState: () => unknown; /** Reads `window.location.href`. Injected so the controller stays unit-testable. */
  readCurrentHref: () => string; /** Wraps `pushHistoryStateWithoutNotify(state, "", href)`. */
  pushHistoryState: (state: unknown, href: string) => void; /** Wraps `replaceHistoryStateWithoutNotify(state, "", href)`. */
  replaceHistoryState: (state: unknown, href?: string) => void;
  readVisibleNavigationMetadata: () => VisibleNavigationMetadata | null;
};
/**
 * Candidate visible state resolved from a restorable history snapshot, handed to
 * the entry's approved-visible-restore callback. The controller resolves the
 * candidate and owns the traversal-index commit; the entry owns the actual
 * `AppBrowserNavigationController.restoreHistorySnapshotVisibleState()` call and
 * the `ApprovedVisibleCommit` boundary.
 */
type RestorableSnapshotCandidate = {
  state: AppRouterState;
  beforeCommit: () => void;
};
type RestoreHistorySnapshotOptions = {
  historyState: unknown;
  stageClientParams: (params: Record<string, string | string[]>) => void;
  approveVisibleRestore: (candidate: RestorableSnapshotCandidate) => boolean;
};
type CommitNavigationHistoryOptions = {
  bfcacheIds: BfcacheIdMap;
  href: string;
  historyUpdateMode: HistoryUpdateMode | undefined;
  previousNextUrl: string | null;
  targetHistoryIndex?: number | null;
  stageClientParams: () => void;
};
declare function createCanonicalBrowserHistoryHref(href: string): string;
/**
 * Owns App Router browser-history metadata and traversal bookkeeping behind a
 * typed seam: traversal index allocation/commit, push/replace/traverse/hash-only
 * history-state writes, BFCache epoch/snapshot invalidation through
 * `RestorableClientStateController`, and restorable-snapshot candidate
 * resolution.
 *
 * Ownership boundary: this is not a second router or visible-state authority. It
 * resolves history facts and delegates visible restoration through an injected
 * approved-commit callback. It never sets router state directly, never imports
 * `applyApprovedVisibleCommit()`, and never bypasses the `ApprovedVisibleCommit`
 * boundary owned by `AppBrowserNavigationController`.
 */
declare class AppBrowserHistoryController {
  #private;
  constructor(deps: AppBrowserHistoryControllerDeps);
  get currentHistoryTraversalIndex(): number | null;
  allocateNavigationHistoryTraversalIndex(historyUpdateMode: HistoryUpdateMode | undefined): number | null;
  commitHistoryTraversalIndex(index: number | null): void;
  commitTraversalIndexFromHistoryState(historyState: unknown): void;
  resolveTraversalIntent(historyState: unknown): HistoryTraversalIntent;
  readCurrentBfcacheVersionHistoryIds(historyState: unknown): BfcacheIdMap | null;
  isCacheInvalidationGuarded(): boolean;
  isCurrentBfcacheVersion(historyState: unknown): boolean;
  beginCacheInvalidationGuard(): () => void;
  invalidateRestorableClientState(): void;
  rememberHistoryStateSnapshot(state: AppRouterState): void;
  commitHashOnlyNavigation(href: string, historyUpdateMode: HistoryUpdateMode, scroll: boolean): void;
  /**
   * Writes the history entry for an approved push/replace/traverse commit and
   * advances the traversal index. `stageClientParams` runs at the exact point it
   * ran inline in the browser-entry commit effect so client-param staging stays
   * ordered relative to the history write. Mirrors Next.js committing tree state
   * into the history entry during the navigation commit.
   */
  commitNavigationHistory(options: CommitNavigationHistoryOptions): void;
  syncCurrentHistoryStatePreviousNextUrl(previousNextUrl: string | null, bfcacheIds?: BfcacheIdMap | null): void;
  /** Initial history write performed before hydration starts. */
  writeBootstrapHistoryMetadata(): void;
  /** History write performed on the first committed (hydrated) render. */
  writeHydratedHistoryMetadata(options: {
    bfcacheIds: BfcacheIdMap;
    previousNextUrl: string | null;
  }): void;
  /**
   * Resolves a restorable snapshot candidate for the given history entry and
   * commits the traversal index after, and only after, the injected
   * approved-visible-restore callback succeeds. The traversal-index commit and
   * client-param staging run inside `beforeCommit`, which the
   * `AppBrowserNavigationController` invokes only once the `ApprovedVisibleCommit`
   * is approved. Returns false when no snapshot is restorable or the restore is
   * not approved.
   */
  restoreHistorySnapshot(options: RestoreHistorySnapshotOptions): boolean;
}
//#endregion
export { AppBrowserHistoryController, RestorableSnapshotCandidate, createCanonicalBrowserHistoryHref };