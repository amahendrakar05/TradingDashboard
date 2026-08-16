//#region src/build/precompress.d.ts
type PrecompressResult = {
  filesCompressed: number;
  totalOriginalBytes: number; /** Sum of brotli-compressed sizes (used for compression ratio reporting). */
  totalBrotliBytes: number;
};
/**
 * Precompress all compressible hashed assets under `clientDir/<assetsDir>/`.
 *
 * Writes `.br`, `.gz`, and `.zst` files alongside each original.
 * Safe to re-run — overwrites existing compressed variants with identical
 * output, and never compresses `.br`, `.gz`, or `.zst` files themselves.
 *
 * `assetsDir` defaults to `"_next/static"` (Next.js's canonical convention,
 * matching `resolveAssetsDir("")`). When `assetPrefix` is configured as a
 * path prefix the build writes assets to a different directory (e.g.
 * `"cdn/_next/static"`); callers should resolve that with
 * `resolveAssetsDir(assetPrefix)` and thread it through. Without this,
 * `assetPrefix` builds would walk an empty `_next/static/` directory and
 * emit zero compressed variants.
 */
declare function precompressAssets(clientDir: string, options?: {
  /** Subdirectory under `clientDir` containing hashed assets. Defaults to `"_next/static"`. */assetsDir?: string;
  onProgress?: (completed: number, total: number, file: string) => void;
}): Promise<PrecompressResult>;
//#endregion
export { precompressAssets };