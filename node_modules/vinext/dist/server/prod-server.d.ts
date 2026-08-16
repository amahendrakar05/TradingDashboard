import { negotiateEncoding } from "./accept-encoding.js";
import { StaticFileCache } from "./static-file-cache.js";
import { resolveRequestHost, trustProxy, trustedHosts } from "./proxy-trust.js";
import { IncomingMessage, ServerResponse } from "node:http";

//#region src/server/prod-server.d.ts
/**
 * Import a built server entry module (App Router RSC entry or Pages Router
 * server entry) by absolute file path.
 *
 * The first import of a given path uses the plain file:// URL with NO query
 * string. This is load-bearing: code-split builds emit lazy chunks that
 * import the entry back by bare specifier (default Vite/Rolldown builds hoist
 * modules shared between the entry's static graph and lazy route chunks into
 * the entry chunk, which the chunks then import as e.g. "../../index.js").
 * Node keys its ESM cache on the full URL including the query string, so if
 * the server imported the entry as `index.js?t=<mtime>`, a chunk's bare
 * back-import would evaluate the entire server bundle a second time and
 * module-level singletons (db pools, service registries) would silently
 * diverge between the two copies. See
 * https://github.com/cloudflare/vinext/issues/1923.
 *
 * A `?t=<mtime>` query string is appended only when the same path is
 * imported again after a rebuild (different mtime) — e.g. test suites that
 * rebuild a fixture to the same output path within one process — where the
 * bare URL's cache entry would return the stale previous build. Note this
 * rebuild branch trades the single-instance guarantee back: chunks that
 * import the entry by bare path still resolve to the FIRST build's cache
 * entry, so freshness and single-instance only hold together on the first
 * import of a path. Production processes import each entry path exactly
 * once and always get both.
 *
 * The entry is imported via its canonical real path: the bundler
 * canonicalizes module ids with fs.realpathSync.native, so chunks evaluate
 * under realpath-based URLs and their relative imports resolve to realpath
 * URLs too. Importing the entry through a symlinked path (macOS /var/...
 * tmpdirs, symlinked deploy directories) would otherwise create a second
 * instance keyed on the symlinked URL.
 *
 * Exported for direct unit testing of the URL choice.
 */
declare function resolveServerEntryImportUrl(entryPath: string): string;
declare function rememberCurrentServerEntryImportMtime(entryPath: string): void;
declare function importServerEntryModule(entryPath: string): Promise<any>;
/** Convert a Node.js IncomingMessage into a ReadableStream for Web Request body. */
declare function readNodeStream(req: IncomingMessage): ReadableStream<Uint8Array>;
type ProdServerOptions = {
  /** Port to listen on */port?: number; /** Host to bind to */
  host?: string; /** Path to the build output directory */
  outDir?: string; /** Explicit App Router RSC entry path. Defaults to `<outDir>/server/index.js`. */
  rscEntryPath?: string; /** Explicit Pages Router server entry path. Defaults to `<outDir>/server/entry.js`. */
  serverEntryPath?: string; /** Disable compression (default: false) */
  noCompression?: boolean;
  /**
   * Narrow startup context for callers that need a more precise log line.
   * Omitted for normal `vinext start` so the existing production-server output
   * remains stable.
   */
  purpose?: "prerender"; /** Suppress the startup log for internal child-process servers. */
  silent?: boolean;
};
/** Content types that benefit from compression. */
declare const COMPRESSIBLE_TYPES: Set<string>;
/** Minimum size threshold for compression (in bytes). Below this, compression overhead isn't worth it. */
declare const COMPRESS_THRESHOLD = 1024;
/**
 * Merge middleware headers and a Web Response's headers into a single
 * record suitable for Node.js `res.writeHead()`. Uses `getSetCookie()`
 * to preserve multiple Set-Cookie values instead of flattening them.
 */
declare function mergeResponseHeaders(middlewareHeaders: Record<string, string | string[]>, response: Response): Record<string, string | string[]>;
/**
 * Merge middleware/config headers and an optional status override into a new
 * Web Response while preserving the original body stream when allowed.
 *
 * This is the canonical {@link mergeHeaders} (server/worker-utils.ts) with the
 * arguments in (headers, response) order. The request path now calls
 * `runPagesRequest`, which uses `mergeHeaders` directly; this wrapper is retained
 * only for its existing tests and any external callers, so there is a single
 * implementation to keep in sync. The init-owned Cloudflare Worker template delegates here.
 */
