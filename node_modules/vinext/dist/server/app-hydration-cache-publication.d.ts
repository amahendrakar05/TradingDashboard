//#region src/server/app-hydration-cache-publication.d.ts
type HydrationCachePublication = {
  commit(): void;
  complete(): void;
  fail(): void;
  invalidate(): void;
  publish(publishCandidate: () => () => void): void;
};
declare function createHydrationCachePublication(): HydrationCachePublication;
//#endregion
export { HydrationCachePublication, createHydrationCachePublication };