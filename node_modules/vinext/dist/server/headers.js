import { MIDDLEWARE_HEADER_PREFIX, MIDDLEWARE_OVERRIDE_HEADERS, MIDDLEWARE_SET_COOKIE_HEADER, MIDDLEWARE_SKIP_HEADER, VINEXT_MW_CTX_HEADER, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER } from "../utils/protocol-headers.js";
//#region src/server/headers.ts
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
const VINEXT_CACHE_HEADER = "X-Vinext-Cache";
/** Next.js public ISR / page cache state indicator. */
const NEXTJS_CACHE_HEADER = "x-nextjs-cache";
/** Static file signal — value is URL-encoded pathname. */
const VINEXT_STATIC_FILE_HEADER = "x-vinext-static-file";
/** Timing metrics: `handlerStart,compileMs,renderMs`. */
const VINEXT_TIMING_HEADER = "x-vinext-timing";
/** Internal endpoint used to evaluate App Router generateStaticParams exports. */
const VINEXT_PRERENDER_STATIC_PARAMS_PATH = "/__vinext/prerender/static-params";
/** Internal endpoint used to evaluate Pages Router getStaticPaths exports. */
const VINEXT_PRERENDER_PAGES_STATIC_PATHS_PATH = "/__vinext/prerender/pages-static-paths";
/** TPR (Tailored Per-Request) revalidation interval in seconds. */
const VINEXT_REVALIDATE_HEADER = "x-vinext-revalidate";
/** Marker on cached ISR entries indicating RSC payload (value "1"). */
const VINEXT_RSC_MARKER_HEADER = "x-vinext-rsc";
/** URL-encoded JSON route params carried on RSC responses. */
const VINEXT_PARAMS_HEADER = "X-Vinext-Params";
/** Deduplicated, sorted list of mounted layout slots for cache keying. */
const VINEXT_MOUNTED_SLOTS_HEADER = "X-Vinext-Mounted-Slots";
/** Per-page dynamic stale time in seconds for App Router RSC responses. */
const VINEXT_DYNAMIC_STALE_TIME_HEADER = "X-Vinext-Dynamic-Stale-Time";
/** URL-encoded rendered path and search after middleware/config rewrites. */
const VINEXT_RENDERED_PATH_AND_SEARCH_HEADER = "X-Vinext-Rendered-Path-And-Search";
/** Prerender-only JSON side channel carrying request cacheLife metadata. */
const VINEXT_PRERENDER_CACHE_LIFE_HEADER = "x-vinext-prerender-cache-life";
/** Route interception context for parallel/intercepting routes. */
const VINEXT_INTERCEPTION_CONTEXT_HEADER = "X-Vinext-Interception-Context";
/** RSC render mode (e.g. "navigation", "prefetch"). */
const VINEXT_RSC_RENDER_MODE_HEADER = "X-Vinext-Rsc-Render-Mode";
/** Disabled-by-default client hint describing already-held App Router payload entries. */
const VINEXT_CLIENT_REUSE_MANIFEST_HEADER = "X-Vinext-Client-Reuse-Manifest";
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
const VINEXT_RSC_REDIRECT_HEADER = "X-Vinext-Rsc-Redirect";
/** History update mode encoded by a streamed RSC redirect. */
const VINEXT_RSC_REDIRECT_TYPE_HEADER = "X-Vinext-Rsc-Redirect-Type";
/** Standard RSC header — value "1" indicates an RSC payload request. */
const RSC_HEADER = "RSC";
/** Server Action invocation header (vinext/vite-rsc protocol). */
const RSC_ACTION_HEADER = "x-rsc-action";
/** Next.js Server Action invocation header (fallback for x-rsc-action). */
const NEXT_ACTION_HEADER = "next-action";
/** Next.js action-not-found indicator (value "1"). */
const NEXTJS_ACTION_NOT_FOUND_HEADER = "x-nextjs-action-not-found";
/**
* Deployment ID header used by the Pages Router for deployment-skew
* protection. Set on every `/_next/data/` response so the client can detect
* when a new deployment has been rolled out and trigger a hard navigation.
* Mirrors `NEXT_NAV_DEPLOYMENT_ID_HEADER` from Next.js `lib/constants.ts`.
*/
const NEXTJS_DEPLOYMENT_ID_HEADER = "x-nextjs-deployment-id";
/** Forwarded action marker — set when a request has already been forwarded between workers. */
const ACTION_FORWARDED_HEADER = "x-action-forwarded";
/** Indicates revalidation occurred — value is JSON kind (1 = path/tag, 2 = dynamic-only). */
const ACTION_REVALIDATED_HEADER = "x-action-revalidated";
/** Redirect URL from a Server Action. */
const ACTION_REDIRECT_HEADER = "x-action-redirect";
/** Redirect type from a Server Action ("push" | "replace"). */
const ACTION_REDIRECT_TYPE_HEADER = "x-action-redirect-type";
/** HTTP status for a Server Action redirect (e.g. "308"). */
const ACTION_REDIRECT_STATUS_HEADER = "x-action-redirect-status";
/** Signal from `NextResponse.next()` — value "1" means "continue to next handler". */
const MIDDLEWARE_NEXT_HEADER = "x-middleware-next";
/** Rewrite destination URL set by `NextResponse.rewrite()`. */
const MIDDLEWARE_REWRITE_HEADER = "x-middleware-rewrite";
/** Redirect URL set by middleware. */
const MIDDLEWARE_REDIRECT_HEADER = "x-middleware-redirect";
const NEXT_ROUTER_STATE_TREE_HEADER = "Next-Router-State-Tree";
const NEXT_ROUTER_PREFETCH_HEADER = "Next-Router-Prefetch";
const NEXT_ROUTER_SEGMENT_PREFETCH_HEADER = "Next-Router-Segment-Prefetch";
const NEXT_URL_HEADER = "Next-Url";
const NEXT_REQUEST_ID_HEADER = "x-nextjs-request-id";
const NEXT_HTML_REQUEST_ID_HEADER = "x-nextjs-html-request-id";
/** Lowercase flight header variants used in middleware forwarding. */
const FLIGHT_HEADERS = [
	"rsc",
	"next-router-state-tree",
	"next-router-prefetch",
	"next-hmr-refresh",
	"next-router-segment-prefetch"
];
/**
* Headers that must be stripped from external requests before any handler
* processes them. An attacker could forge these to influence routing or
* impersonate internal data fetches.
*
* Ported from Next.js `INTERNAL_HEADERS`:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/lib/server-ipc/utils.ts
*/
const INTERNAL_HEADERS = [
	MIDDLEWARE_REWRITE_HEADER,
	MIDDLEWARE_REDIRECT_HEADER,
	MIDDLEWARE_SET_COOKIE_HEADER,
	MIDDLEWARE_SKIP_HEADER,
	MIDDLEWARE_OVERRIDE_HEADERS,
	MIDDLEWARE_NEXT_HEADER,
	"x-now-route-matches",
	"x-matched-path",
	"x-nextjs-data",
	"x-next-resume-state-length",
	ACTION_FORWARDED_HEADER
];
/** Vinext-only internal headers stripped alongside Next.js protocol internals. */
const VINEXT_INTERNAL_HEADERS = [
	VINEXT_PRERENDER_ROUTE_PARAMS_HEADER,
	VINEXT_PRERENDER_SPECULATIVE_HEADER,
	VINEXT_PRERENDER_CACHE_LIFE_HEADER
];
//#endregion
export { ACTION_FORWARDED_HEADER, ACTION_REDIRECT_HEADER, ACTION_REDIRECT_STATUS_HEADER, ACTION_REDIRECT_TYPE_HEADER, ACTION_REVALIDATED_HEADER, FLIGHT_HEADERS, INTERNAL_HEADERS, MIDDLEWARE_HEADER_PREFIX, MIDDLEWARE_NEXT_HEADER, MIDDLEWARE_REWRITE_HEADER, MIDDLEWARE_SET_COOKIE_HEADER, MIDDLEWARE_SKIP_HEADER, NEXTJS_ACTION_NOT_FOUND_HEADER, NEXTJS_CACHE_HEADER, NEXTJS_DEPLOYMENT_ID_HEADER, NEXT_ACTION_HEADER, NEXT_HTML_REQUEST_ID_HEADER, NEXT_REQUEST_ID_HEADER, NEXT_ROUTER_PREFETCH_HEADER, NEXT_ROUTER_SEGMENT_PREFETCH_HEADER, NEXT_ROUTER_STATE_TREE_HEADER, NEXT_URL_HEADER, RSC_ACTION_HEADER, RSC_HEADER, VINEXT_CACHE_HEADER, VINEXT_CLIENT_REUSE_MANIFEST_HEADER, VINEXT_DYNAMIC_STALE_TIME_HEADER, VINEXT_INTERCEPTION_CONTEXT_HEADER, VINEXT_INTERNAL_HEADERS, VINEXT_MOUNTED_SLOTS_HEADER, VINEXT_MW_CTX_HEADER, VINEXT_PARAMS_HEADER, VINEXT_PRERENDER_CACHE_LIFE_HEADER, VINEXT_PRERENDER_PAGES_STATIC_PATHS_PATH, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER, VINEXT_PRERENDER_STATIC_PARAMS_PATH, VINEXT_RENDERED_PATH_AND_SEARCH_HEADER, VINEXT_REVALIDATE_HEADER, VINEXT_RSC_MARKER_HEADER, VINEXT_RSC_REDIRECT_HEADER, VINEXT_RSC_REDIRECT_TYPE_HEADER, VINEXT_RSC_RENDER_MODE_HEADER, VINEXT_STATIC_FILE_HEADER, VINEXT_TIMING_HEADER };
