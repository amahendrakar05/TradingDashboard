import { escapeCSSString, formatFontClassRule, getFontMimeType, resolveSingleFaceStyle, sanitizeCSSVarName, sanitizeFallback } from "./font-utils.js";
import { buildGoogleFontsUrl as buildGoogleFontsUrl$1 } from "../build/google-fonts/build-url.js";
//#region src/shims/font-google-base.ts
/**
* next/font/google shim
*
* Provides a compatible shim for Next.js Google Fonts.
*
* Two modes:
* 1. **Dev / CDN mode** (default): Loads fonts from Google Fonts CDN via <link> tags.
* 2. **Self-hosted mode** (production build): The vinext:google-fonts Vite plugin
*    fetches font CSS + .woff2 files at build time, caches them locally, and injects
*    @font-face CSS pointing at local assets. No requests to Google at runtime.
*
* Usage:
*   import { Inter } from 'next/font/google';
*   const inter = Inter({ subsets: ['latin'], weight: ['400', '700'] });
*   // inter.className -> stable CSS class for this font/options pair
*   // inter.style -> { fontFamily: "'Inter', 'Inter Fallback'", fontStyle: "normal" }
*   // inter.variable -> CSS class that sets the font CSS variable when requested
*/
const injectedFonts = /* @__PURE__ */ new Set();
/**
* Convert a font family name to a CSS variable name.
* e.g., "Inter" -> "--font-inter", "Roboto Mono" -> "--font-roboto-mono"
*/
function toVarName(family) {
	return "--font-" + family.toLowerCase().replace(/\s+/g, "-");
}
function fontClassSegment(family) {
	return family.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "font";
}
function normalizeStringSetOption(value) {
	if (!value) return "";
	return [...new Set((Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean))].sort().join(",");
}
function normalizeWeightOption(value) {
	const normalized = normalizeStringSetOption(value);
	return normalized === "variable" ? "" : normalized;
}
function normalizeStyleOption(value) {
	const values = new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim()).filter(Boolean));
	const hasItalic = values.has("italic");
	const hasNormal = values.has("normal");
	if (!hasItalic) return "";
	return hasNormal ? "italic,normal" : "italic";
}
function normalizeFallbackOption(value) {
	if (!value) return "";
	return value.map((item) => item.trim()).join(",");
}
function normalizeBooleanOption(value) {
	if (value === void 0) return "";
	return value ? "1" : "0";
}
function normalizeStringOrBooleanOption(value) {
	if (value === void 0) return "";
	return typeof value === "boolean" ? normalizeBooleanOption(value) : value;
}
function hashString(value) {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash.toString(36).padStart(7, "0");
}
function createFontIdentity(family, options, cssVarName, fallback) {
	return hashString([
		family,
		cssVarName,
		normalizeWeightOption(options.weight),
		normalizeStyleOption(options.style),
		normalizeStringSetOption(options.subsets),
		options.display ?? "swap",
		normalizeBooleanOption(options.preload),
		normalizeFallbackOption(fallback),
		normalizeStringOrBooleanOption(options.adjustFontFallback),
		normalizeStringSetOption(options.axes),
		options._vinext?.font?.selfHostedCSS ?? "",
		options._vinext?.font?.fontWeight?.toString() ?? "",
		options._vinext?.font?.fontStyle ?? ""
	].join("\0"));
}
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
function buildGoogleFontsUrl(family, options) {
	const weights = options.weight ? Array.isArray(options.weight) ? options.weight : [options.weight] : [];
	const styles = options.style ? Array.isArray(options.style) ? options.style : [options.style] : [];
	const hasItalic = styles.includes("italic");
	const hasNormal = styles.includes("normal");
	const ital = hasItalic ? [...hasNormal ? ["0"] : [], "1"] : void 0;
	const normalizedWeights = weights.length === 1 && weights[0] === "variable" ? [] : weights;
	return buildGoogleFontsUrl$1(family, {
		wght: normalizedWeights.length > 0 ? normalizedWeights : ital ? ["400"] : void 0,
		ital
	}, options.display ?? "swap");
}
/**
* Inject a <link> tag for the font (client-side only).
* On the server, we track font URLs for SSR head injection.
*/
function injectFontStylesheet(url) {
	if (injectedFonts.has(url)) return;
	injectedFonts.add(url);
	if (typeof document !== "undefined") {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = url;
		document.head.appendChild(link);
	}
}
/** Track which className CSS rules have been injected. */
const injectedClassRules = /* @__PURE__ */ new Set();
/**
* Inject a CSS rule that maps a className to the exported font style.
*
* This is what makes `<div className={inter.className}>` apply the font.
* Next.js generates equivalent rules at build time.
*
* In Next.js, the .className class sets font-family and any single
* font-weight/font-style. CSS variables are handled separately by .variable.
*/
function injectClassNameRule(className, fontStyle) {
	if (injectedClassRules.has(className)) return;
	injectedClassRules.add(className);
	const css = formatFontClassRule(className, fontStyle);
	if (typeof document === "undefined") {
		ssrFontStyles.push(css);
		return;
	}
	const styleElement = document.createElement("style");
	styleElement.textContent = css;
	styleElement.setAttribute("data-vinext-font-class", className);
	document.head.appendChild(styleElement);
}
/** Track which variable class CSS rules have been injected. */
const injectedVariableRules = /* @__PURE__ */ new Set();
/**
* Inject a CSS rule that sets a CSS variable on an element.
* This is what makes `<html className={inter.variable}>` set the CSS variable
* that can be referenced by other styles (e.g., Tailwind's font-sans).
*
* In Next.js, the .variable class ONLY sets the CSS variable — it does NOT
* set font-family. This is critical because apps commonly apply multiple
* .variable classes to <body> (e.g., geistSans.variable + geistMono.variable).
* If we also set font-family here, the last class wins due to CSS cascade,
* causing all text to use that font (e.g., everything becomes monospace).
*/
function injectVariableClassRule(variableClassName, cssVarName, fontFamily) {
	if (injectedVariableRules.has(variableClassName)) return;
	injectedVariableRules.add(variableClassName);
	const css = `.${variableClassName} { ${cssVarName}: ${fontFamily}; }\n`;
	if (typeof document === "undefined") {
		ssrFontStyles.push(css);
		return;
	}
	const style = document.createElement("style");
	style.textContent = css;
	style.setAttribute("data-vinext-font-variable", variableClassName);
	document.head.appendChild(style);
}
const ssrFontStyles = [];
/**
* Get collected SSR font class styles (used by the renderer).
* Note: We don't clear the arrays because fonts are loaded at module import
* time and need to persist across all requests in the Workers environment.
*/
function getSSRFontStyles() {
	return [...ssrFontStyles];
}
const ssrFontUrls = [];
/**
* Get collected SSR font URLs (used by the renderer).
* Note: We don't clear the arrays because fonts are loaded at module import
* time and need to persist across all requests in the Workers environment.
*/
function getSSRFontLinks() {
	return [...ssrFontUrls];
}
const ssrFontPreloads = [];
const ssrFontPreloadHrefs = /* @__PURE__ */ new Set();
/**
* Get collected SSR font preload data (used by the renderer).
* Returns an array of { href, type } objects for emitting
* <link rel="preload" as="font" ...> tags.
*/
function getSSRFontPreloads() {
	return [...ssrFontPreloads];
}
/**
* Collect build-selected font file URLs for preload link generation.
* Only collects on the server (SSR). Deduplicates by href using a Set for O(1) lookups.
*/
function collectFontPreloads(urls) {
	if (typeof document !== "undefined") return;
	for (const href of urls) if (href.startsWith("/") && !ssrFontPreloadHrefs.has(href)) {
		ssrFontPreloadHrefs.add(href);
		ssrFontPreloads.push({
			href,
			type: getFontMimeType(href)
		});
	}
}
/** Track injected self-hosted @font-face blocks (deduplicate) */
const injectedSelfHosted = /* @__PURE__ */ new Set();
/**
* Inject self-hosted @font-face CSS (from the build plugin).
* This replaces the CDN <link> tag with inline CSS.
*/
function injectSelfHostedCSS(css, preloadUrls = []) {
	collectFontPreloads(preloadUrls);
	if (injectedSelfHosted.has(css)) return;
	injectedSelfHosted.add(css);
	if (typeof document === "undefined") {
		ssrFontStyles.push(css);
		return;
	}
	const style = document.createElement("style");
	style.textContent = css;
	style.setAttribute("data-vinext-font-selfhosted", "true");
	document.head.appendChild(style);
}
function createFontLoader(family) {
	return function fontLoader(options = {}) {
		const internal = options._vinext?.font;
		const fallback = options.fallback ?? [];
		const adjustedFallback = options.adjustFontFallback === false || !internal?.adjustedFallbackCSS ? [] : [`'${escapeCSSString(family)} Fallback'`];
		const fontFamily = [
			`'${escapeCSSString(family)}'`,
			...adjustedFallback,
			...fallback.map(sanitizeFallback)
		].join(", ");
		const defaultVarName = toVarName(family);
		const cssVarName = options.variable ? sanitizeCSSVarName(options.variable) ?? defaultVarName : defaultVarName;
		const id = createFontIdentity(family, options, cssVarName, fallback);
		const classSegment = fontClassSegment(family);
		const className = `__font_${classSegment}_${id}`;
		const variableClassName = `__variable_${classSegment}_${id}`;
		const style = resolveSingleFaceStyle({
			fontFamily,
			weight: options.weight,
			style: options.style,
			internalWeight: internal?.fontWeight,
			internalStyle: internal?.fontStyle,
			google: true
		});
		if (internal?.selfHostedCSS) injectSelfHostedCSS(internal.selfHostedCSS, internal.preloadUrls);
		else {
			const url = buildGoogleFontsUrl(family, options);
			injectFontStylesheet(url);
			if (typeof document === "undefined") {
				if (!ssrFontUrls.includes(url)) ssrFontUrls.push(url);
			}
		}
		if (options.adjustFontFallback !== false && internal?.adjustedFallbackCSS) injectSelfHostedCSS(internal.adjustedFallbackCSS);
		injectClassNameRule(className, style);
		if (options.variable) injectVariableClassRule(variableClassName, cssVarName, fontFamily);
		return {
			className,
			style,
			...options.variable ? { variable: variableClassName } : {}
		};
	};
}
const googleFonts = new Proxy({}, { get(_target, prop) {
	if (typeof prop !== "string") return void 0;
	if (prop === "__esModule") return true;
	if (prop === "default") return googleFonts;
	return createFontLoader(prop.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2"));
} });
//#endregion
export { buildGoogleFontsUrl, createFontLoader, googleFonts as default, getSSRFontLinks, getSSRFontPreloads, getSSRFontStyles };
