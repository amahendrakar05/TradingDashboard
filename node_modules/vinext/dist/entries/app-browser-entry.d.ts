import { NextRewrite } from "../config/next-config.js";
import { AppRoute, RouteManifest } from "../routing/app-route-graph.js";
import { VinextLinkPrefetchRoute, VinextPagesLinkPrefetchRoute } from "../client/vinext-next-data.js";

//#region src/entries/app-browser-entry.d.ts
/**
 * Generate the virtual browser entry module.
 *
 * This runs in the client (browser). It hydrates the page from the
 * embedded RSC payload and handles client-side navigation by re-fetching
 * RSC streams.
 */
declare function generateBrowserEntry(routes?: readonly AppRoute[], routeManifest?: RouteManifest | null, pagesPrefetchRoutes?: readonly VinextPagesLinkPrefetchRoute[], rewrites?: {
  afterFiles: NextRewrite[];
  beforeFiles: NextRewrite[];
  fallback: NextRewrite[];
}): string;
/**
 * Filter for routes that should appear in the `__VINEXT_LINK_PREFETCH_ROUTES__`
 * manifest. Exported so the Pages Router client entry can reuse it when
 * emitting the same manifest for hybrid builds — see issue #1526 and
 * `pages-client-entry.ts`.
 */
declare function isLinkPrefetchRoute(route: AppRoute): boolean;
declare function toDocumentOnlyAppRoute(route: AppRoute): VinextLinkPrefetchRoute;
/** Project an `AppRoute` down to the public `VinextLinkPrefetchRoute` shape. */
declare function toLinkPrefetchRoute(route: AppRoute): VinextLinkPrefetchRoute;
//#endregion
export { generateBrowserEntry, isLinkPrefetchRoute, toDocumentOnlyAppRoute, toLinkPrefetchRoute };