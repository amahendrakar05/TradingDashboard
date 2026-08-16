import { INTERNAL_HEADERS, VINEXT_INTERNAL_HEADERS } from "./headers.js";
import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { isOpenRedirectShaped } from "./open-redirect.js";

//#region src/server/request-pipeline.d.ts
/**
 * Apply the URL Standard's pathname canonicalization without decoding and
 * re-encoding ordinary percent escapes.
 *
 * In particular, WHATWG URLs remove literal and percent-encoded dot segments
 * (`/%2e/about` becomes `/about`) while preserving unrelated spellings such
 * as `/%61bout`, `%2F`, `%5C`, and `%252F` byte-for-byte. Node request adapters
 * must do this before comparing raw route/config/basePath identity so those
 * comparisons agree with the `Request` that userland eventually receives.
 */
declare function canonicalizeRequestPathname(pathname: string): string;
/** Canonicalize only the pathname portion while preserving the raw query. */
declare function canonicalizeRequestUrlPathname(url: string): string;
/**
 * Shared request pipeline utilities.
 *
 * Extracted from generated entries and server hot paths to keep codegen focused
 * on app shape while normal modules own request behavior. Some dev-server and
 * worker-template setup code still has inline normalization that should be
 * migrated in follow-up work.
 *
 * These utilities handle the common request lifecycle steps: protocol-
 * relative URL guards, basePath stripping, trailing slash normalization,
 * and CSRF origin validation.
 *
 * Plain-text error response builders (forbidden / not-found / etc.) live in
 * `./http-error-responses.ts`.
 */
/**
 * Guard against protocol-relative URL open redirects.
 *
 * Paths like `//example.com/` would be redirected to `//example.com` by the
 * trailing-slash normalizer, which browsers interpret as `http://example.com`.
 * Backslashes are equivalent to forward slashes in the URL spec
 * (e.g. `/\evil.com` is treated as `//evil.com` by browsers).
 *
 * Next.js returns 404 for these paths. We check the RAW pathname before
 * normalization so the guard fires before normalizePath collapses `//`.
 *
 * Percent-encoded variants are also blocked because:
 *   - `%5C` decodes to `\` (browsers treat `/\evil.com` as `//evil.com`).
 *   - `%2F` decodes to `/` (so `/%2F/evil.com` effectively becomes `//evil.com`).
 * These forms survive segment-wise decoding that re-encodes path delimiters
 * (e.g. `normalizePathnameForRouteMatchStrict`), so a later trailing-slash
 * redirect would still echo the encoded form in its `Location` header. See
 * `isOpenRedirectShaped` for the full list of rejected leading-segment forms.
 *
 * @param rawPathname - The raw pathname from the URL, before any normalization
 * @returns A 404 Response if the path is protocol-relative, or null to continue
 */
declare function guardProtocolRelativeUrl(rawPathname: string): Response | null;
type HeaderRecord = Record<string, string | string[]>;
type StaticFileSignalContext = {
  headers: Headers | null;
  status: number | null;
};
type ResolvePublicFileRouteOptions = {
  cleanPathname: string;
  middlewareContext: StaticFileSignalContext;
  pathname: string;
  publicFiles: ReadonlySet<string>;
  request: Request;
};
declare function createStaticFileSignal(pathname: string, context: StaticFileSignalContext): Response;
/**
 * Resolve the public/ filesystem-route slot in the Next.js routing order.
 *
 * Public files are checked after middleware and before afterFiles/fallback
 * rewrites. The generated App Router entry provides the public-file set; this
 * helper owns the request-method and RSC exclusions plus static-file signaling.
 */
declare function resolvePublicFileRoute(options: ResolvePublicFileRouteOptions): Response | null;
declare function normalizeTrailingSlashPathname(pathname: string, trailingSlash: boolean): string | null;
/**
 * Check if the pathname needs a trailing slash redirect, and return the
 * redirect Response if so.
 *
 * Follows Next.js behavior:
 * - `/api` routes are never redirected
 * - The root path `/` is never redirected
 * - If `trailingSlash` is true, redirect `/about` → `/about/`
 * - If `trailingSlash` is true, redirect file-looking `/file.ext/` → `/file.ext`
 * - If `trailingSlash` is true, do not redirect `/.well-known/*`
 * - If `trailingSlash` is false (default), redirect `/about/` → `/about`
 *
 * @param pathname - The basePath-stripped pathname
 * @param basePath - The basePath to prepend to the redirect Location
 * @param trailingSlash - Whether trailing slashes should be enforced
 * @param search - The query string (including `?`) to preserve in the redirect
 * @returns A 308 redirect Response, or null if no redirect is needed
 */
