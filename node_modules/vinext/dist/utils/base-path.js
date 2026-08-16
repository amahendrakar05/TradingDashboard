//#region src/utils/base-path.ts
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
function hasBasePath(pathname, basePath) {
	if (!basePath) return false;
	return pathname === basePath || pathname.startsWith(basePath + "/");
}
/**
* Strip the basePath prefix from a pathname when it matches on a segment
* boundary. Returns the original pathname when it is outside the basePath.
*/
function stripBasePath(pathname, basePath) {
	if (!hasBasePath(pathname, basePath)) return pathname;
	return pathname.slice(basePath.length) || "/";
}
/**
* Add the configured basePath to a pathname unless it is already inside that
* basePath. Query strings and hashes must be handled by callers before calling
* this pathname-only helper.
*/
function addBasePathToPathname(pathname, basePath) {
	if (!basePath || hasBasePath(pathname, basePath)) return pathname;
	return pathname === "/" ? basePath : `${basePath}${pathname}`;
}
/**
* Remove trailing slashes from a pathname while preserving the root "/".
* Collapses any number of trailing slashes ("/a//" → "/a"). Used by the
* trailing-slash redirect path and route pattern normalization.
*/
function removeTrailingSlash(pathname) {
	if (pathname === "/") return "/";
	let end = pathname.length;
	while (end > 0 && pathname.charCodeAt(end - 1) === 47) end--;
	return end === 0 ? "/" : pathname.slice(0, end);
}
//#endregion
export { addBasePathToPathname, hasBasePath, removeTrailingSlash, stripBasePath };
