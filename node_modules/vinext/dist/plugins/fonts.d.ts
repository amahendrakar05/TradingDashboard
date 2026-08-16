import { Plugin } from "vite";

//#region src/plugins/fonts.d.ts
declare const VIRTUAL_GOOGLE_FONTS = "virtual:vinext-google-fonts";
declare const RESOLVED_VIRTUAL_GOOGLE_FONTS: string;
/**
 * Rewrite absolute filesystem paths in cached Google Fonts CSS so the
 * `@font-face { src: url(...) }` references point at the served URL the
 * plugin's `writeBundle` hook copies the font files to.
 *
 * This is called once per transform, before the CSS string is embedded in
 * the bundle as `_vinext.font.selfHostedCSS`. Every downstream consumer reads
 * from the same rewritten CSS: the injected `<style data-vinext-fonts>` block, the
 * HTML body's `<link rel="preload">` tags (via `collectFontPreloadsFromCSS`
 * in `shims/font-google-base.ts`), and the HTTP `Link:` response header
 * (via `buildAppPageFontLinkHeader` in `server/app-page-execution.ts`).
 *
 * Without this rewrite, all three emit the dev-machine filesystem path
 * (e.g. `/home/user/project/.vinext/fonts/geist-<hash>/geist-<hash>.woff2`)
 * and any production request fetches `<origin>/home/user/...` → 404.
 *
 * `assetsDir` must match whatever Vite has resolved for
 * `build.assetsDir` on the client environment — otherwise the embedded
 * CSS URLs and the files emitted by the `writeBundle` hook would diverge
 * and a user who customizes `build.assetsDir` (e.g. to `"static"`) would
 * see 404s on every preload. The call site in `injectSelfHostedCss`
 * passes the resolved value through from plugin state. The default is
 * kept only so the exported helper can be driven directly from unit
 * tests without synthesizing a full plugin context.
 *
 * Uses split/join rather than regex because `cacheDir` is an absolute
 * filesystem path that may contain regex metacharacters on unusual
 * filesystems.
 */
declare function _rewriteCachedFontCssToServedUrls(css: string, cacheDir: string, assetsDir?: string): string;
/**
 * Safely parse a static JS object literal string into a plain object.
 * Uses Vite's parseAst (Rollup/acorn) so no code is ever evaluated.
 * Returns null if the expression contains anything dynamic (function calls,
 * template literals, identifiers, computed properties, etc.).
 *
 * Supports: string literals, numeric literals, boolean literals,
 * arrays of the above, and nested object literals.
 */
declare function parseStaticObjectLiteral(objectStr: string): Record<string, unknown> | null;
declare function generateGoogleFontsVirtualModule(id: string, fontGoogleShimPath: string): string | null;
/**
 * Create the `vinext:google-fonts` Vite plugin.
 *
 * @param fontGoogleShimPath - Absolute path to the font-google shim module
 *   (either `.ts` in source or `.js` in built packages). Resolved by the caller
 *   so the plugin file has no dependency on `__dirname`.
 * @param shimsDir - Absolute path to the shims directory. Used to skip shim
 *   files from transform (they contain `next/font/google` references that must
 *   not be rewritten).
 */
/**
 * Scan `code` forward from `searchStart` for a `{...}` object literal that
 * may contain arbitrarily nested braces.  Returns `[objStart, objEnd]` where
 * `code[objStart] === '{'` and `code[objEnd - 1] === '}'`, or `null` if no
 * balanced object is found.
 *
 * String literals (single-quoted, double-quoted, and backtick template
 * literals including `${...}` interpolations) are fully skipped so that brace
 * characters inside string values do not affect the depth count.
 */
declare function _findBalancedObject(code: string, searchStart: number): [number, number] | null;
/**
 * Given the index just past the closing `}` of an options object, skip
 * optional whitespace and return the index after the closing `)`.
 * Returns `null` if the next non-whitespace character is not `)`.
 */
declare function _findCallEnd(code: string, objEnd: number): number | null;
declare function createGoogleFontsPlugin(fontGoogleShimPath: string, shimsDir: string): Plugin;
/**
 * Create the `vinext:local-fonts` Vite plugin.
 *
 * Rewrites relative font file paths in `next/font/local` calls into Vite
 * asset import references so that both dev (/@fs/...) and prod
 * (/assets/font-xxx.woff2) URLs resolve correctly.
 *
 * @param shimsDir - Absolute path to the shims directory (with trailing
 *   separator). Used to skip vinext's own shim files from transform — they
 *   contain example `next/font/local` paths in comments that must not be
 *   rewritten. A precise prefix check is required (rather than a loose
 *   substring match) because, now that `node_modules` is no longer excluded,
 *   the guard runs against arbitrary third-party package paths — some of
 *   which may legitimately contain the substring `font-local` (e.g. a
 *   package named `font-local-loader`) and must still be transformed. This
 *   mirrors `createGoogleFontsPlugin`, which takes `shimsDir` for the same
 *   reason.
 */
declare function createLocalFontsPlugin(shimsDir: string): Plugin;
//#endregion
export { RESOLVED_VIRTUAL_GOOGLE_FONTS, VIRTUAL_GOOGLE_FONTS, _findBalancedObject, _findCallEnd, _rewriteCachedFontCssToServedUrls, createGoogleFontsPlugin, createLocalFontsPlugin, generateGoogleFontsVirtualModule, parseStaticObjectLiteral };