declare function normalizeTrailingSlash(pathname: string, basePath: string, trailingSlash: boolean, search: string): Response | null;
/**
 * Validate CSRF origin for server action requests.
 *
 * Matches Next.js behavior: compares the Origin header against the Host
 * header. If they don't match, the request is rejected with 403 unless
 * the origin is in the allowedOrigins list.
 *
 * @param request - The incoming Request
 * @param allowedOrigins - Origins from experimental.serverActions.allowedOrigins
 * @returns A 403 Response if origin validation fails, or null to continue
 */
declare function validateCsrfOrigin(request: Request, allowedOrigins?: string[]): Response | null;
/**
 * Reject malformed Flight container reference graphs in server action payloads.
 *
 * `@vitejs/plugin-rsc` vendors its own React Flight decoder. Malicious action
 * payloads can abuse container references (`$Q`, `$W`, `$i`) to trigger very
 * expensive deserialization before the action is even looked up.
 *
 * Legitimate React-encoded container payloads use separate numeric backing
 * fields (e.g. field `1` plus root field `0` containing `"$Q1"`). We reject
 * numeric backing-field graphs that contain missing backing fields or cycles.
 * Regular user form fields are ignored entirely.
 */
declare function validateServerActionPayload(body: string | FormData): Promise<Response | null>;
declare function isOriginAllowed(origin: string, allowed: string[]): boolean;
/**
 * Strip internal `x-middleware-*` headers from a Headers object.
 *
 * Middleware uses `x-middleware-*` headers as internal signals (e.g.
 * `x-middleware-next`, `x-middleware-rewrite`, `x-middleware-request-*`).
 * These must be removed before sending the response to the client.
 *
 * @param headers - The Headers object to modify in place
 */
declare function processMiddlewareHeaders(headers: Headers): void;
/**
 * Strip internal headers from an inbound request so they cannot be forged by
 * an external attacker to influence routing or impersonate internal state.
 *
 * Must be called at every request entry point BEFORE middleware, routing,
 * or any handler logic accesses the request headers.
 *
 * Returns a new Headers object with internal headers removed. The input
 * is never mutated — Request.headers is immutable in Workers/miniflare
 * environments (see applyMiddlewareRequestHeaders in config-matchers.ts
 * for the same cloning pattern).
 *
 * @param headers - The source Headers (never modified)
 * @returns A new Headers with internal framework headers removed
 */
declare function filterInternalHeaders(headers: Headers): Headers;
/**
 * Clone a Request while overriding headers, preserving metadata when possible.
 *
 * Some runtimes (Workers) allow `new Request(request, { headers })` which
 * retains redirect/signal/cf data. Others (Node/undici across realms) can throw
 * when cloning a foreign Request instance. In that case, fall back to building
 * a RequestInit with best-effort metadata.
 */
declare function cloneRequestWithHeaders(request: Request, headers: Headers): Request;
/**
 * Clone a Request while overriding the URL, preserving headers and metadata
 * when possible.
 *
 * Mirrors `cloneRequestWithHeaders`, but rewrites the URL instead of the
 * headers. Workers support `new Request(url, request)` to copy method/headers/
 * body onto a new URL; Node/undici can throw on a foreign Request instance, so
 * we fall back to a manual RequestInit. `new Request()` does not copy the
 * Workers-specific `cf` property and omits `duplex` for streaming bodies, so
 * both are handled explicitly — the same reasons `cloneRequestWithHeaders`
 * exists.
 */
declare function cloneRequestWithUrl(request: Request, url: string): Request;
//#endregion
export { HeaderRecord, INTERNAL_HEADERS, VINEXT_INTERNAL_HEADERS, canonicalizeRequestPathname, canonicalizeRequestUrlPathname, cloneRequestWithHeaders, cloneRequestWithUrl, createStaticFileSignal, filterInternalHeaders, guardProtocolRelativeUrl, hasBasePath, isOpenRedirectShaped, isOriginAllowed, normalizeTrailingSlash, normalizeTrailingSlashPathname, processMiddlewareHeaders, resolvePublicFileRoute, stripBasePath, validateCsrfOrigin, validateServerActionPayload };