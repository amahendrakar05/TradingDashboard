//#region src/server/app-ppr-fallback-shell.d.ts
type AppPprFallbackShellRoute = {
  params: readonly string[];
  pattern: string;
  rootParamNames?: readonly string[] | null;
};
type AppPprFallbackShell = {
  fallbackParamNames: readonly string[];
  pathname: string;
  params: Record<string, string | string[]>;
};
/**
 * A fallback-shell cache entry as consumed by the dispatch layer.
 * Produced at build time by the PPR prerender and served at request time
 * when the exact cache entry for a dynamic child param is missing.
 */
type AppPagePprFallbackCacheShell = {
  fallbackParamNames: readonly string[];
  params: Record<string, string | string[]>;
  pathname: string;
};
declare function markAppPprDynamicFallbackShellHtml(html: string): string;
declare function isAppPprDynamicFallbackShellHtml(html: string): boolean;
declare function createAppPprFallbackShell(route: AppPprFallbackShellRoute, matchedParams: Record<string, string | string[]>): AppPprFallbackShell | null;
declare function createAppPprFallbackShells(route: AppPprFallbackShellRoute, matchedParams: Record<string, string | string[]>): AppPprFallbackShell[];
declare function rewriteAppPprFallbackShellHtmlNavigation(options: {
  html: string;
  params: Record<string, string | string[]>;
  pathname: string;
  searchParams: URLSearchParams;
}): string;
//#endregion
export { AppPagePprFallbackCacheShell, createAppPprFallbackShell, createAppPprFallbackShells, isAppPprDynamicFallbackShellHtml, markAppPprDynamicFallbackShellHtml, rewriteAppPprFallbackShellHtmlNavigation };