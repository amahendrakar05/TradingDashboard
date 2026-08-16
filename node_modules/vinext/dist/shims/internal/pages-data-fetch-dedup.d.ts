//#region src/shims/internal/pages-data-fetch-dedup.d.ts
/**
 * In-flight request dedup for the Pages Router `/_next/data/<id>/<page>.json`
 * endpoint.
 *
 * Why this exists: when a user (or app code) triggers several near-simultaneous
 * navigations to the same gSSP route — e.g. clicking the same `<Link>` multiple
 * times before the first navigation lands — each call to `Router.push` would
 * otherwise enter its own `navigateClientData()` flow and dispatch its own
 * `fetch()` against the data endpoint. That balloons server load and breaks
 * Next.js' documented "one fetch per unique data URL" guarantee.
 *
 * Ported from Next.js: `fetchNextData()` in
 * `packages/next/src/shared/lib/router/router.ts`. Next.js maintains an
 * `inflightCache` (keyed by the resolved data URL) and reuses the existing
 * Promise when a concurrent caller asks for the same URL. The entry is
 * dropped once the fetch settles (success or rejection) so the next
 * navigation re-fetches fresh.
 *
 * Design notes:
 *
 * - Callers receive a cloned Response, so each can independently consume the
 *   body (`.json()`, `.text()`, etc.). The originating Response is never read
 *   directly by anyone, which keeps subsequent clones legal even after one
 *   caller has consumed its copy.
 *
 * - Each caller owns one waiter. Cancelling a waiter rejects only that caller;
 *   the shared request continues and self-evicts when it settles. This mirrors
 *   Next.js: a superseded data request may still reach the server, but its
 *   result is ignored by the cancelled navigation.
 *
 * - The map is module-scoped (one per realm). The Pages Router runs in the
 *   browser only, so a single `Map` is sufficient.
 */
declare function getPagesStaticDataCache(): Record<string, Promise<Response>>;
declare function fetchCachedPagesData(dataHref: string, init?: RequestInit): Promise<Response>;
declare function fetchStaticPagesData(dataHref: string, init?: RequestInit): Promise<Response>;
declare function fetchUncachedPagesData(dataHref: string, init?: RequestInit): Promise<Response>;
declare function evictPagesDataCache(dataHref: string): void;
/**
 * Dedupe a `fetch()` against the `_next/data` endpoint. Multiple concurrent
 * callers for the same resolved URL and deployment ID share one underlying
 * network request.
 *
 * Each call returns a freshly-cloned `Response` so consumers can read the
 * body independently. Once the in-flight Promise settles (resolve or reject)
 * the entry is removed, and the next call will hit the network again.
 *
 * Errors propagate to every concurrent caller — the in-flight entry is
 * dropped on failure so the next navigation can retry.
 */
declare function dedupedPagesDataFetch(dataHref: string, init?: RequestInit): Promise<Response>;
/**
 * Drop every cached in-flight entry. Intended for tests; production code
 * does not need to call this because entries self-evict on settle.
 */
declare function clearPagesDataInflight(): void;
//#endregion
export { clearPagesDataInflight, dedupedPagesDataFetch, evictPagesDataCache, fetchCachedPagesData, fetchStaticPagesData, fetchUncachedPagesData, getPagesStaticDataCache };