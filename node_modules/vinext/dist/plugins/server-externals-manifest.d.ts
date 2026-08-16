import { Plugin } from "vite";

//#region src/plugins/server-externals-manifest.d.ts
/**
 * vinext:server-externals-manifest
 *
 * A `writeBundle` plugin that collects the packages left external by the
 * SSR/RSC bundler and writes them to `<outDir>/vinext-externals.json`.
 *
 * With `noExternal: true`, Vite bundles almost everything — only packages
 * explicitly listed in `ssr.external` / `resolve.external` remain as live
 * imports in the server bundle. Those packages are exactly what a standalone
 * deployment needs in `node_modules/`.
 *
 * Using the bundler's own import graph (`chunk.imports` + `chunk.dynamicImports`)
 * is authoritative: no text parsing, no regex, no guessing.
 *
 * The written JSON is an array of package-name strings, e.g.:
 *   ["react", "react-dom", "react-dom/server"]
 *
 * `emitStandaloneOutput` reads this file and uses it as the seed list for the
 * BFS `node_modules/` copy, replacing the old regex-scan approach.
 */
declare function createServerExternalsManifestPlugin(): Plugin;
//#endregion
export { createServerExternalsManifestPlugin };