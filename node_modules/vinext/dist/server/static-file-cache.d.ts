//#region src/server/static-file-cache.d.ts
/** Content-type lookup for static assets. Shared with prod-server.ts. */
declare const CONTENT_TYPES: Record<string, string>;
/** A servable file variant with pre-computed response headers. */
type FileVariant = {
  /** Absolute file path (used for streaming large files). */path: string; /** Uncompressed or encoded byte size for buffer-threshold decisions. */
  size: number; /** Pre-computed response headers. */
  headers: Record<string, string>; /** In-memory buffer for small files (below BUFFER_THRESHOLD). */
  buffer?: Buffer;
};
type StaticFileEntry = {
  /** Weak ETag for conditional request matching. */etag: string; /** Pre-computed headers for 304 Not Modified response. */
  notModifiedHeaders: Record<string, string>; /** Original file variant (uncompressed). */
  original: FileVariant; /** Brotli precompressed variant, if .br file exists. */
  br?: FileVariant; /** Gzip precompressed variant, if .gz file exists. */
  gz?: FileVariant; /** Zstandard precompressed variant, if .zst file exists. */
  zst?: FileVariant;
};
/**
 * In-memory cache of static file metadata, populated once at server startup.
 *
 * Usage:
 *   const cache = await StaticFileCache.create(clientDir);
 *   const entry = cache.lookup("/_next/static/app-abc123.js");
 *   // entry.br?.headers, entry.original.headers, etc.
 */
declare class StaticFileCache {
  private readonly entries;
  private constructor();
  /**
   * Scan the client directory and build the cache.
   *
   * Gracefully handles non-existent directories (returns an empty cache).
   */
  static create(clientDir: string): Promise<StaticFileCache>;
  /**
   * Look up cached metadata for a URL pathname.
   *
   * Returns undefined if the file is not in the cache. The root path "/"
   * always returns undefined — index.html is served by SSR/RSC.
   */
  lookup(pathname: string): StaticFileEntry | undefined;
}
/**
 * Extract a stable weak ETag from a Vite hashed filename (e.g. `app-DqZc3R4n.js`).
 * The hash is a content hash computed by the bundler — deterministic across
 * identical builds regardless of filesystem timestamps.
 *
 * Must be a weak validator (W/) because the same tag is shared across
 * content-encoded variants (original, .br, .gz, .zst) which are byte-different.
 * Returns null if the filename doesn't contain a recognizable hash suffix,
 * so the caller can fall back to mtime-based ETags.
 */
declare function etagFromFilenameHash(relativePath: string, ext: string): string | null;
//#endregion
export { CONTENT_TYPES, StaticFileCache, etagFromFilenameHash };