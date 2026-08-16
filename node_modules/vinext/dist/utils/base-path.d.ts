//#region src/utils/base-path.d.ts
/**
 * Shared basePath helpers.
 *
 * Next.js only treats a pathname as being under basePath when it is an exact
 * match ("/app") or starts with the basePath followed by a path separator
 * ("/app/..."). Prefix-only matches like "/application" must be left intact.
 */
/**
 * Check whether a pathname is inside the configured basePath.
 */
declare function hasBasePath(pathname: string, basePath: string): boolean;
/**
 * Strip the basePath prefix from a pathname when it matches on a segment
 * boundary. Returns the original pathname when it is outside the basePath.
 */
declare function stripBasePath(pathname: string, basePath: string): string;
/**
 * Add the configured basePath to a pathname unless it is already inside that
 * basePath. Query strings and hashes must be handled by callers before calling
 * this pathname-only helper.
 */
declare function addBasePathToPathname(pathname: string, basePath: string | undefined): string;
/**
 * Remove trailing slashes from a pathname while preserving the root "/".
 * Collapses any number of trailing slashes ("/a//" → "/a"). Used by the
 * trailing-slash redirect path and route pattern normalization.
 */
declare function removeTrailingSlash(pathname: string): string;
//#endregion
export { addBasePathToPathname, hasBasePath, removeTrailingSlash, stripBasePath };