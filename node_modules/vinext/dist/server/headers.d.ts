import { MIDDLEWARE_HEADER_PREFIX, MIDDLEWARE_SET_COOKIE_HEADER, MIDDLEWARE_SKIP_HEADER, VINEXT_MW_CTX_HEADER, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER } from "../utils/protocol-headers.js";

//#region src/server/headers.d.ts
/**
 * Internal HTTP header name constants used throughout vinext.
 *
 * Centralizes all custom header names so they are defined once and referenced
 * everywhere via imports. Keeping them in one module prevents typos, makes
 * rename-refactors trivial, and lets grep find every consumer instantly.
 *
 * Standard HTTP headers (Content-Type, Cache-Control, etc.) are intentionally
 * omitted — only vinext-internal and Next.js-protocol headers belong here.
 */
/** ISR / page cache state indicator: "HIT" | "MISS" | "STALE" | "STATIC". */
declare const VINEXT_CACHE_HEADER = "X-Vinext-Cache";
/** Next.js public ISR / page cache state indicator. */
declare const NEXTJS_CACHE_HEADER = "x-nextjs-cache";
/** Static file signal — value is URL-encoded pathname. */
declare const VINEXT_STATIC_FILE_HEADER = "x-vinext-static-file";
/** Timing metrics: `handlerStart,compileMs,renderMs`. */
declare const VINEXT_TIMING_HEADER = "x-vinext-timing";
/** Internal endpoint used to evaluate App Router generateStaticParams exports. */
declare const VINEXT_PRERENDER_STATIC_PARAMS_PATH = "/__vinext/prerender/static-params";
/** Internal endpoint used to evaluate Pages Router getStaticPaths exports. */
declare const VINEXT_PRERENDER_PAGES_STATIC_PATHS_PATH = "/__vinext/prerender/pages-static-paths";
/** TPR (Tailored Per-Request) revalidation interval in seconds. */
declare const VINEXT_REVALIDATE_HEADER = "x-vinext-revalidate";
/** Marker on cached ISR entries indicating RSC payload (value "1"). */
declare const VINEXT_RSC_MARKER_HEADER = "x-vinext-rsc";
/** URL-encoded JSON route params carried on RSC responses. */
declare const VINEXT_PARAMS_HEADER = "X-Vinext-Params";
/** Deduplicated, sorted list of mounted layout slots for cache keying. */
declare const VINEXT_MOUNTED_SLOTS_HEADER = "X-Vinext-Mounted-Slots";
/** Per-page dynamic stale time in seconds for App Router RSC responses. */
declare const VINEXT_DYNAMIC_STALE_TIME_HEADER = "X-Vinext-Dynamic-Stale-Time";
/** URL-encoded rendered path and search after middleware/config rewrites. */
declare const VINEXT_RENDERED_PATH_AND_SEARCH_HEADER = "X-Vinext-Rendered-Path-And-Search";
/** Prerender-only JSON side channel carrying request cacheLife metadata. */
declare const VINEXT_PRERENDER_CACHE_LIFE_HEADER = "x-vinext-prerender-cache-life";
/** Route interception context for parallel/intercepting routes. */
declare const VINEXT_INTERCEPTION_CONTEXT_HEADER = "X-Vinext-Interception-Context";
/** RSC render mode (e.g. "navigation", "prefetch"). */
declare const VINEXT_RSC_RENDER_MODE_HEADER = "X-Vinext-Rsc-Render-Mode";
/** Disabled-by-default client hint describing already-held App Router payload entries. */
declare const VINEXT_CLIENT_REUSE_MANIFEST_HEADER = "X-Vinext-Client-Reuse-Manifest";
/**
 * Side-channel signal that an RSC response (HTTP 200) encodes a `redirect()`
 * thrown during render. The header value is the redirect target (path-only
 * for same-origin, absolute for cross-origin). The flight body still carries
 * the canonical `NEXT_REDIRECT;...` digest so Next.js's own tests can read it
 * via response.body; this header is purely for vinext's own client
 * (`navigateRsc` in app-browser-entry.ts) to follow the redirect inside the
 * same navigation transaction — keeping `useTransition`'s pending state
 * continuous across the hop. Pre-1347 vinext relied on `fetch`'s auto-follow
 * of a 307 for that, but the new 200 + flight format leaves it without a
 * cheap way to detect the redirect ahead of stream decode.
 */
declare const VINEXT_RSC_REDIRECT_HEADER = "X-Vinext-Rsc-Redirect";
/** History update mode encoded by a streamed RSC redirect. */
declare const VINEXT_RSC_REDIRECT_TYPE_HEADER = "X-Vinext-Rsc-Redirect-Type";
/** Standard RSC header — value "1" indicates an RSC payload request. */
declare const RSC_HEADER = "RSC";
/** Server Action invocation header (vinext/vite-rsc protocol). */
declare const RSC_ACTION_HEADER = "x-rsc-action";
/** Next.js Server Action invocation header (fallback for x-rsc-action). */
declare const NEXT_ACTION_HEADER = "next-action";
/** Next.js action-not-found indicator (value "1"). */
declare const NEXTJS_ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";
/**
 * Deployment ID header used by the Pages Router for deployment-skew
 * protection. Set on every `/_next/data/` response so the client can detect
 * when a new deployment has been rolled out and trigger a hard navigation.
 * Mirrors `NEXT_NAV_DEPLOYMENT_ID_HEADER` from Next.js `lib/constants.ts`.
 */
