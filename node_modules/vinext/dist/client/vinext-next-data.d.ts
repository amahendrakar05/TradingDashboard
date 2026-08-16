import { NEXT_DATA } from "../shims/internal/utils.js";

//#region src/client/vinext-next-data.d.ts
type VinextLinkPrefetchRoute = {
  canPrefetchLoadingShell: boolean;
  documentOnly?: boolean;
  isDynamic: boolean;
  patternParts: string[];
  requiresDynamicNavigationRequest?: boolean;
};
/**
 * Pages Router route pattern exposed to the client so the App Router's
 * navigation runtime can decide whether a soft-navigated URL should be
 * handled by Pages (hard nav) or App (RSC). Mirrors the public shape of
 * `VinextLinkPrefetchRoute` so a single trie matcher handles both.
 *
 * `canPrefetchLoadingShell` is always `false` for Pages routes — Pages
 * does not have a separate loading boundary and its prefetch surface is
 * `_next/data/<buildId>/<page>.json`.
 */
type VinextPagesLinkPrefetchRoute = {
  canPrefetchLoadingShell: false;
  documentOnly?: boolean;
  isDynamic: boolean;
  patternParts: string[];
  requiresDynamicNavigationRequest?: boolean;
};
type VinextNextData = {
  /** vinext-specific additions (not part of Next.js upstream). */__vinext?: {
    /** Absolute URL of the page module for dynamic import. */pageModuleUrl?: string; /** Absolute URL of the `_app` module for dynamic import. */
    appModuleUrl?: string; /** True when the Pages Router server has middleware/proxy configured. */
    hasMiddleware?: boolean; /** True when build-time rewrites can affect the initial Pages Router ready state. */
    hasRewrites?: boolean; /** Server-resolved Pages route URL used to hydrate fallback shells behind rewrites. */
    routeUrl?: string;
  };
} & NEXT_DATA;
type BrowserVinextNextData = NonNullable<Window["__NEXT_DATA__"]> & VinextNextData;
type VinextLocaleGlobalTarget = {
  __VINEXT_LOCALE__: string | undefined;
  __VINEXT_LOCALES__: string[] | undefined;
  __VINEXT_DEFAULT_LOCALE__: string | undefined;
};
declare function extractVinextNextDataJson(html: string): string | null;
declare function parseVinextNextDataJson(json: string): BrowserVinextNextData;
declare function applyVinextLocaleGlobals(target: VinextLocaleGlobalTarget, nextData: VinextNextData): void;
//#endregion
export { VinextLinkPrefetchRoute, VinextNextData, VinextPagesLinkPrefetchRoute, applyVinextLocaleGlobals, extractVinextNextDataJson, parseVinextNextDataJson };