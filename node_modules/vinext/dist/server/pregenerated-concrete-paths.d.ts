//#region src/server/pregenerated-concrete-paths.d.ts
declare global {
  var __VINEXT_PREGENERATED_CONCRETE_PATHS: unknown;
}
declare function normalizePregeneratedPathname(pathname: string): string;
declare function clearPregeneratedConcretePaths(): void;
declare function addPregeneratedConcretePath(routePattern: string, pathname: string): void;
declare function getRenderedConcreteUrlPathsForRoute(routePattern: string): ReadonlySet<string> | undefined;
/**
 * Populate the registry from `globalThis.__VINEXT_PREGENERATED_CONCRETE_PATHS`.
 * No-op when the global is not set (Node path — seed-cache handles it later).
 * Pathnames are normalised so they match the runtime `cleanPathname`.
 */
declare function initPregeneratedPathsFromGlobals(): void;
//#endregion
export { addPregeneratedConcretePath, clearPregeneratedConcretePaths, getRenderedConcreteUrlPathsForRoute, initPregeneratedPathsFromGlobals, normalizePregeneratedPathname };