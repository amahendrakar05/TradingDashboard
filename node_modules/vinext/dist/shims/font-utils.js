//#region src/shims/font-utils.ts
/**
* Escape a string for safe interpolation inside a CSS single-quoted string.
*
* Prevents CSS injection by escaping characters that could break out of
* a `'...'` CSS string context: backslashes, single quotes, and newlines.
*
* Used by font-google-base.ts, font-local.ts, and fallback-metrics.ts.
*/
function escapeCSSString(value) {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\a ").replace(/\r/g, "\\d ");
}
/**
* Validate a CSS custom property name (e.g. `--font-inter`).
*
* Custom properties must start with `--` and only contain alphanumeric
* characters, hyphens, and underscores. Anything else could be used to
* break out of the CSS declaration and inject arbitrary rules.
*
* Returns the name if valid, undefined otherwise.
*/
function sanitizeCSSVarName(name) {
	if (/^--[a-zA-Z0-9_-]+$/.test(name)) return name;
}
/**
* Sanitize a CSS font-family fallback name.
*
* Generic family names (sans-serif, serif, monospace, etc.) are used as-is.
* Named families are wrapped in escaped quotes. This prevents injection via
* crafted fallback values like `); } body { color: red; } .x {`.
*/
function sanitizeFallback(name) {
	const generics = /* @__PURE__ */ new Set([
		"serif",
		"sans-serif",
		"monospace",
		"cursive",
		"fantasy",
		"system-ui",
		"ui-serif",
		"ui-sans-serif",
		"ui-monospace",
		"ui-rounded",
		"emoji",
		"math",
		"fangsong"
	]);
	const trimmed = name.trim();
	if (generics.has(trimmed)) return trimmed;
	return `'${escapeCSSString(trimmed)}'`;
}
function singleFontOptionValue(value) {
	if (Array.isArray(value)) return new Set(value).size === 1 ? value[0] : void 0;
	return value;
}
function sanitizeFontDescriptorValue(value) {
	if (/[{};]|\/\*|\*\/|<\//i.test(value)) return void 0;
	return value;
}
function resolveFontWeight(weight) {
	const value = singleFontOptionValue(weight);
	if (!value || value.includes(" ")) return void 0;
	const numericWeight = Number(value);
	return Number.isFinite(numericWeight) ? numericWeight : void 0;
}
function resolveFontStyle(style) {
	const value = singleFontOptionValue(style);
	if (!value || value.includes(" ")) return void 0;
	return sanitizeFontDescriptorValue(value);
}
function resolveGoogleFontStyle(style) {
	if (style === void 0) return "normal";
	const value = singleFontOptionValue(style);
	if (!value) return void 0;
	if (value === "normal" || value === "italic") return value;
}
function resolveSingleFaceStyle(input) {
	const fontWeight = input.internalWeight ?? resolveFontWeight(input.weight);
	const fontStyle = (input.internalStyle ? sanitizeFontDescriptorValue(input.internalStyle) : void 0) ?? (input.google ? resolveGoogleFontStyle(input.style) : resolveFontStyle(input.style));
	return {
		fontFamily: input.fontFamily,
		...fontWeight !== void 0 ? { fontWeight } : {},
		...fontStyle ? { fontStyle } : {}
	};
}
function formatFontClassRule(className, style) {
	const fontStyle = style.fontStyle ? sanitizeFontDescriptorValue(style.fontStyle) : void 0;
	return `.${className} { ${[
		`font-family: ${style.fontFamily}`,
		...style.fontWeight !== void 0 ? [`font-weight: ${style.fontWeight}`] : [],
		...fontStyle ? [`font-style: ${fontStyle}`] : []
	].join("; ")}; }\n`;
}
/**
* Determine the MIME type for a font file based on its extension.
* Uses endsWith() only to avoid false positives from substring matches
* (e.g. ".woff" matching ".woff2").
*/
function getFontMimeType(pathOrUrl) {
	if (pathOrUrl.endsWith(".woff2")) return "font/woff2";
	if (pathOrUrl.endsWith(".woff")) return "font/woff";
	if (pathOrUrl.endsWith(".ttf")) return "font/ttf";
	if (pathOrUrl.endsWith(".otf")) return "font/opentype";
	return "font/woff2";
}
//#endregion
export { escapeCSSString, formatFontClassRule, getFontMimeType, resolveFontStyle, resolveFontWeight, resolveGoogleFontStyle, resolveSingleFaceStyle, sanitizeCSSVarName, sanitizeFallback, sanitizeFontDescriptorValue, singleFontOptionValue };
