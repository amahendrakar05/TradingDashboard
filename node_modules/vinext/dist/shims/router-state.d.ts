//#region src/shims/router-state.d.ts
/**
 * Server-only Pages Router state backed by AsyncLocalStorage.
 *
 * Provides request-scoped isolation for SSR context (pathname, query,
 * locale) so concurrent requests on Workers don't share state.
 *
 * This module is server-only — it imports node:async_hooks and must NOT
 * be bundled for the browser.
 */
type SSRContext = {
  pathname: string;
  query: Record<string, string | string[]>;
  asPath: string;
  navigationIsReady?: boolean;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  isPreview?: boolean;
  isFallback?: boolean;
};
type RouterState = {
  ssrContext: SSRContext | null;
};
/**
 * Run a function within a router state ALS scope.
 * Ensures per-request isolation for Pages Router SSR context
 * on concurrent runtimes.
 */
declare function runWithRouterState<T>(fn: () => Promise<T>): Promise<T>;
declare function runWithRouterState<T>(fn: () => T | Promise<T>): T | Promise<T>;
//#endregion
export { RouterState, SSRContext, runWithRouterState };