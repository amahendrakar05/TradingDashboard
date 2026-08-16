//#region src/utils/protocol-headers.ts
/** Serialized middleware context (JSON) forwarded from dev server to RSC entry. */
const VINEXT_MW_CTX_HEADER = "x-vinext-mw-ctx";
/** Build-time prerender authentication secret. */
const VINEXT_PRERENDER_SECRET_HEADER = "x-vinext-prerender-secret";
/** URL-encoded JSON route params for build-time prerender renders. */
const VINEXT_PRERENDER_ROUTE_PARAMS_HEADER = "x-vinext-prerender-route-params";
/** Indicates a build-time prerender render is probing whether a route can be static. */
const VINEXT_PRERENDER_SPECULATIVE_HEADER = "x-vinext-prerender-speculative";
/** Prefix for forwarded request headers (e.g. `x-middleware-request-cookie`). */
const MIDDLEWARE_REQUEST_HEADER_PREFIX = "x-middleware-request-";
/** Comma-separated list of header names that middleware wants to override. */
const MIDDLEWARE_OVERRIDE_HEADERS = "x-middleware-override-headers";
/** Carries cookies set by middleware for same-render reads. */
const MIDDLEWARE_SET_COOKIE_HEADER = "x-middleware-set-cookie";
/** Signals Pages Router prefetch cache opt-out. */
const MIDDLEWARE_CACHE_HEADER = "x-middleware-cache";
/** Skip-middleware signal. */
const MIDDLEWARE_SKIP_HEADER = "x-middleware-skip";
/** Generic prefix for all middleware internal headers. */
const MIDDLEWARE_HEADER_PREFIX = "x-middleware-";
//#endregion
export { MIDDLEWARE_CACHE_HEADER, MIDDLEWARE_HEADER_PREFIX, MIDDLEWARE_OVERRIDE_HEADERS, MIDDLEWARE_REQUEST_HEADER_PREFIX, MIDDLEWARE_SET_COOKIE_HEADER, MIDDLEWARE_SKIP_HEADER, VINEXT_MW_CTX_HEADER, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER, VINEXT_PRERENDER_SPECULATIVE_HEADER };
