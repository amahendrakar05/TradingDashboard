import { RouteManifest } from "../routing/app-route-graph.js";
import { AppRouterScrollIntent } from "../shims/app-router-scroll-state.js";
import { NavigationRuntimeVisibleCommitMode } from "../client/navigation-runtime.js";
import { AppElements } from "./app-elements-wire.js";
import { OperationLane } from "./operation-token.js";
import { ServerActionRevalidationKind } from "./app-browser-action-result.js";
import { ClientNavigationRenderSnapshot, commitClientNavigationState, createSnapshotPathAndSearch } from "../shims/navigation.js";
import { AppNavigationPayloadOrigin, AppRouterState } from "./app-browser-state.js";
import { Dispatch, ReactNode } from "react";

//#region src/server/app-browser-navigation-controller.d.ts
type HistoryUpdateMode = "push" | "replace";
type PendingBrowserRouterState = {
  promise: Promise<AppRouterState>;
  resolve: (state: AppRouterState) => void;
  settled: boolean;
};
type NavigationPayloadOutcome = "committed" | "no-commit" | "hard-navigate";
type HardNavigationMode = "assign" | "replace";
type BrowserNavigationCommitEffect = () => void;
type BrowserNavigationCommitEffectFactory = (options: {
  bfcacheIds: Readonly<Record<string, string>>;
  href: string;
  historyUpdateMode: HistoryUpdateMode | undefined;
  navId: number;
  params: Record<string, string | string[]>;
  previousNextUrl: string | null;
  targetHistoryIndex?: number | null;
}) => BrowserNavigationCommitEffect;
type BrowserRouterStateRef = {
  current: AppRouterState;
};
type SameUrlServerActionLifecycleOptions = {
  onDiscardedRevalidation?: () => void;
  revalidation?: ServerActionRevalidationKind;
  startedNavigationId?: number;
  targetHref?: string;
};
type BrowserNavigationControllerDeps = {
  basePath?: string;
  commitClientNavigationState?: typeof commitClientNavigationState;
  performHardNavigation?: (href: string, mode?: HardNavigationMode) => boolean;
  getRouteManifest?: () => RouteManifest | null;
  syncHistoryStatePreviousNextUrl?: (previousNextUrl: string | null, bfcacheIds?: Readonly<Record<string, string>> | null) => void;
};
type BrowserNavigationController = {
  beginNavigation(): number;
  getActiveNavigationId(): number;
  hasBrowserRouterState(): boolean;
  getBrowserRouterState(): AppRouterState;
  isCurrentNavigation(navId: number): boolean;
  performHardNavigation(href: string, mode?: HardNavigationMode): boolean;
  waitForBrowserRouterStateReady(): Promise<void>;
  attachBrowserRouterState(setter: Dispatch<AppRouterState | Promise<AppRouterState>>, stateRef: BrowserRouterStateRef): () => void;
  beginPendingBrowserRouterState(): PendingBrowserRouterState;
  finalizeNavigation(navId: number, pending: PendingBrowserRouterState | null | undefined): void;
  restoreHistorySnapshotVisibleState(options: {
    beforeCommit?: () => void;
    navId: number;
    state: AppRouterState;
    targetHref: string;
  }): boolean;
  renderNavigationPayload(options: {
    actionType: "navigate" | "replace" | "traverse";
    createNavigationCommitEffect: BrowserNavigationCommitEffectFactory;
    historyUpdateMode: HistoryUpdateMode | undefined;
    navigationSnapshot: ClientNavigationRenderSnapshot;
    nextElements: Promise<AppElements>;
    operationLane: OperationLane;
    payloadOrigin: AppNavigationPayloadOrigin;
    params: Record<string, string | string[]>;
    pendingRouterState: PendingBrowserRouterState | null;
    previousNextUrl: string | null;
    scrollIntent?: AppRouterScrollIntent | null;
    restoredBfcacheIds?: Readonly<Record<string, string>> | null;
    reuseCurrentBfcacheIds?: boolean;
    targetHistoryIndex?: number | null;
    targetHref: string;
    navId: number;
    navigationCommitKind?: "authoritative" | "detached";
    visibleCommitMode?: NavigationRuntimeVisibleCommitMode;
    onCommittedState?: (state: AppRouterState) => void;
  }): Promise<NavigationPayloadOutcome>;
  commitSameUrlNavigatePayload(nextElements: Promise<AppElements>, navigationSnapshot: ClientNavigationRenderSnapshot, returnValue?: {
    ok: boolean;
    data: unknown;
  }, actionInitiationState?: AppRouterState, lifecycleOptions?: SameUrlServerActionLifecycleOptions): Promise<unknown>;
  hmrReplaceTree(nextElements: Promise<AppElements>, navigationSnapshot: ClientNavigationRenderSnapshot): Promise<void>;
  /**
   * Force-drain the queued pre-paint effect for the given renderId without
   * waiting for NavigationCommitSignal to commit. Used by the dev recovery
   * boundary in app-browser-entry.ts: when a render error replaces
   * NavigationCommitSignal with the boundary's null fallback, its
   * useLayoutEffect never fires, so the URL update for the in-flight
   * navigation would otherwise be lost.
   */
  drainPrePaintEffects(renderId: number): void;
  clearCommittedNavigationFailureTargets(renderId: number): void;
  NavigationCommitSignal(this: void, {
    renderId,
    children
  }: {
    renderId: number;
    children?: ReactNode;
  }): ReactNode;
};
declare function clearHardNavigationLoopGuard(): void;
declare function createBasePathStrippedPathAndSearch(url: URL, basePath: string): string;
declare function createAppBrowserNavigationController(deps?: BrowserNavigationControllerDeps): BrowserNavigationController;
//#endregion
export { HistoryUpdateMode, NavigationPayloadOutcome, PendingBrowserRouterState, clearHardNavigationLoopGuard, createAppBrowserNavigationController, createBasePathStrippedPathAndSearch, createSnapshotPathAndSearch };