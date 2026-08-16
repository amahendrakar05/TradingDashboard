import { Plugin } from "vite";

//#region src/plugins/middleware-server-only.d.ts
/**
 * Allow `import 'server-only'` from neutral server targets (and any module
 * reachable from them) in the SSR environment.
 *
 * Background: middleware runs server-side, so importing `server-only` is
 * semantically correct. However, vinext bundles middleware into the SSR
 * environment (via `virtual:vinext-server-entry`), and @vitejs/plugin-rsc's
 * `rsc:validate-imports` plugin treats any non-RSC environment as a "client"
 * build, rejecting `server-only` imports with:
 *
 *   'server-only' cannot be imported in client build ('ssr' environment)
 *
 * Next.js solves this with webpack `issuerLayer` rules: middleware,
 * instrumentation, and Pages API routes sit in server-only or neutral layers
 * where `server-only` is aliased to a no-op while `client-only` still errors. See
 *   packages/next/src/build/webpack-config.ts ("Alias server-only and
 *   client-only to proper exports based on bundling layers")
 *
 * Vite has no per-layer aliasing within a single environment, so we mirror
 * the behavior with import-chain taint tracking:
 *
 *   1. Seed a `tainted` set with the middleware entry path (and its
 *      canonical realpath), and recognize other neutral server entry modules
 *      such as Pages API routes through `isNeutralServerModule`.
 *   2. For every resolveId call from a tainted importer, resolve the import
 *      via `this.resolve(..., { skipSelf: true })` and add the resolved id
 *      to the tainted set. This propagates the taint along the import graph
 *      synchronously, before plugin-rsc's `order: "pre"` validate-imports
 *      handler sees the next `server-only` request.
 *   3. When a tainted module imports `server-only` in a non-RSC environment,
 *      short-circuit to the no-op shim path so plugin-rsc's filter (which
 *      matches the bare `^server-only$` specifier) never fires for that
 *      import.
 *
 * The taint set is scoped to the middleware chain only — `server-only`
 * imports from anywhere else (including client component code traversing
 * through the SSR environment for `react-dom/server.edge` rendering) still
 * hit the rsc:validate-imports rejection, preserving the original safety
 * net for accidental client-side `server-only` leakage.
 *
 * Ported from Next.js handling of `WEBPACK_LAYERS.middleware` /
 * `WEBPACK_LAYERS.GROUP.neutralTarget`:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack-config.ts
 */
declare function createMiddlewareServerOnlyPlugin(options: {
  getMiddlewarePath: () => string | null;
  getCanonicalMiddlewarePath: () => string | null;
  isNeutralServerModule?: (id: string) => boolean;
  serverOnlyShimPath: string;
}): Plugin;
//#endregion
export { createMiddlewareServerOnlyPlugin };