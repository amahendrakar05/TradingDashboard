//#region src/server/pages-asset-tags.d.ts
/**
 * Pages Router SSR asset-tag helpers.
 *
 * Builds the `<link rel="modulepreload">`, `<link rel="stylesheet">`, and
 * `<script type="module">` tags injected into the SSR HTML response.
 *
 * Extracted from `entries/pages-server-entry.ts` so the logic is
 * unit-testable and lives in a normal typed module rather than a codegen
 * template string.
 */
/**
 * Resolve the effective SSR manifest: prefer the caller-supplied object and
 * fall back to the registered client build metadata.
 */
declare function resolveSsrManifest(manifest: Record<string, string[]> | null | undefined): Record<string, string[]> | null;
/**
 * Look up the asset-file list for a module ID in the SSR manifest.
 *
 * The manifest keys may use relative paths while callers supply absolute
 * paths, so a suffix-match fallback is used when an exact-key lookup fails.
 */
declare function getManifestFilesForModule(manifest: Record<string, string[]> | null | undefined, moduleId: string | null | undefined): string[] | null;
/**
 * Find the first `.js` file in the manifest for `moduleId` and return the URL it
 * is actually SERVED from. Used to resolve the client-navigation / hydration URL
 * for the matched page or the `_app` module (it is `import()`ed on the client),
 * so it must point at the served location: `assetPrefix` replaces `basePath` for
 * asset URLs. SSR-manifest values are base-anchored; re-anchor under any
 * configured `assetPrefix` (default `""` keeps the legacy `"/" + file`).
 */
declare function resolveClientModuleUrl(manifest: Record<string, string[]> | null | undefined, moduleId: string | null | undefined, basePath?: string, assetPrefix?: string, _deploymentId?: string): string | undefined;
type CollectAssetTagsOptions = {
  /**
   * SSR manifest mapping module file paths to their associated asset list.
   * When empty/null the registered client build manifest is used.
   */
  manifest: Record<string, string[]> | null | undefined;
  /**
   * Module IDs whose assets should be injected (page + `_app`). When empty
   * all manifest assets are injected.
   */
  moduleIds: (string | null | undefined)[]; /** Script nonce for CSP. */
  scriptNonce?: string;
  /**
   * When `false` (default), page scripts are emitted with the `defer`
   * attribute mirroring Next.js's `experimental.disableOptimizedLoading`
   * default.
   */
  disableOptimizedLoading: boolean;
  /**
   * Configured `basePath` / `assetPrefix`. SSR-manifest values are base-anchored
   * (needed for the lazy-chunk membership test), but the EMITTED href must point
   * where the asset is actually served — `assetPrefix` replaces `basePath` for
   * asset URLs. Default `""` (both unset) keeps the legacy `"/" + value` href.
   */
  basePath?: string;
  assetPrefix?: string;
  deploymentId?: string;
};
/**
 * Build the HTML `<link>` and `<script>` tag string for the SSR response.
 *
 * Mirrors Next.js `_document` behaviour:
 * - CSS files → `<link rel="stylesheet">`.
 * - JS files → `<link rel="modulepreload">` + `<script type="module" defer>`.
 * - Lazy chunks (behind `React.lazy` / `next/dynamic`) are skipped.
 * - The registered client-entry bootstrap is injected first.
 * - Shared framework / vinext runtime chunks are always included alongside
 *   page-specific chunks.
 *
 * Extracted from `entries/pages-server-entry.ts`.
 */
declare function collectAssetTags(options: CollectAssetTagsOptions): string;
//#endregion
export { collectAssetTags, getManifestFilesForModule, resolveClientModuleUrl, resolveSsrManifest };