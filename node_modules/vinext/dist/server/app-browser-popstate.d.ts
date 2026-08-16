import { NavigationRuntimeNavigate } from "../client/navigation-runtime.js";

//#region src/server/app-browser-popstate.d.ts
type RestoreScrollPosition = (state: unknown, options?: {
  shouldContinue?: () => boolean;
}) => void;
type BrowserPopstateRestoreDeps = {
  getActiveNavigationId: () => number;
  getPendingNavigation: () => Promise<void> | null | undefined;
  getNavigate: () => NavigationRuntimeNavigate | undefined;
  isCurrentNavigation: (navId: number) => boolean;
  notifyAppRouterTransitionStart: (href: string) => void;
  restorePopstateScrollPosition: RestoreScrollPosition;
  setPendingNavigation: (pendingNavigation: Promise<void> | null) => void;
  shouldSkipScrollRestore: (navId: number) => boolean;
};
type SynchronousPopstateScrollRestoreDeps = {
  getActiveNavigationId: () => number;
  isCurrentNavigation: (navId: number) => boolean;
  markScrollRestoreConsumed: (navId: number) => void;
  restorePopstateScrollPosition: RestoreScrollPosition;
};
declare function restoreSynchronousPopstateScrollPosition(deps: SynchronousPopstateScrollRestoreDeps, state: unknown): void;
declare function createPopstateRestoreHandler(deps: BrowserPopstateRestoreDeps): (event: PopStateEvent) => void;
//#endregion
export { createPopstateRestoreHandler, restoreSynchronousPopstateScrollPosition };