//#region src/shims/readonly-url-search-params.d.ts
/**
 * Read-only URLSearchParams wrapper matching Next.js runtime behavior.
 * Mutation methods remain present for instanceof/API compatibility but throw.
 */
declare class ReadonlyURLSearchParams extends URLSearchParams {
  append(): never;
  delete(): never;
  set(): never;
  sort(): never;
}
//#endregion
export { ReadonlyURLSearchParams };