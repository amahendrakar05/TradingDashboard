import { TrieNode } from "./route-trie.js";

//#region src/routing/route-matching.d.ts
type RouteTrieCache<R extends {
  patternParts: string[];
}> = WeakMap<R[], TrieNode<R>>;
declare function createRouteTrieCache<R extends {
  patternParts: string[];
}>(): RouteTrieCache<R>;
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
declare function matchRouteWithTrie<R extends {
  patternParts: string[];
}>(url: string, routes: R[], cache: RouteTrieCache<R>): {
  route: R;
  params: Record<string, string | string[]>;
} | null;
/**
 * Match a filesystem route against the request's raw encoded pathname.
 *
 * Next.js compares static route identity before decoding, so `/%61bout` does
 * not select the filesystem route `/about`. Dynamic captures are still decoded
 * exactly once by `trieMatch`, matching `getRouteMatcher` upstream.
 */
declare function matchRouteWithTrieRawPathname<R extends {
  patternParts: string[];
}>(url: string, routes: R[], cache: RouteTrieCache<R>): {
  route: R;
  params: Record<string, string | string[]>;
} | null;
//#endregion
export { createRouteTrieCache, matchRouteWithTrie, matchRouteWithTrieRawPathname };