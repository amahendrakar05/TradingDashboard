//#region src/utils/manifest-paths.d.ts
declare function manifestFileWithBase(file: string, base: string): string;
declare function manifestFileWithAssetPrefix(file: string, base: string, assetPrefix: string): string;
/**
 * Resolve the URL a client asset is actually SERVED from, starting from a
 * base-anchored manifest / SSR-manifest value (no leading slash), e.g.
 * `"docs/cdn/_next/static/x.js"`.
 *
 * Next.js semantics: `assetPrefix` REPLACES `basePath` for asset URLs (they do
 * not stack). So when an `assetPrefix` is configured we strip the basePath
 * segment and re-anchor under the assetPrefix — matching how `next/dynamic`
 * preloads are computed (`manifestFileWithAssetPrefix`) and what the prod server
 * / Cloudflare ASSETS binding actually serve. Without this, a `basePath` +
 * path-style `assetPrefix` build emits `/<basePath>/<assetPrefix>/_next/...`
 * which 404s. When no `assetPrefix` is set, the base-anchored value is already
 * the served URL and is returned unchanged (just root-anchored).
 *
 * Returns an absolute URL for an absolute `assetPrefix`, otherwise a
 * root-relative URL beginning with `/`.
 */
declare function assetServingUrlFromBaseAnchored(value: string, basePath: string, assetPrefix: string): string;
/**
 * Strip a `base` prefix that Vite applied twice: it bakes `base` into the
 * on-disk chunk fileName and then prepends it again in `ssr-manifest.json`,
 * yielding `docs/docs/_next/static/...` which 404s. Only an exact
 * `<base>/<base>/` prefix is collapsed; a single prefix is left untouched.
 */
declare function collapseDuplicateBase(file: string, base: string): string;
//#endregion
export { assetServingUrlFromBaseAnchored, collapseDuplicateBase, manifestFileWithAssetPrefix, manifestFileWithBase };