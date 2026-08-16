import { VinextLinkPrefetchRoute } from "../../client/vinext-next-data.js";
import { getPagesRouterComponentsMap } from "./pages-router-components.js";

//#region src/shims/internal/app-route-detection.d.ts
declare global {
  interface Window {
    __VINEXT_LINK_PREFETCH_ROUTES__?: VinextLinkPrefetchRoute[];
  }
}
/**
 * Record `components[pathname] = { __appRouter: true }` on the shared
 * Pages Router map when the href matches an App Router route. No-op when the
 * manifest is absent, the URL is external, or no app route matches.
 *
 * `pathname` is the basePath-stripped, trailing-slash-stripped path —
 * matching Next.js's `removeTrailingSlash(removeBasePath(pathname))` key used
 * at read time (router.ts:1442). Stripping here ensures the write and read
 * keys agree regardless of whether the caller normalised trailing slashes
 * first (e.g. `link.tsx` normalises to match `trailingSlash` config before
 * calling, while `router.prefetch()` passes the raw user-supplied URL).
 */
declare function markAppRouteDetectedOnPrefetch(href: string, basePath: string): Promise<void>;
//#endregion
export { getPagesRouterComponentsMap, markAppRouteDetectedOnPrefetch };