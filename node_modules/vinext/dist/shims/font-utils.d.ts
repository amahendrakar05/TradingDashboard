//#region src/shims/font-utils.d.ts
type FontStyle = {
  fontFamily: string;
  fontWeight?: number;
  fontStyle?: string;
};
type FontFaceStyleInput = {
  fontFamily: string;
  weight?: string | string[];
  style?: string | string[];
  internalWeight?: number;
  internalStyle?: string;
  google?: boolean;
};
/**
 * Escape a string for safe interpolation inside a CSS single-quoted string.
 *
 * Prevents CSS injection by escaping characters that could break out of
 * a `'...'` CSS string context: backslashes, single quotes, and newlines.
 *
 * Used by font-google-base.ts, font-local.ts, and fallback-metrics.ts.
 */
declare function escapeCSSString(value: string): string;
/**
 * Validate a CSS custom property name (e.g. `--font-inter`).
 *
 * Custom properties must start with `--` and only contain alphanumeric
 * characters, hyphens, and underscores. Anything else could be used to
 * break out of the CSS declaration and inject arbitrary rules.
 *
 * Returns the name if valid, undefined otherwise.
 */
declare function sanitizeCSSVarName(name: string): string | undefined;
/**
 * Sanitize a CSS font-family fallback name.
 *
 * Generic family names (sans-serif, serif, monospace, etc.) are used as-is.
 * Named families are wrapped in escaped quotes. This prevents injection via
 * crafted fallback values like `); } body { color: red; } .x {`.
 */
declare function sanitizeFallback(name: string): string;
declare function singleFontOptionValue(value: string | string[] | undefined): string | undefined;
declare function sanitizeFontDescriptorValue(value: string): string | undefined;
declare function resolveFontWeight(weight: string | string[] | undefined): number | undefined;
declare function resolveFontStyle(style: string | string[] | undefined): string | undefined;
declare function resolveGoogleFontStyle(style: string | string[] | undefined): string | undefined;
declare function resolveSingleFaceStyle(input: FontFaceStyleInput): FontStyle;
declare function formatFontClassRule(className: string, style: FontStyle): string;
/**
 * Determine the MIME type for a font file based on its extension.
 * Uses endsWith() only to avoid false positives from substring matches
 * (e.g. ".woff" matching ".woff2").
 */
declare function getFontMimeType(pathOrUrl: string): string;
//#endregion
export { FontFaceStyleInput, FontStyle, escapeCSSString, formatFontClassRule, getFontMimeType, resolveFontStyle, resolveFontWeight, resolveGoogleFontStyle, resolveSingleFaceStyle, sanitizeCSSVarName, sanitizeFallback, sanitizeFontDescriptorValue, singleFontOptionValue };