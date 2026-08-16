import { FontStyle } from "./font-utils.js";

//#region src/shims/font-local.d.ts
type LocalFontSrc = {
  path: string;
  weight?: string;
  style?: string;
};
type CssVariable = `--${string}`;
type LocalFontOptions<T extends CssVariable | undefined = CssVariable | undefined> = {
  src: string | LocalFontSrc | LocalFontSrc[];
  display?: string;
  weight?: string;
  style?: string;
  fallback?: string[];
  preload?: boolean;
  variable?: T;
  adjustFontFallback?: boolean | string;
  declarations?: Array<{
    prop: string;
    value: string;
  }>;
  _vinext?: {
    font?: {
      family?: unknown;
    };
  };
};
type FontResult = {
  className: string;
  style: FontStyle;
  variable?: string;
};
type NextFont = Omit<FontResult, "variable"> & {
  variable?: undefined;
};
type NextFontWithVariable = Omit<NextFont, "variable"> & {
  variable: string;
};
/**
 * Get collected SSR font styles (used by the renderer).
 * Note: We don't clear the arrays because fonts are loaded at module import
 * time and need to persist across all requests in the Workers environment.
 */
declare function getSSRFontStyles(): string[];
/**
 * Get collected SSR font preload data (used by the renderer).
 * Returns an array of { href, type } objects for emitting
 * <link rel="preload" as="font" ...> tags.
 */
declare function getSSRFontPreloads(): Array<{
  href: string;
  type: string;
}>;
declare function localFont<T extends CssVariable | undefined = undefined>(options: LocalFontOptions<T>): T extends undefined ? NextFont : NextFontWithVariable;
//#endregion
export { localFont as default, getSSRFontPreloads, getSSRFontStyles };