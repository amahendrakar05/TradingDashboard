import { Plugin } from "vite";

//#region src/plugins/og-assets.d.ts
/**
 * Create the `vinext:og-inline-fetch-assets` Vite plugin.
 *
 * Inlines binary assets that are runtime-fetched via
 * `fetch(new URL("./asset", import.meta.url))` or read via
 * `readFileSync(fileURLToPath(new URL("./asset", import.meta.url)))`.
 * Both patterns are rewritten to inline base64 literals so the code works
 * correctly inside Cloudflare Workers where `import.meta.url` is not a
 * valid file URL.
 */
declare function createOgInlineFetchAssetsPlugin(): Plugin;
/**
 * Copy a single root copy of each requested WASM asset from `sourceDir` into
 * `outDir`, skipping any asset whose source is missing or whose destination
 * already exists.
 *
 * Extracted as a pure, dependency-injected helper so it can be unit-tested
 * against a temp source directory without depending on the real @vercel/og
 * install (whose `yoga.wasm` is only materialized as a side effect of the
 * `vinext:og-font-patch` transform during a build).
 */
declare function copyMissingOgWasm(opts: {
  outDir: string;
  sourceDir: string;
  assets: readonly string[];
}): void;
/**
 * Create the `vinext:og-assets` Vite plugin.
 *
 * Ensures each @vercel/og WASM module (resvg.wasm, yoga.wasm) ships exactly once
 * in the RSC output, with every loader strategy resolving to that single file:
 *
 *   1. `generateBundle` (post): if the bundler already emitted the WASM as a
 *      hashed asset (from the `import("./x.wasm?module")` path), rewrite the
 *      Node.js fallback reference `new URL("./x.wasm", import.meta.url)` in each
 *      chunk to point at that emitted asset (a sibling under `_next/static/`).
 *      This deduplicates without copying a second root file.
 *   2. `writeBundle` (post): for any referenced WASM that was NOT emitted as an
 *      asset (e.g. a build that inlined or skipped it), copy a single root copy
 *      from @vercel/og's dist so the Node.js disk-read fallback still works.
 *
 * The decision keys off "did the bundler emit this asset?", never the deploy
 * target — so it helps Node/self-hosted builds as well as Cloudflare Workers.
 */
declare function createOgAssetsPlugin(): Plugin;
//#endregion
export { copyMissingOgWasm, createOgAssetsPlugin, createOgInlineFetchAssetsPlugin };