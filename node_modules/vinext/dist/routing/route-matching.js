import { normalizePathnameForRouteMatch } from "./utils.js";
import { buildRouteTrie, trieMatch } from "./route-trie.js";
//#region src/routing/route-matching.ts
/**
* Shared route-match preamble used by both Pages Router and App Router.
*
* Both routers normalize URLs and call `trieMatch` with nearly-identical
* preamble: strip query, trailing-slash normalize, run
* `normalizePathnameForRouteMatch`, split into url parts, then look up via a
* per-routes-array trie cache. This module factors that out so each router
* just calls `matchRouteWithTrie(url, routes)`.
*/
function createRouteTrieCache() {
	return /* @__PURE__ */ new WeakMap();
}
function getOrBuildTrie(cache, routes) {
	let trie = cache.get(routes);
	if (!trie) {
		trie = buildRouteTrie(routes);
		cache.set(routes, trie);
	}
	return trie;
}
/**
* Match a URL path against a list of routes via the shared preamble:
*   1. strip query string
*   2. trailing-slash normalize (preserving root "/")
*   3. run `normalizePathnameForRouteMatch`
*   4. split into url parts and look up via the (cached) trie
*
* Generic over the route shape; both Pages `Route` and App `AppRoute`
* satisfy `{ patternParts: string[] }`.
*/
function matchRouteWithTrie(url, routes, cache) {
	const pathname = url.split("?")[0];
	let normalizedUrl = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
	normalizedUrl = normalizePathnameForRouteMatch(normalizedUrl);
	const urlParts = normalizedUrl.split("/").filter(Boolean);
	return trieMatch(getOrBuildTrie(cache, routes), urlParts);
}
/**
* Match a filesystem route against the request's raw encoded pathname.
*
* Next.js compares static route identity before decoding, so `/%61bout` does
* not select the filesystem route `/about`. Dynamic captures are still decoded
* exactly once by `trieMatch`, matching `getRouteMatcher` upstream.
*/
function matchRouteWithTrieRawPathname(url, routes, cache) {
	const pathname = url.split("?")[0];
	const urlParts = (pathname === "/" ? "/" : pathname.replace(/\/$/, "")).split("/").filter(Boolean);
	return trieMatch(getOrBuildTrie(cache, routes), urlParts);
}
//#endregion
export { createRouteTrieCache, matchRouteWithTrie, matchRouteWithTrieRawPathname };
