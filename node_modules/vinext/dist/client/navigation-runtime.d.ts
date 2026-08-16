import { RouteManifest } from "../routing/app-route-graph.js";
import { AppRouterScrollIntent } from "../shims/app-router-scroll-state.js";

//#region src/client/navigation-runtime.d.ts
type NavigationRuntimeSnapshot = {
  pathname: string;
  searchParams: [string, string][];
};
type NavigationRuntimeRscChunk = string | [3, string];
type NavigationRuntimeRscBootstrap = {
  done?: boolean;
  dynamicStaleTimeSeconds?: number;
  initialCacheKind?: "dynamic" | "static";
  nav?: NavigationRuntimeSnapshot;
  params?: Record<string, string | string[]>;
  rsc: NavigationRuntimeRscChunk[];
};
type NavigationRuntimeKind = "navigate" | "traverse" | "refresh";
type NavigationRuntimeHistoryUpdateMode = "push" | "replace";
type NavigationRuntimeVisibleCommitMode = "transition" | "synchronous";
type NavigationRuntimeTraversalIntent = {
  direction: "back" | "forward" | "unknown";
  historyState: unknown;
  targetHistoryIndex: number | null;
};
type NavigationRuntimeNavigate = (href: string, redirectDepth?: number, navigationKind?: NavigationRuntimeKind, historyUpdateMode?: NavigationRuntimeHistoryUpdateMode, previousNextUrlOverride?: string | null, programmaticTransition?: boolean, traversalIntent?: NavigationRuntimeTraversalIntent, scrollIntent?: AppRouterScrollIntent | null, visibleCommitMode?: NavigationRuntimeVisibleCommitMode) => Promise<void>;
type NavigationRuntimeFunctions = {
  clearNavigationCaches?: () => void;
  commitHashNavigation?: (href: string, historyUpdateMode: NavigationRuntimeHistoryUpdateMode, scroll: boolean) => void;
  navigateExternal?: (href: string, historyUpdateMode: NavigationRuntimeHistoryUpdateMode) => Promise<void>;
  navigate?: NavigationRuntimeNavigate;
  /**
   * Called at the start of every App Router navigation so the <Link> shim can
   * reset any link that is still showing a `useLinkStatus()` pending state but
   * is not the one driving this navigation (e.g. a programmatic router.push or
   * a shallow-routing transition). Registered by shims/link.tsx; decoupled
   * through the runtime to avoid a circular import with shims/navigation.ts.
   */
  notifyLinkNavigationStart?: () => void;
  pingVisibleLinks?: () => void;
};
type NavigationRuntimeBootstrap = {
  routeManifest: RouteManifest | null;
  rsc: NavigationRuntimeRscBootstrap | undefined;
};
type NavigationRuntime = {
  bootstrap: NavigationRuntimeBootstrap;
  functions: NavigationRuntimeFunctions;
};
declare const NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION = "vinext.navigationRuntime";
declare const NAVIGATION_RUNTIME_KEY: unique symbol;
declare function getNavigationRuntime(): NavigationRuntime | null;
declare function registerNavigationRuntimeBootstrap(bootstrap: Partial<NavigationRuntimeBootstrap>): NavigationRuntime;
declare function registerNavigationRuntimeFunctions(functions: Partial<NavigationRuntimeFunctions>): NavigationRuntime;
declare function ensureNavigationRuntimeRscBootstrap(): NavigationRuntimeRscBootstrap;
declare function subscribeNavigationRuntimeRscChunk(chunk: NavigationRuntimeRscChunk): NavigationRuntime;
declare function hasAppNavigationRuntime(): boolean;
/**
 * True when the App Router has installed its runtime bootstrap on `window`,
 * which the inline runtime-metadata script does synchronously in `<head>`.
 *
 * This is a stronger early-life signal than `hasAppNavigationRuntime()` — the
 * latter checks for the fully-wired `navigate` function and so returns false
 * during the brief window between HTML parse and the bootstrap module
 * finishing initialization. Code that needs to differentiate App Router from
 * Pages Router *during hydration* (e.g. the Script shim deciding whether the
 * server-side pre-head splice already emitted the inline beforeInteractive
 * tag) should call this instead.
 */
declare function hasAppNavigationRuntimeBootstrap(): boolean;
//#endregion
export { NAVIGATION_RUNTIME_KEY, NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION, NavigationRuntime, NavigationRuntimeBootstrap, NavigationRuntimeFunctions, NavigationRuntimeNavigate, NavigationRuntimeRscBootstrap, NavigationRuntimeRscChunk, NavigationRuntimeSnapshot, NavigationRuntimeVisibleCommitMode, ensureNavigationRuntimeRscBootstrap, getNavigationRuntime, hasAppNavigationRuntime, hasAppNavigationRuntimeBootstrap, registerNavigationRuntimeBootstrap, registerNavigationRuntimeFunctions, subscribeNavigationRuntimeRscChunk };