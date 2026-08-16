import { escapeCSSString, formatFontClassRule, getFontMimeType, resolveSingleFaceStyle, sanitizeCSSVarName, sanitizeFallback, sanitizeFontDescriptorValue } from "./font-utils.js";
//#region src/shims/font-local.ts
/**
* next/font/local shim
*
* Provides a runtime-compatible shim for Next.js local fonts.
* Generates @font-face CSS declarations and returns an object
* with className, style, and variable properties.
*
* Supports both client-side injection and SSR collection,
* matching the patterns used by the Google font shim.
*
* Usage:
*   import localFont from 'next/font/local';
*   const myFont = localFont({ src: './my-font.woff2' });
*   // myFont.className -> unique CSS class
*   // myFont.style -> { fontFamily: "'__local_font_0', sans-serif" }
*   // myFont.variable -> generated class name when requested
*/
/**
* Validate a CSS property name for use in declarations.
*
* Only allows standard CSS property names (lowercase letters and hyphens)
* and custom properties (--prefixed). Rejects anything that could inject
* CSS rules via crafted property names.
*/
function sanitizeCSSProperty(prop) {
	if (/^(--)?[a-zA-Z][a-zA-Z0-9-]*$/.test(prop)) return prop;
}
function sanitizeInternalFontFamily(name) {
	if (typeof name !== "string" || name.length === 0) return void 0;
	if (/^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(name)) return name;
}
let classCounter = 0;
const injectedFonts = /* @__PURE__ */ new Set();
function generateFontFaceCSS(family, options, sources) {
	const display = options.display ?? "swap";
	const rules = [];
	for (const src of sources) {
		const weight = sanitizeFontDescriptorValue(src.weight ?? options.weight ?? "400") ?? "400";
		const style = sanitizeFontDescriptorValue(src.style ?? options.style ?? "normal") ?? "normal";
		const format = src.path.endsWith(".woff2") ? "woff2" : src.path.endsWith(".woff") ? "woff" : src.path.endsWith(".ttf") ? "truetype" : src.path.endsWith(".otf") ? "opentype" : "woff2";
		rules.push(`@font-face {
  font-family: '${escapeCSSString(family)}';
  src: url('${escapeCSSString(src.path)}') format('${format}');
  font-weight: ${weight};
  font-style: ${style};
  font-display: ${display};
}`);
	}
	if (options.declarations) for (const decl of options.declarations) {
		const safeProp = sanitizeCSSProperty(decl.prop);
		const safeValue = sanitizeFontDescriptorValue(decl.value);
		if (safeProp && safeValue) rules.push(`@font-face { font-family: '${escapeCSSString(family)}'; ${safeProp}: ${safeValue}; }`);
	}
	return rules.join("\n");
}
const ssrFontStyles = [];
const ssrFontPreloads = [];
const ssrFontPreloadHrefs = /* @__PURE__ */ new Set();
/**
* Get collected SSR font styles (used by the renderer).
* Note: We don't clear the arrays because fonts are loaded at module import
* time and need to persist across all requests in the Workers environment.
*/
function getSSRFontStyles() {
	return [...ssrFontStyles];
}
/**
* Get collected SSR font preload data (used by the renderer).
* Returns an array of { href, type } objects for emitting
* <link rel="preload" as="font" ...> tags.
*/
function getSSRFontPreloads() {
	return [...ssrFontPreloads];
}
function injectFontFaceCSS(css, id) {
	if (injectedFonts.has(id)) return;
	injectedFonts.add(id);
	if (typeof document === "undefined") {
		ssrFontStyles.push(css);
		return;
	}
	const style = document.createElement("style");
	style.textContent = css;
	style.setAttribute("data-vinext-font", id);
	document.head.appendChild(style);
}
/** Track which className CSS rules have been injected. */
const injectedClassRules = /* @__PURE__ */ new Set();
/**
* Inject a CSS rule that maps a className to the exported font style.
*
* This is what makes `<div className={font.className}>` apply the font.
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
	const style = document.createElement("style");
	style.textContent = css;
	style.setAttribute("data-vinext-font-class", className);
	document.head.appendChild(style);
}
/** Track which variable class CSS rules have been injected. */
const injectedVariableRules = /* @__PURE__ */ new Set();
/** Track which :root CSS variable rules have been injected. */
const injectedRootVariables = /* @__PURE__ */ new Set();
/**
* Inject a CSS rule that sets a CSS variable on an element.
* This is what makes `<html className={font.variable}>` set the CSS variable
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
	let css = `.${variableClassName} { ${cssVarName}: ${fontFamily}; }\n`;
	if (!injectedRootVariables.has(cssVarName)) {
		injectedRootVariables.add(cssVarName);
		css += `:root { ${cssVarName}: ${fontFamily}; }\n`;
	}
	if (typeof document === "undefined") {
		ssrFontStyles.push(css);
		return;
	}
	const style = document.createElement("style");
	style.textContent = css;
	style.setAttribute("data-vinext-font-variable", variableClassName);
	document.head.appendChild(style);
}
/**
* Normalize the `src` option into a flat array of `{ path, weight?, style? }`.
* Handles string, single object, and array forms.
*/
function normalizeSources(options) {
	if (Array.isArray(options.src)) return options.src;
	if (typeof options.src === "string") return [{ path: options.src }];
	return [options.src];
}
/**
* Collect font source URLs for preload link generation.
* Only collects on the server (SSR). Deduplicates by href using a Set for O(1) lookups.
*/
function collectFontPreloads(sources) {
	if (typeof document !== "undefined") return;
	for (const src of sources) {
		const href = src.path;
		if (href && href.startsWith("/") && !ssrFontPreloadHrefs.has(href)) {
			ssrFontPreloadHrefs.add(href);
			ssrFontPreloads.push({
				href,
				type: getFontMimeType(href)
			});
		}
	}
}
function localFont(options) {
	const id = classCounter++;
	const sources = normalizeSources(options);
	const singleSource = sources.length === 1 ? sources[0] : void 0;
	const family = sanitizeInternalFontFamily(options._vinext?.font?.family) ?? `__local_font_${id}`;
	const className = `__font_local_${id}`;
	const fontFamily = `'${family}', ${(options.fallback ?? ["sans-serif"]).map(sanitizeFallback).join(", ")}`;
	const cssVarName = options.variable ? sanitizeCSSVarName(options.variable) : void 0;
	const variableClassName = `__variable_local_${id}`;
	const style = singleSource ? resolveSingleFaceStyle({
		fontFamily,
		weight: singleSource.weight ?? options.weight,
		style: singleSource.style ?? options.style
	}) : { fontFamily };
	collectFontPreloads(sources);
	injectFontFaceCSS(generateFontFaceCSS(family, options, sources), className);
	injectClassNameRule(className, style);
	if (cssVarName) injectVariableClassRule(variableClassName, cssVarName, fontFamily);
	return {
		className,
		style,
		...cssVarName ? { variable: variableClassName } : {}
	};
}
//#endregion
export { localFont as default, getSSRFontPreloads, getSSRFontStyles };
