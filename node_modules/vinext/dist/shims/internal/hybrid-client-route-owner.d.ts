import { HybridClientOwner } from "./hybrid-client-route-owner-direct.js";

//#region src/shims/internal/hybrid-client-route-owner.d.ts
declare function resolveHybridClientRewriteHref(href: string, basePath: string): string | null;
/**
 * Decide which router should own a soft-navigated URL. Returns:
 *   - "app"    → the App Router runtime handles the navigation (RSC fetch).
 *   - "pages"  → Pages owns the URL; the caller must hard-navigate instead.
 *   - null     → no router matched (preserves the existing 404 path).
 *
 * `basePath` must match what the page uses (typically `process.env.__NEXT_ROUTER_BASEPATH`).
 *
 * The lookup uses the App and Pages manifests on `window` so the same
 * matcher trie produces the same result the server will see when the
 * request lands.
 */
declare function resolveHybridClientRouteOwner(href: string, basePath: string): HybridClientOwner | null;
//#endregion
export { type HybridClientOwner, resolveHybridClientRewriteHref, resolveHybridClientRouteOwner };