//#region src/build/prerender-server-pool.d.ts
/**
 * Whether the forkable worker entry exists as a runnable `.js` sibling. False
 * when vinext runs from source (e.g. the test suite transpiles `.ts` on the
 * fly and a forked plain-node child can't load `.ts`); callers fall back to the
 * single in-process server. True in the published/built package.
 */
declare function prerenderPoolAvailable(): boolean;
type PrerenderServerPool = {
  /** Ports of the forked render servers, for round-robin per-route fetches. */ports: number[];
  /**
   * Throw if any worker exited unexpectedly (i.e. not via `close()`). The
   * caller MUST call this after the render loop: a crashed worker makes every
   * route routed to it fail with a connection error, which the per-route
   * handler records as a (non-fatal) error — without this check the build
   * would emit partial output and still exit 0. Mirrors the single-process
   * design, where a server crash takes the whole build down loudly.
   */
  assertHealthy: () => void;
  /**
   * Record a failed fetch to a render worker. This closes the tiny ordering gap
   * where the request can fail before Node has delivered the child `exit` event.
   */
  recordRenderError: (err: unknown) => void; /** Kill every forked server. Safe to call more than once. */
  close: () => Promise<void>;
};
/**
 * Choose how many render processes to fork for `routeCount` routes.
 *
 * Returns 1 to mean "don't fork — render in-process as before" (small apps,
 * single/dual-core, low memory, or an explicit `--prerender-concurrency 1`).
 * `maxOverride` comes from `--prerender-concurrency`, which caps both the
 * number of in-flight route fetches and the worker count (the default is capped
 * at `min(cores, 8)`).
 */
declare function resolvePrerenderPoolSize(routeCount: number, maxOverride?: number): number;
/**
 * Fork `size` production servers against `outDir` and resolve once all are
 * listening. Each child reports its port over IPC. Rejects (and tears down any
 * already-started children) if any child fails to come up.
 */
declare function startPrerenderServerPool(outDir: string, size: number, entry?: string): Promise<PrerenderServerPool>;
//#endregion
export { PrerenderServerPool, prerenderPoolAvailable, resolvePrerenderPoolSize, startPrerenderServerPool };