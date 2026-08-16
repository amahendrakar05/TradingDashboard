import { RootParams } from "../shims/root-params.js";

//#region src/server/app-prerender-static-params.d.ts
type GenerateStaticParamsFunction = (input: {
  params: RootParams;
}) => unknown;
/**
 * Build a prerender `generateStaticParams` resolver for one route pattern.
 *
 * `sources` may mix eager functions (layout `generateStaticParams`, which stay
 * eagerly imported) and lazy `{ load }` page sources (code-split page modules).
 * Lazy sources are imported once on first invocation. The returned resolver:
 *
 *  - returns `null` when, after resolving every source, no `generateStaticParams`
 *    export exists for the pattern — the sentinel the prerender driver uses to
 *    skip the route (or error under `output: export`);
 *  - otherwise composes all sources into the cartesian set of param objects.
 *
 * Returns `null` (no resolver) only when the pattern has zero sources at all.
 */
declare function createAppPrerenderStaticParamsResolver(sources: readonly unknown[], rootParamNames?: readonly string[]): GenerateStaticParamsFunction | null;
type CallAppPrerenderStaticParamsOptions = {
  fn: GenerateStaticParamsFunction;
  params: RootParams;
  pattern: string;
  rootParamNamesByPattern: Record<string, readonly string[] | undefined>;
};
declare function callAppPrerenderStaticParams(options: CallAppPrerenderStaticParamsOptions): Promise<unknown>;
//#endregion
export { callAppPrerenderStaticParams, createAppPrerenderStaticParamsResolver };