import { HasCondition, NextHeader, NextI18nConfig, NextRedirect, NextRewrite } from "./next-config.js";
import { RequestContext, normalizeHost, parseCookies, requestContextFromRequest } from "./request-context.js";
import { isExternalUrl } from "../utils/external-url.js";

//#region src/config/config-matchers.d.ts
/**
 * Detect regex patterns vulnerable to catastrophic backtracking (ReDoS).
 *
 * Uses the same deterministic structural analysis as middleware matcher
 * validation. Nested bounded repetition is accepted only when its repeated
 * language has fixed width and unambiguous branches; a fixed outer count can
 * otherwise still cause polynomially catastrophic backtracking on long near
 * misses.
 *
 * Returns true if the pattern appears safe, false if it's potentially dangerous.
 */
declare function isSafeRegex(pattern: string, flags?: string): boolean;
/**
 * Compile a regex pattern safely. Returns the compiled RegExp or null if the
 * pattern is invalid or vulnerable to ReDoS.
 *
 * Logs a warning when a pattern is rejected so developers can fix their config.
 */
declare function safeRegExp(pattern: string, flags?: string): RegExp | null;
/**
 * Convert a Next.js header/rewrite/redirect source pattern into a regex string.
 *
 * Regex groups in the source (e.g. `(\d+)`) are extracted first, the remaining
 * text is escaped/converted in a **single pass** (avoiding chained `.replace()`
 * which CodeQL flags as incomplete sanitization), then groups are restored.
 */
declare function escapeHeaderSource(source: string): string;
/**
 * basePath gating state passed alongside the pathname to every matcher.
 *
 * Rewrites/redirects/headers run with default `basePath: true` semantics in
 * Next.js: the rule only matches when the inbound request was under the
 * configured `basePath`. Rules with `basePath: false` opt out and match
 * the original (un-stripped) pathname regardless of prefix.
 *
 * When `basePath` is empty (not configured) every rule is treated as
 * basePath-defaulted: every request matches.
 *
 * @see .nextjs-ref/packages/next/src/lib/load-custom-routes.ts:198-220
 */
type BasePathMatchState = {
  /** Configured `basePath` (without trailing slash) or "" when unset. */basePath: string;
  /**
   * True when the inbound request was originally under `basePath` (i.e.
   * the prod-server/handler stripped the prefix before the matcher runs).
   * Ignored when `basePath` is empty.
   */
  hadBasePath: boolean;
};
/**
 * Unpack `x-middleware-request-*` headers from the collected middleware
 * response headers into the actual request, and strip all `x-middleware-*`
 * internal signals so they never reach clients.
 *
 * `middlewareHeaders` is mutated in-place (matching keys are deleted).
 * Returns a (possibly cloned) `Request` with the unpacked headers applied,
 * and a fresh `RequestContext` built from it — ready for post-middleware
 * config rule matching (beforeFiles, afterFiles, fallback).
 *
 * Works for both Node.js requests (mutable headers) and Workers requests
 * (immutable — cloned only when there are headers to apply).
 *
 * `x-middleware-request-*` values are always plain strings (they carry
 * individual header values), so the wider `string | string[]` type of
 * `middlewareHeaders` is safe to cast here.
 */
declare function applyMiddlewareRequestHeaders(middlewareHeaders: Record<string, string | string[]>, request: Request, options?: {
  preserveCredentialHeaders?: boolean;
}): {
  request: Request;
  postMwReqCtx: RequestContext;
};
declare function checkHasConditions(has: HasCondition[] | undefined, missing: HasCondition[] | undefined, ctx: RequestContext): boolean;
declare function matchConfigPattern(pathname: string, pattern: string): Record<string, string> | null;
/**
 * Apply redirect rules from next.config.js.
 * Returns the redirect info if a redirect was matched, or null.
 *
 * `ctx` provides the request context (cookies, headers, query, host) used
 * to evaluate has/missing conditions. Next.js always has request context
 * when evaluating redirects, so this parameter is required.
 *
 * ## Performance
 *
 * Rules with a locale-capture-group prefix (the dominant pattern in large
 * Next.js apps — e.g. `/:locale(en|es|fr|...)?/some-path`) are handled via
 * a pre-built index. Instead of running exec() on each locale regex
 * individually, we:
 *
 *   1. Strip the optional locale prefix from the pathname with one cheap
 *      string-slice check (no regex exec on the hot path).
 *   2. Look up the stripped suffix in a Map<suffix, entry[]>.
 *   3. For each matching entry, validate the captured locale string against
 *      a small, anchored alternation regex.
 *
 * This reduces the per-request cost from O(n × regex) to O(1) map lookup +
 * O(matches × tiny-regex), eliminating the ~2992ms self-time reported in
 * profiles for apps with 63+ locale-prefixed rules.
 *
 * Rules that don't fit the locale-static pattern fall back to the original
 * linear matchConfigPattern scan.
 *
 * ## Ordering invariant
 *
 * First match wins, preserving the original redirect array order. When a
 * locale-static fast-path match is found at position N, all linear rules with
 * an original index < N are checked via matchConfigPattern first — they are
 * few in practice (typically zero) so this is not a hot-path concern.
 */
declare function matchRedirect(pathname: string, redirects: NextRedirect[], ctx: RequestContext, basePathState?: BasePathMatchState): {
  destination: string;
  permanent: boolean;
} | null;
/**
 * Apply rewrite rules from next.config.js.
 * Returns the rewritten URL or null if no rewrite matched.
 *
 * `ctx` provides the request context (cookies, headers, query, host) used
 * to evaluate has/missing conditions. Next.js always has request context
 * when evaluating rewrites, so this parameter is required.
 */
