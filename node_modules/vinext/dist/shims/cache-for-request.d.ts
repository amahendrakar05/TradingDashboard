//#region src/shims/cache-for-request.d.ts
/**
 * Cache a factory function's result for the duration of a request.
 *
 * Returns a function that lazily invokes the factory on first call within
 * a request, then returns the cached result for all subsequent calls in
 * the same request. Each new request gets a fresh invocation.
 *
 * The factory function's identity (reference) is the cache key — no
 * string keys, no collision risk between modules.
 *
 * Async factories are supported: the returned Promise is cached, so
 * concurrent `await` calls within the same request share one invocation.
 * If the Promise rejects, the cached entry is cleared so the next call
 * can retry.
 *
 * Outside a request scope (tests, build-time), the factory runs every
 * time with no caching — safe and predictable.
 *
 * @example
 * ```ts
 * import { cacheForRequest } from "vinext/cache";
 *
 * const getPrisma = cacheForRequest(() => {
 *   const pool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
 *   return new PrismaClient({ adapter: new PrismaPg(pool) });
 * });
 *
 * // In a route handler or server component:
 * const prisma = getPrisma(); // first call creates, subsequent calls reuse
 * ```
 *
 * @example
 * ```ts
 * // Async factory — Promise is cached, not re-invoked.
 * // If it rejects, the cache is cleared for retry.
 * const getDb = cacheForRequest(async () => {
 *   const pool = new Pool({ connectionString });
 *   await pool.connect();
 *   return drizzle(pool);
 * });
 *
 * const db = await getDb();
 * ```
 *
 * @module
 */
/**
 * Create a request-scoped cached version of a factory function.
 *
 * @param factory - Function that creates the value. Called once per request for sync
 *   factories. Async factories that reject have their cache cleared, allowing retry.
 * @returns A function with the same return type that caches the result per request.
 */
declare function cacheForRequest<T>(factory: () => T): () => T;
//#endregion
export { cacheForRequest };