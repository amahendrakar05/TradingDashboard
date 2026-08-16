//#region src/utils/client-runtime-metadata.d.ts
type ClientRuntimeMetadata = {
  clientEntryFile?: string;
  appBootstrapPreinitModules?: string[];
  lazyChunks?: string[];
  dynamicPreloads?: Record<string, string[]>;
};
/**
 * Read the client build manifest and compute runtime metadata used by
 * Cloudflare worker entry injection and Node production server startup.
 *
 * - `lazyChunks` — chunks only reachable through dynamic `import()`, excluded
 *   from modulepreload hints.
 * - `dynamicPreloads` — per-module JS/CSS files for rendered `next/dynamic()`
 *   boundaries, injected as preload links during SSR.
 * - `clientEntryFile` — the client entry chunk filename (optional, only
 *   needed for Pages Router).
 *
 * All file paths are normalised with the configured `assetBase` (basePath)
 * and `assetPrefix`.
 */
declare function computeClientRuntimeMetadata(opts: {
  clientDir: string;
  assetBase: string;
  assetPrefix: string;
  includeClientEntry?: boolean | "pages-client-entry";
}): ClientRuntimeMetadata;
//#endregion
export { computeClientRuntimeMetadata };