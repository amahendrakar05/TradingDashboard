//#region src/shims/url-utils.d.ts
declare function isAbsoluteUrl(url: string): boolean;
declare function isAbsoluteOrProtocolRelativeUrl(url: string): boolean;
declare function getWindowOrigin(): string | null;
/**
 * If `url` is an absolute same-origin URL, return the local path
 * (pathname + search + hash). Returns null for truly external URLs
 * or on the server (where origin is unknown).
 */
declare function toSameOriginPath(url: string): string | null;
/**
 * If `url` is an absolute same-origin URL, return the app-relative path
 * (basePath stripped from the pathname, if configured). Returns null for
 * truly external URLs or on the server.
 */
declare function toSameOriginAppPath(url: string, basePath: string): string | null;
/**
 * Normalise the trailing slash of a local URL according to the
 * `trailingSlash` config option in `next.config.js`. Used by the `<Link>`
 * shim so that rendered `href` attributes match the canonical URL form
 * (which is what the server-side redirect would otherwise enforce).
 *
 * Behaviour matches Next.js's client-side `normalizePathTrailingSlash`:
 * packages/next/src/client/normalize-trailing-slash.ts
 *
 * - Absolute URLs (`http://`, `https://`, `//`) and non-local strings are
 *   returned unchanged.
 * - Paths whose final segment looks like a filename (`...\.ext`) have any
 *   trailing slash stripped even when `trailingSlash: true`, mirroring the
 *   `.well-known`-aware redirect rule shipped in `routes-manifest.json`.
 * - Query strings and hash fragments are preserved verbatim.
 * - Idempotent: already-canonical paths round-trip unchanged.
 */
declare function normalizePathTrailingSlash(path: string, trailingSlash: boolean): string;
/**
 * Prepend basePath to a local path for browser URLs / fetches.
 */
declare function withBasePath(path: string, basePath: string): string;
/**
 * Resolve a potentially relative href against the current URL.
 * Handles: "#hash", "?query", "?query#hash", and relative paths.
 */
declare function resolveRelativeHref(href: string, currentUrl?: string, basePath?: string): string;
/**
 * Convert a local navigation target into the browser URL that should be used
 * for history entries, fetches, and onNavigate callbacks.
 */
declare function toBrowserNavigationHref(href: string, currentUrl?: string, basePath?: string): string;
declare function isHashOnlyBrowserUrlChange(href: string, currentHref: string, basePath?: string): boolean;
//#endregion
export { getWindowOrigin, isAbsoluteOrProtocolRelativeUrl, isAbsoluteUrl, isHashOnlyBrowserUrlChange, normalizePathTrailingSlash, resolveRelativeHref, toBrowserNavigationHref, toSameOriginAppPath, toSameOriginPath, withBasePath };