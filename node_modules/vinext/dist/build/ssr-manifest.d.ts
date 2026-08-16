//#region src/build/ssr-manifest.d.ts
type BundleBackfillChunk = {
  type: "chunk";
  fileName: string;
  imports?: string[];
  modules?: Record<string, unknown>;
  viteMetadata?: {
    importedCss?: Set<string>;
    importedAssets?: Set<string>;
  };
};
/**
 * Realpath with NATIVE separators (backslashes on Windows). Callers apply
 * `toSlash` where the result becomes a module id / manifest key.
 */
declare function tryRealpathSync(candidate: string): string | null;
declare function relativeWithinRoot(root: string, moduleId: string): string | null;
declare function augmentSsrManifestFromBundle(ssrManifest: Record<string, string[]>, bundle: Record<string, BundleBackfillChunk | {
  type: string;
}>, root: string, base?: string): Record<string, string[]>;
//#endregion
export { BundleBackfillChunk, augmentSsrManifestFromBundle, relativeWithinRoot, tryRealpathSync };