declare function matchRewrite(pathname: string, rewrites: NextRewrite[], ctx: RequestContext, basePathState?: BasePathMatchState, paramsPathname?: string): string | null;
/**
 * Check whether a rewrite source can match a pathname without evaluating its
 * request-dependent `has` / `missing` conditions.
 *
 * Dev uses this only as a conservative preflight before middleware runs. The
 * conditions may become true after middleware overrides request headers, so
 * evaluating them against the original request would incorrectly skip the
 * Pages request pipeline for file-looking paths.
 */
declare function matchesRewriteSource(pathname: string, rewrite: NextRewrite, basePathState?: BasePathMatchState): boolean;
/**
 * Sanitize a redirect/rewrite destination to collapse protocol-relative URLs.
 *
 * After parameter substitution, a destination like `/:path*` can become
 * `//evil.com` if the catch-all captured a decoded `%2F` (`/evil.com`).
 * Browsers interpret `//evil.com` as a protocol-relative URL, redirecting
 * users off-site.
 *
 * This function collapses any leading double (or more) slashes to a single
 * slash for non-external (relative) destinations.
 */
declare function sanitizeDestination(dest: string): string;
/**
 * Check if a URL is external (absolute URL or protocol-relative).
 * Detects any URL scheme (http:, https:, data:, javascript:, blob:, etc.)
 * per RFC 3986, plus protocol-relative URLs (//).
 */
/**
 * Merge the original request's query params into a config-redirect
 * destination, preserving them on the resulting `Location`.
 *
 * Next.js carries the original request query across config redirects
 * (`prepareDestination({ query: parsedUrl.query })` →
 * `stringifyQuery(...)` in resolve-routes.ts). This matters for App Router
 * RSC client navigations: the cache-busting `_rsc` query must survive the
 * redirect so the browser's auto-followed request to the destination is
 * still treated as an RSC fetch. Dropping it breaks RSC fetch semantics
 * (issue #1529).
 *
 * Destination query params win — a request param is only carried over when
 * the destination does not already specify that key. Mirrors the merge
 * semantics in `proxyExternalRequest`. External destinations are returned
 * untouched (a config redirect to another origin should not leak the
 * original request's query).
 */
declare function preserveRedirectDestinationQuery(destination: string, requestSearch: string): string;
/**
 * Proxy an incoming request to an external URL and return the upstream response.
 *
 * Used for external rewrites (e.g. `/ph/:path*` → `https://us.i.posthog.com/:path*`).
 * Next.js handles these as server-side reverse proxies, forwarding the request
 * method, headers, and body to the external destination.
 *
 * Works in all runtimes (Node.js, Cloudflare Workers) via the standard fetch() API.
 */
declare function proxyExternalRequest(request: Request, externalUrl: string): Promise<Response>;
/**
 * Apply custom header rules from next.config.js.
 * Returns an array of { key, value } pairs to set on the response.
 *
 * `ctx` provides the request context (cookies, headers, query, host) used
 * to evaluate has/missing conditions. Next.js always has request context
 * when evaluating headers, so this parameter is required.
 */
declare function matchHeaders(pathname: string, headers: NextHeader[], ctx: RequestContext, basePathState?: BasePathMatchState): Array<{
  key: string;
  value: string;
}>;
/**
 * Apply Next.js i18n locale-prefix transformation to a set of redirect,
 * rewrite, or header rules. Mirrors the relevant slice of Next.js's `processRoutes`
 * (load-custom-routes.ts) with one deliberate divergence noted below.
 *
 * For each rule:
 *   - If `locale === false` or no i18n is configured, the rule is emitted
 *     untouched. This is the core of issue #1336 item 1: with `locale: false`
 *     the user-supplied source is matched against the raw locale-prefixed
 *     URL so a `:locale` segment in the source captures the prefix itself.
 *   - Otherwise an internal locale-capture variant is produced whose source
 *     starts with `/:nextInternalLocale(en|sv|nl)` so that locale-prefixed
 *     URLs match. For redirects only, a second variant prefixed with
 *     `/${defaultLocale}` is also emitted, matching Next.js exactly.
 *   - **Vinext divergence**: we ALSO retain the original (unprefixed) source
 *     so that requests for the default locale that arrive without a prefix
 *     still match. Next.js solves this upstream by path-normalising every
 *     incoming default-locale request to include the prefix
 *     (`resolve-routes.ts` lines ~251-263); vinext currently does that
 *     normalisation only inside the pages-server-entry route matcher, so
 *     the rewrite/redirect matcher would otherwise miss unprefixed paths.
 *     Keeping the unprefixed variant gives functionally identical behaviour
 *     without requiring a server-wide path normalisation pass. The original
 *     source is appended LAST so the locale-aware variants win when both
 *     forms could match.
 *
 * Destinations that are local (start with `/`) are similarly rewritten with
 * `/:nextInternalLocale` for the locale-capture variant so the locale
 * survives the rewrite/redirect target.
 *
 * Mirrors the Next.js reference in
 * packages/next/src/lib/load-custom-routes.ts — see `processRoutes`.
 */
declare function applyLocaleToRoutes<T extends NextRedirect | NextRewrite | NextHeader>(routes: T[], i18n: NextI18nConfig | null | undefined, type: "redirect" | "rewrite" | "header", options?: {
  trailingSlash?: boolean;
}): T[];
//#endregion
export { BasePathMatchState, type RequestContext, applyLocaleToRoutes, applyMiddlewareRequestHeaders, checkHasConditions, escapeHeaderSource, isExternalUrl, isSafeRegex, matchConfigPattern, matchHeaders, matchRedirect, matchRewrite, matchesRewriteSource, normalizeHost, parseCookies, preserveRedirectDestinationQuery, proxyExternalRequest, requestContextFromRequest, safeRegExp, sanitizeDestination };