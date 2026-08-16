//#region src/shims/internal/app-prefetch-fetch-queue.d.ts
declare function releaseAppPrefetchFetchSlot(response: Response): void;
/**
 * Low-priority App Router prefetches share a small request queue. The consumer
 * must either snapshot the returned Response with snapshotRscResponse() or call
 * releaseAppPrefetchFetchSlot() when it drops the response without consuming it.
 */
declare function scheduleAppPrefetchFetch(fetcher: () => Promise<Response>, priority: "low" | "high"): Promise<Response>;
//#endregion
export { releaseAppPrefetchFetchSlot, scheduleAppPrefetchFetch };