declare const NEXTJS_DEPLOYMENT_ID_HEADER = "x-nextjs-deployment-id";
/** Forwarded action marker — set when a request has already been forwarded between workers. */
declare const ACTION_FORWARDED_HEADER = "x-action-forwarded";
/** Indicates revalidation occurred — value is JSON kind (1 = path/tag, 2 = dynamic-only). */
declare const ACTION_REVALIDATED_HEADER = "x-action-revalidated";
/** Redirect URL from a Server Action. */
declare const ACTION_REDIRECT_HEADER = "x-action-redirect";
/** Redirect type from a Server Action ("push" | "replace"). */
declare const ACTION_REDIRECT_TYPE_HEADER = "x-action-redirect-type";
/** HTTP status for a Server Action redirect (e.g. "308"). */
declare const ACTION_REDIRECT_STATUS_HEADER = "x-action-redirect-status";
/** Signal from `NextResponse.next()` — value "1" means "continue to next handler". */
declare const MIDDLEWARE_NEXT_HEADER = "x-middleware-next";
/** Rewrite destination URL set by `NextResponse.rewrite()`. */
declare const MIDDLEWARE_REWRITE_HEADER = "x-middleware-rewrite";
declare const NEXT_ROUTER_STATE_TREE_HEADER = "Next-Router-State-Tree";
declare const NEXT_ROUTER_PREFETCH_HEADER = "Next-Router-Prefetch";
declare const NEXT_ROUTER_SEGMENT_PREFETCH_HEADER = "Next-Router-Segment-Prefetch";
declare const NEXT_URL_HEADER = "Next-Url";
declare const NEXT_REQUEST_ID_HEADER = "x-nextjs-request-id";
declare const NEXT_HTML_REQUEST_ID_HEADER = "x-nextjs-html-request-id";
/** Lowercase flight header variants used in middleware forwarding. */
declare const FLIGHT_HEADERS: readonly string[];
/**
 * Headers that must be stripped from external requests before any handler
 * processes them. An attacker could forge these to influence routing or
 * impersonate internal data fetches.
 *
 * Ported from Next.js `INTERNAL_HEADERS`:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/server-ipc/utils.ts
 */
declare const INTERNAL_HEADERS: string[];
/** Vinext-only internal headers stripped alongside Next.js protocol internals. */
declare const VINEXT_INTERNAL_HEADERS: string[];
//#endregion
export { ACTION_FORWARDED_HEADER, ACTION_REDIRECT_HEADER, ACTION_REDIRECT_STATUS_HEADER, ACTION_REDIRECT_TYPE_HEADER, ACTION_REVALIDATED_HEADER, FLIGHT_HEADERS, INTERNAL_HEADERS, MIDDLEWARE_HEADER_PREFIX, MIDDLEWARE_NEXT_HEADER, MIDDLEWARE_REWRITE_HEADER, MIDDLEWARE_SET_COOKIE_HEADER, MIDDLEWARE_SKIP_HEADER, NEXTJS_ACTION_NOT_FOUND_HEADER, NEXTJS_CACHE_HEADER, NEXTJS_DEPLOYMENT_ID_HEADER, NEXT_ACTION_HEADER, NEXT_HTML_REQUEST_ID_HEADER, NEXT_REQUEST_ID_HEADER, NEXT_ROUTER_PREFETCH_HEADER, NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, NEXT_ROUTER_STATE_TREE_HEADER, NEXT_URL_HEADER, RSC_ACTION_HEADER, RSC_HEADER, VINEXT_CACHE_HEADER, VINEXT_CLIENT_REUSE_MANIFEST_HEADER, VINEXT_DYNAMIC_STALE_TIME_HEADER, VINEXT_INTERCEPTION_CONTEXT_HEADER, VINEXT_INTERNAL_HEADERS, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_MW_CTX_HEADER, VINEXT_PARAMS_HEADER, VINEXT_PRERENDER_CACHE_LIFE_HEADER, VINEXT_PRERENDER_PAGES_STATIC_PATHS_PATH, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER, VINEXT_PRERENDER_STATIC_PARAMS_PATH, VINEXT_RENDERED_PATH_AND_SEARCH_HEADER, VINEXT_REVALIDATE_HEADER, VINEXT_RSC_MARKER_HEADER, VINEXT_RSC_REDIRECT_HEADER, VINEXT_RSC_REDIRECT_TYPE_HEADER, VINEXT_RSC_RENDER_MODE_HEADER, VINEXT_STATIC_FILE_HEADER, VINEXT_TIMING_HEADER };