//#region src/shims/internal/make-hanging-promise.d.ts
/**
 * makeHangingPromise — returns a promise that never resolves during prerendering.
 *
 * When prerendering, `io()` must return a hanging promise to prevent
 * React from executing past the IO boundary. The promise never resolves—it only
 * rejects if the render signal is aborted (e.g., due to a dynamic error or
 * cache-fill completion).
 *
 * Ported from Next.js: packages/next/src/server/dynamic-rendering-utils.ts
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/server/dynamic-rendering-utils.ts
 */
declare function makeHangingPromise<T>(signal: AbortSignal, route: string, expression: string): Promise<T>;
//#endregion
export { makeHangingPromise };