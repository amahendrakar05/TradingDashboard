import { NavigationContext } from "./navigation-context-state.js";
//#region src/shims/navigation-state.d.ts
type NavigationState = {
  serverContext: NavigationContext | null;
  serverInsertedHTMLCallbacks: Array<() => unknown>;
};
/**
 * Run a function within a navigation ALS scope.
 * Ensures per-request isolation for navigation context and
 * useServerInsertedHTML callbacks on concurrent runtimes.
 */
declare function runWithNavigationContext<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithNavigationContext<T>(fn: () => T | Promise<T>): T | Promise<T>;
/**
 * Run a function with a fresh useServerInsertedHTML callback list while
 * preserving the current navigation context.
 *
 * Used by the Pages Router ISR cache-fill pass: it is the same request/path,
 * but it needs a fresh callback collection so CSS-in-JS insertions from the
 * streamed render cannot accumulate into the cache-fill render.
 */
declare function runWithServerInsertedHTMLState<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithServerInsertedHTMLState<T>(fn: () => T | Promise<T>): T | Promise<T>;
//#endregion
export { NavigationState, runWithNavigationContext, runWithServerInsertedHTMLState };