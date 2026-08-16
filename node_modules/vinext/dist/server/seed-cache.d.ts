import { CachedAppPageValue } from "../shims/cache-handler.js";

//#region src/server/seed-cache.d.ts
type PrerenderCacheSeedMetadata = {
  expireSeconds?: number;
  revalidateSeconds?: number;
  /**
   * Path-derived implicit tags (`/foo`, `_N_T_/foo`, `_N_T_/foo/page`, ...)
   * required for `revalidatePath()` to invalidate the seeded entry. See #1486.
   */
  tags?: string[];
};
type PrerenderCacheSeedOptions = {
  buildAppPageHtmlKey?: (pathname: string) => string;
  buildAppPageRscKey?: (pathname: string) => string;
  writeAppPageEntry?: (key: string, data: CachedAppPageValue, metadata: PrerenderCacheSeedMetadata) => Promise<void>;
};
/**
 * Read pre-rendered routes from disk and seed the active CacheHandler.
 *
 * Call this during production server startup, before any requests are served.
 * If the manifest doesn't exist (no prerender phase was run), this is a no-op.
 *
 * @param serverDir - Path to `dist/server/` (where vinext-prerender.json lives)
 * @returns The number of routes seeded (0 if no manifest or no renderable routes).
 */
declare function seedMemoryCacheFromPrerender(serverDir: string, options?: PrerenderCacheSeedOptions): Promise<number>;
//#endregion
export { seedMemoryCacheFromPrerender };