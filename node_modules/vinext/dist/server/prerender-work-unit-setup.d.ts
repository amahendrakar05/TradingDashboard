//#region src/server/prerender-work-unit-setup.d.ts
declare function runWithPrerenderWorkUnit<T>(fn: () => Promise<T>, options?: {
  route?: string | (() => string);
}): Promise<T>;
//#endregion
export { runWithPrerenderWorkUnit };