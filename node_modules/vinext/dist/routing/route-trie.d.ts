//#region src/routing/route-trie.d.ts
/**
 * Trie (prefix tree) for O(depth) route matching.
 *
 * Replaces the O(n) linear scan over pre-sorted routes with a trie-based
 * lookup. Priority is enforced by traversal order at each node:
 *   1. Static child (exact segment match) — highest priority
 *   2. Dynamic child (single-segment param) — medium
 *   3. Catch-all (1+ remaining segments) — low
 *   4. Optional catch-all (0+ remaining segments) — lowest
 *
 * Backtracking via recursive DFS ensures that dead-end static/dynamic
 * branches fall through to catch-all alternatives.
 */
type TrieNode<R> = {
  staticChildren: Map<string, TrieNode<R>>;
  dynamicChild: {
    paramName: string;
    node: TrieNode<R>;
  } | null;
  catchAllChild: {
    paramName: string;
    route: R;
  } | null;
  optionalCatchAllChild: {
    paramName: string;
    route: R;
  } | null;
  route: R | null;
};
/**
 * Build a trie from pre-sorted routes.
 *
 * Routes must have a `patternParts` property (string[] of URL segments).
 * Pattern segment conventions:
 *   - `:name`  — dynamic segment
 *   - `:name+` — catch-all (1+ segments)
 *   - `:name*` — optional catch-all (0+ segments)
 *   - anything else — static segment
 *
 * First route to claim a terminal position wins (routes are pre-sorted
 * by precedence, so insertion order preserves correct priority).
 */
declare function buildRouteTrie<R extends {
  patternParts: string[];
}>(routes: R[]): TrieNode<R>;
/**
 * Match a URL against the trie.
 *
 * Returns decoded param values — `decodeURIComponent` is applied to
 * individual param entries so that `%2F` → `/`, `%23` → `#`, etc.
 * Segment boundaries (the original `/` splits) are preserved by the
 * upstream normalization layer; this step only decodes the captured
 * param strings the caller sees.
 *
 * Mirrors Next.js route-matcher.ts:25-27.
 *
 * @param root - Trie root built by `buildRouteTrie`
 * @param urlParts - Pre-split URL segments (no empty strings)
 * @returns Match result with route and extracted params, or null
 */
declare function trieMatch<R>(root: TrieNode<R>, urlParts: string[]): {
  route: R;
  params: Record<string, string | string[]>;
} | null;
declare function trieMatchRaw<R>(root: TrieNode<R>, urlParts: string[]): {
  route: R;
  params: Record<string, string | string[]>;
} | null;
//#endregion
export { TrieNode, buildRouteTrie, trieMatch, trieMatchRaw };