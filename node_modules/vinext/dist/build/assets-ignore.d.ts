//#region src/build/assets-ignore.d.ts
/**
 * Build metadata that must never be served by the Cloudflare ASSETS binding.
 *
 * On Cloudflare Workers the ASSETS binding serves any uploaded file whose path
 * matches the request BEFORE the Worker runs, so anything written into the
 * client output directory (`dist/client`) is publicly fetchable unless excluded.
 * Vite writes its build/SSR manifests under `dist/client/.vite/` (enabled for
 * Cloudflare builds so the worker entry can compute lazy chunks), which would
 * otherwise expose the full source-file → chunk mapping — including the paths of
 * routes that are never linked from the UI.
 *
 * The Node production server already blocks `/.vite/` explicitly
 * (see `server/static-file-cache.ts`); `.assetsignore` is the equivalent guard
 * for the Cloudflare deployment target. wrangler matches `.assetsignore`
 * patterns with `.gitignore` semantics (via the `ignore` package), so the bare
 * `.vite` entry excludes the directory and everything beneath it.
 */
declare const DEFAULT_VINEXT_ASSET_IGNORE_PATTERNS: readonly string[];
/**
 * Ensure a `.assetsignore` in `clientDir` contains every pattern in `patterns`.
 *
 * Any pre-existing (user-authored) content is preserved verbatim and only the
 * missing patterns are appended, so the result is idempotent across rebuilds
 * and never clobbers a `.assetsignore` the developer wrote themselves.
 *
 * @returns `true` when the file was created or modified, `false` when it already
 *          covered every requested pattern.
 */
declare function ensureAssetsIgnore(clientDir: string, patterns?: readonly string[]): boolean;
//#endregion
export { DEFAULT_VINEXT_ASSET_IGNORE_PATTERNS, ensureAssetsIgnore };