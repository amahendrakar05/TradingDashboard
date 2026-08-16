import { FontStyle } from "./font-utils.js";

//#region src/shims/font-google-base.d.ts
type CssVariable = `--${string}`;
type FontOptions<T extends CssVariable | undefined = CssVariable | undefined> = {
  weight?: string | string[];
  style?: string | string[];
  subsets?: string[];
  display?: string;
  preload?: boolean;
  fallback?: string[];
  adjustFontFallback?: boolean | string;
  variable?: T;
  axes?: string[];
};
type FontResult = {
  className: string;
  style: FontStyle;
  variable?: string;
};
type InternalGoogleFontRuntimeOptions = {
  selfHostedCSS?: string;
  preloadUrls?: string[];
  adjustedFallbackCSS?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
};
type FontLoaderOptions<T extends CssVariable | undefined = CssVariable | undefined> = FontOptions<T> & {
  /**
   * Internal payload injected by the vinext:google-fonts transform after
   * metadata validation. Runtime must prefer these values over user options
   * because they represent the resolved Next-compatible face, including
   * metadata defaults such as italic-only families.
   */
  _vinext?: {
    font?: InternalGoogleFontRuntimeOptions;
  };
};
/**
 * Build a Google Fonts CSS URL.
 *
 * In production this code path is dead. The build plugin
 * (`vinext:google-fonts` in `src/plugins/fonts.ts`) statically resolves
 * each font call's axis values against the bundled metadata, fetches the
 * Google Fonts CSS, and injects the resulting CSS as
 * `_vinext.font.selfHostedCSS` so the runtime never queries Google. The shim
 * only reaches this builder when the plugin's static parser bails (dynamic
 * options, eval-only shapes), which is dev-only.
 *
 * The dev fallback intentionally has no metadata: shipping the 388 KB
 * `font-data.json` to the Worker bundle would dwarf the rest of the shim,
 * and the production path already has the metadata-aware variant. The
 * tradeoff is that the dev fallback cannot resolve a variable font's
 * actual `wght` axis range. It emits no axis segment when no `weight` is
 * given, which makes Google return the default static face (200) instead
 * of the broken `:wght@100..900` URL that issue #885 reports.
 */
declare function buildGoogleFontsUrl(family: string, options: FontOptions): string;
/**
 * Get collected SSR font class styles (used by the renderer).
 * Note: We don't clear the arrays because fonts are loaded at module import
 * time and need to persist across all requests in the Workers environment.
 */
declare function getSSRFontStyles(): string[];
/**
 * Get collected SSR font URLs (used by the renderer).
 * Note: We don't clear the arrays because fonts are loaded at module import
 * time and need to persist across all requests in the Workers environment.
 */
declare function getSSRFontLinks(): string[];
/**
 * Get collected SSR font preload data (used by the renderer).
 * Returns an array of { href, type } objects for emitting
 * <link rel="preload" as="font" ...> tags.
 */
declare function getSSRFontPreloads(): Array<{
  href: string;
  type: string;
}>;
type NextFont = Omit<FontResult, "variable"> & {
  variable?: undefined;
};
type NextFontWithVariable = Omit<NextFont, "variable"> & {
  variable: string;
};
type FontLoader = <T extends CssVariable | undefined = undefined>(options?: FontLoaderOptions<T>) => T extends undefined ? NextFont : NextFontWithVariable;
declare function createFontLoader(family: string): FontLoader;
declare const googleFonts: Record<string, FontLoader>;
//#endregion
export { FontLoader, FontOptions, FontResult, buildGoogleFontsUrl, createFontLoader, googleFonts as default, getSSRFontLinks, getSSRFontPreloads, getSSRFontStyles };