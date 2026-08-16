import { VinextLinkPrefetchRoute, VinextPagesLinkPrefetchRoute } from "../../client/vinext-next-data.js";

//#region src/shims/internal/hybrid-client-route-owner-direct.d.ts
type HybridClientOwner = "app" | "document" | "pages";
type HybridClientRouteMatches = {
  appMatch: VinextLinkPrefetchRoute | null;
  pagesMatch: VinextPagesLinkPrefetchRoute | null;
};
declare global {
  interface Window {
    __VINEXT_LINK_PREFETCH_ROUTES__?: VinextLinkPrefetchRoute[];
    __VINEXT_PAGES_LINK_PREFETCH_ROUTES__?: VinextPagesLinkPrefetchRoute[];
  }
}
declare function resolveSameOriginPathname(href: string, basePath: string): string | null;
declare function matchDirectHybridClientRoutes(href: string, basePath: string): HybridClientRouteMatches;
declare function resolveMatchedHybridClientRouteOwner({
  appMatch,
  pagesMatch
}: HybridClientRouteMatches): HybridClientOwner | null;
declare function resolveDirectHybridClientRouteOwner(href: string, basePath: string): HybridClientOwner | null;
//#endregion
export { HybridClientOwner, matchDirectHybridClientRoutes, resolveDirectHybridClientRouteOwner, resolveMatchedHybridClientRouteOwner, resolveSameOriginPathname };