declare function mergeWebResponse(middlewareHeaders: Record<string, string | string[]>, response: Response, statusOverride?: number): Response;
/**
 * Send a compressed response if the content type is compressible and the
 * client supports compression. Otherwise send uncompressed.
 */
declare function sendCompressed(req: IncomingMessage, res: ServerResponse, body: string | Buffer, contentType: string, statusCode: number, extraHeaders?: Record<string, string | string[]>, compress?: boolean, statusText?: string): void;
/**
 * Try to serve a static file from the client build directory.
 *
 * When a `StaticFileCache` is provided, lookups are pure in-memory Map.get()
 * with zero filesystem calls. Precompressed .br/.gz/.zst variants (generated at
 * build time) are served directly — no per-request compression needed for
 * hashed assets.
 *
 * Without a cache, falls back to async filesystem probing (still non-blocking,
 * unlike the old sync existsSync/statSync approach).
 */
declare function tryServeStatic(req: IncomingMessage, res: ServerResponse, clientDir: string, pathname: string, compress: boolean, cache?: StaticFileCache, extraHeaders?: Record<string, string | string[]>, statusCode?: number): Promise<boolean>;
/**
 * Convert a Node.js IncomingMessage to a Web Request object.
 *
 * When `urlOverride` is provided, it is used as the path + query string
 * instead of `req.url`.
 */
declare function nodeToWebRequest(req: IncomingMessage, urlOverride?: string, prerenderSecret?: string): Request;
/**
 * Stream a Web Response back to a Node.js ServerResponse.
 * Supports streaming compression for SSR responses.
 */
declare function sendWebResponse(webResponse: Response, req: IncomingMessage, res: ServerResponse, compress: boolean): Promise<void>;
/**
 * Start the production server.
 *
 * Automatically detects whether the build is App Router (dist/server/index.js) or
 * Pages Router (dist/server/entry.js) and configures the appropriate handler.
 */
declare function startProdServer(options?: ProdServerOptions): Promise<{
  server: import("node:http").Server<typeof IncomingMessage, typeof ServerResponse>;
  port: number;
}>;
type AppRouterPrerenderSeeder = (serverDir: string) => Promise<number>;
declare function resolveAppRouterPrerenderSeeder(entryModule: unknown): AppRouterPrerenderSeeder;
/**
 * Resolve a request pathname to a static-asset lookup path inside `clientDir`.
 *
 * Returns `null` when the request is not for a built asset, in which case
 * the caller should let the request fall through to the RSC handler.
 *
 * Three URL shapes are recognised:
 *
 *  - `/_next/static/...` — the default layout. Files land on disk at
 *    `dist/client/_next/static/...`, so the pathname maps 1:1. Also covers
 *    absolute-URL `assetPrefix` with no path component (same on-disk and
 *    URL shape).
 *  - `<assetPathPrefix>/_next/static/...` — when `assetPrefix` is a path
 *    prefix (e.g. `/custom-asset-prefix`). The on-disk layout is
 *    `dist/client/<prefix>/_next/static/...`, so the pathname maps 1:1.
 *  - `<absoluteURLPathname>/_next/static/...` — when `assetPrefix` is an
 *    absolute URL with a non-empty pathname (e.g. `https://cdn/sub`).
 *    Files are written to `dist/client/_next/static/...` but emitted URLs
 *    prepend the full URL. Requests do not normally arrive here — they go
 *    to the CDN — but we accept them so a same-origin reverse proxy can
 *    route through; the on-disk path is just `_next/static/...`.
 */
declare function resolveAppRouterAssetPath(pathname: string, assetPathPrefix: string, assetPrefix: string): string | null;
//#endregion
export { COMPRESSIBLE_TYPES, COMPRESS_THRESHOLD, ProdServerOptions, importServerEntryModule, mergeResponseHeaders, mergeWebResponse, negotiateEncoding, nodeToWebRequest, readNodeStream, rememberCurrentServerEntryImportMtime, resolveAppRouterAssetPath, resolveAppRouterPrerenderSeeder, resolveRequestHost as resolveHost, resolveServerEntryImportUrl, sendCompressed, sendWebResponse, startProdServer, trustProxy, trustedHosts, tryServeStatic };