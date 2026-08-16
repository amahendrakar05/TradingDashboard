//#region src/shims/ppr-fallback-shell.d.ts
type PprFallbackShellState = {
  abortController: AbortController;
  reactAbortController: AbortController;
  cacheEpoch: number;
  cacheReadyResolvers: Array<() => void>;
  fallbackParamNames: ReadonlySet<string>;
  hasDynamicBoundary: boolean;
  isFinalRenderStarted: boolean;
  isAbortScheduled: boolean;
  pendingAbortCleanup: (() => void) | null;
  pendingCacheReadyCleanup: (() => void) | null;
  pendingCacheTasks: number;
  phase: "warmup" | "final";
  routePattern: string;
};
type CreatePprFallbackShellStateOptions = {
  fallbackParamNames: readonly string[];
  routePattern: string;
};
declare function createPprFallbackShellState(options: CreatePprFallbackShellStateOptions): PprFallbackShellState;
declare function runWithPprFallbackShellState<T>(state: PprFallbackShellState, fn: () => T): T;
declare function getPprFallbackShellState(): PprFallbackShellState | null;
declare function trackPprFallbackShellCacheTask<T>(fn: () => Promise<T>, cacheVariant: string): Promise<T>;
declare function createPprFallbackShellSuspensePromiseForState<T>(state: PprFallbackShellState, expression: string): Promise<T>;
declare function markPprFallbackShellDynamicBoundary(): void;
declare function createPprFallbackShellSuspensePromise<T>(expression: string): Promise<T> | null;
declare function waitForPprFallbackShellCacheReady(state: PprFallbackShellState): Promise<void>;
declare function preparePprFallbackShellFinalRender(state: PprFallbackShellState): void;
declare function beginPprFallbackShellFinalRender(state: PprFallbackShellState): void;
declare function isPprFallbackShellAbortError(error: unknown): boolean;
//#endregion
export { PprFallbackShellState, beginPprFallbackShellFinalRender, createPprFallbackShellState, createPprFallbackShellSuspensePromise, createPprFallbackShellSuspensePromiseForState, getPprFallbackShellState, isPprFallbackShellAbortError, markPprFallbackShellDynamicBoundary, preparePprFallbackShellFinalRender, runWithPprFallbackShellState, trackPprFallbackShellCacheTask, waitForPprFallbackShellCacheReady };