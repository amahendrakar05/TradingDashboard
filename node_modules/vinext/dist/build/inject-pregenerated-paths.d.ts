//#region src/build/inject-pregenerated-paths.d.ts
declare global {
  var __VINEXT_PREGENERATED_CONCRETE_PATHS: unknown;
}
declare function injectPregeneratedConcretePaths(root: string): void;
//#endregion
export { injectPregeneratedConcretePaths };