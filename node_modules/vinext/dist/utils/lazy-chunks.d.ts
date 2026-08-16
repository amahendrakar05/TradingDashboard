//#region src/utils/lazy-chunks.d.ts
/**
 * Build-manifest chunk metadata used to compute lazy chunks.
 */
type BuildManifestChunk = {
  file: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
  assets?: string[];
};
/**
 * Compute the set of chunk filenames that are ONLY reachable through dynamic
 * imports (i.e. behind React.lazy(), next/dynamic, or manual import()).
 *
 * These chunks should NOT be modulepreloaded in the HTML — they will be
 * fetched on demand when the dynamic import executes.
 *
 * Algorithm: Starting from all entry chunks in the build manifest, walk the
 * static `imports` tree (breadth-first). Any chunk file NOT reached by this
 * walk is only reachable through `dynamicImports` and is therefore "lazy".
 *
 * @param buildManifest - Vite's build manifest (manifest.json), which is a
 *   Record<string, ManifestChunk> where each chunk has `file`, `imports`,
 *   `dynamicImports`, `isEntry`, and `isDynamicEntry` fields.
 * @returns Array of chunk filenames (e.g. "_next/static/mermaid-NOHMQCX5.js") that
 *   should be excluded from modulepreload hints.
 */
declare function computeLazyChunks(buildManifest: Record<string, BuildManifestChunk>): string[];
/**
 * Compute the production preload files for each module referenced by a
 * `next/dynamic()` boundary.
 *
 * Next.js records module IDs during compilation, then resolves those IDs
 * against its react-loadable manifest at render time. Vinext's equivalent
 * source of truth is Vite's build manifest: each chunk lists the modules it
 * reaches through `dynamicImports`, and each dynamic entry lists the JS/CSS
 * files required to evaluate it.
 *
 * Note on shared chunks: a boundary's static-import tree (`collectStaticChunkFiles`)
 * can include chunks that the page entry ALSO loads eagerly (a shared vendor
 * chunk imported by both). Those files are intentionally NOT subtracted here, so
 * a rendered boundary may emit a `<link rel="preload">` / `<link rel="stylesheet">`
 * for a chunk the page already `<link rel="modulepreload">`s. This is harmless —
 * the browser dedupes preloads by URL, `ReactDOM.preload()` dedupes script hints,
 * and React's stylesheet resource model dedupes by href + precedence — and it
 * mirrors Next.js listing a module's full file set in its react-loadable
 * manifest. Subtracting the eager set would couple this to the entry's import
 * closure for no correctness gain.
 *
 * @returns A map keyed by root-relative module ID, with JS/CSS files that
 * should be preloaded when that dynamic boundary is rendered.
 */
declare function computeDynamicImportPreloads(buildManifest: Record<string, BuildManifestChunk>): Record<string, string[]>;
declare function dynamicImportPreloadsWithBase(preloads: Record<string, string[]>, applyBase: (file: string) => string): Record<string, string[]>;
//#endregion
export { BuildManifestChunk, computeDynamicImportPreloads, computeLazyChunks, dynamicImportPreloadsWithBase };