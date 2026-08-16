"use client";
import { escapeInlineContent } from "./head.js";
import { useScriptNonce } from "./script-nonce-context.js";
import { hasAppNavigationRuntimeBootstrap } from "../client/navigation-runtime.js";
import { useBeforeInteractiveRegister } from "./before-interactive-context.js";
import React, { useEffect, useRef } from "react";
import * as ReactDOM from "react-dom";
//#region src/shims/script.tsx
/**
* next/script shim
*
* Provides the <Script> component for loading third-party scripts with
* configurable loading strategies.
*
* Strategies:
*   - "beforeInteractive": rendered as a <script> tag in SSR output
*   - "afterInteractive" (default): loaded client-side after hydration
*   - "lazyOnload": deferred until window.load + requestIdleCallback
*   - "worker": sets type="text/partytown" (requires Partytown setup)
*/
const loadedScripts = /* @__PURE__ */ new Set();
const loadingScripts = /* @__PURE__ */ new Map();
function getClientAutoNonce() {
	if (typeof document === "undefined") return void 0;
	const existingNonceElement = document.querySelector("[nonce]");
	if (!existingNonceElement) return void 0;
	if (typeof HTMLElement !== "undefined" && existingNonceElement instanceof HTMLElement) return existingNonceElement.nonce || existingNonceElement.getAttribute("nonce") || void 0;
	return existingNonceElement.getAttribute("nonce") || void 0;
}
function resolveScriptNonce(explicitNonce, contextualNonce) {
	if (typeof explicitNonce === "string" && explicitNonce.length > 0) return explicitNonce;
	if (typeof contextualNonce === "string" && contextualNonce.length > 0) return contextualNonce;
	if (typeof window === "undefined") return;
	return getClientAutoNonce();
}
/**
* Insert `<link rel="stylesheet">` tags into `document.head` for each entry
* in `stylesheets`. Used by the imperative client-side load path
* (`handleClientScriptLoad`) when `ReactDOM.preinit` is not available
* (e.g. pre-Float React or hosts that strip it). Mirrors Next.js's
* `insertStylesheets` Pages-Router fallback at
* `.nextjs-ref/packages/next/src/client/script.tsx:48-59`.
*
* The `ReactDOM.preinit` path is preferred where available — it dedupes
* across mounts and respects React Float's hoisting order. This DOM
* fallback is best-effort: no dedupe, no ordering guarantee.
*/
function insertClientStylesheets(stylesheets) {
	if (!stylesheets || stylesheets.length === 0) return;
	if (typeof document === "undefined") return;
	if (typeof ReactDOM.preinit === "function") {
		for (const href of stylesheets) ReactDOM.preinit(href, { as: "style" });
		return;
	}
	const head = document.head;
	if (!head) return;
	for (const href of stylesheets) {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = href;
		head.appendChild(link);
	}
}
/**
* Emit `<link rel="stylesheet">` tags during SSR for each entry in
* `stylesheets` via `ReactDOM.preinit`. React Float hoists these into
* `<head>` in the streamed HTML. Mirrors the App-Router branch of
* Next.js's Script component at `.nextjs-ref/packages/next/src/client/script.tsx:309-313`.
*/
function preinitStylesheetsForSSR(stylesheets) {
	if (!stylesheets || stylesheets.length === 0) return;
	if (typeof ReactDOM.preinit !== "function") return;
	for (const href of stylesheets) ReactDOM.preinit(href, { as: "style" });
}
function buildBeforeInteractiveScriptProps(options) {
	const scriptProps = { ...options.rest };
	if (options.src) scriptProps.src = options.src;
	if (options.id) scriptProps.id = options.id;
	if (options.resolvedNonce) scriptProps.nonce = options.resolvedNonce;
	if (options.dangerouslySetInnerHTML) scriptProps.dangerouslySetInnerHTML = { __html: escapeInlineContent(stringifyInlineContent(options.dangerouslySetInnerHTML.__html), "script") };
	return scriptProps;
}
function stringifyInlineContent(value) {
	return String(value);
}
/**
* Extract the inline script content for a `beforeInteractive` Script element
* with no `src`. Returns `null` when the element has neither a string-shaped
* `children` value nor a valid `dangerouslySetInnerHTML.__html` payload — in
* that case the caller should fall through to React's regular rendering path.
*
* The returned string is the raw author-supplied JavaScript content. Callers
* are responsible for passing it through `escapeInlineContent(..., "script")`
* before emitting it inside a `<script>` tag (we keep that escape adjacent
* to the emit point so the rule is obvious at the boundary).
*/
function extractBeforeInteractiveInlineContent(children, dangerouslySetInnerHTML) {
	if (dangerouslySetInnerHTML && stringifyInlineContent(dangerouslySetInnerHTML.__html).length > 0) return stringifyInlineContent(dangerouslySetInnerHTML.__html);
	if (typeof children === "string" && children.length > 0) return children;
	if (Array.isArray(children) && children.every((c) => typeof c === "string")) {
		const joined = children.join("");
		return joined.length > 0 ? joined : null;
	}
	return null;
}
/**
* Map of React DOM prop names to their HTML attribute equivalents. Mirrors
* Next.js's `set-attributes-from-props.ts`:
*   .nextjs-ref/packages/next/src/client/set-attributes-from-props.ts
* HTML parses attribute names case-insensitively, so without this translation
* `className="foo"` round-trips as `classname="foo"` and CSS selectors on
* `.foo` never match. Same hazard for `htmlFor`/`for`, `httpEquiv`/`http-equiv`,
* `acceptCharset`/`accept-charset`.
*/
const REACT_TO_HTML_ATTR = {
	acceptCharset: "accept-charset",
	className: "class",
	crossOrigin: "crossorigin",
	htmlFor: "for",
	httpEquiv: "http-equiv",
	referrerPolicy: "referrerpolicy"
};
/**
* Convert the residual `<Script>` props into a plain string-attributes record
* for emission inside a hoisted `<script>` tag. Drops React-only props
* (event handlers, children, etc.) and reserved keys already handled by the
* pre-head-injection emitter (id, nonce). Skips `undefined`/`null` so they
* round-trip as "attribute absent" rather than `attr="undefined"`.
*
* React DOM prop names (className, htmlFor, etc.) are translated to their
* HTML attribute names so the output parses correctly — see comment on
* `REACT_TO_HTML_ATTR`.
*/
function collectBeforeInteractiveAttributes(rest) {
	const RESERVED = /* @__PURE__ */ new Set([
		"id",
		"nonce",
		"src",
		"children",
		"strategy",
		"dangerouslySetInnerHTML",
		"onLoad",
		"onReady",
		"onError",
		"stylesheets"
	]);
	const out = {};
	for (const [key, value] of Object.entries(rest)) {
		if (RESERVED.has(key)) continue;
		if (value === void 0 || value === null || value === false) continue;
		const attrName = REACT_TO_HTML_ATTR[key] ?? key;
		if (typeof value === "boolean") {
			out[attrName] = true;
			continue;
		}
		if (typeof value === "string" || typeof value === "number") {
			out[attrName] = String(value);
			continue;
		}
	}
	return out;
}
function setBooleanScriptAttribute(el, attr, value) {
	const enabled = value !== false && value !== "false" && Boolean(value);
	switch (attr) {
		case "async":
			el.async = enabled;
			break;
		case "defer":
			el.defer = enabled;
			break;
		case "noModule":
		case "nomodule":
			el.noModule = enabled;
			break;
		default: return false;
	}
	if (!enabled) {
		el.setAttribute(attr, "");
		el.removeAttribute(attr);
	}
	return true;
}
function setScriptAttributes(el, rest) {
	for (const [attr, value] of Object.entries(rest)) {
		if (attr === "dangerouslySetInnerHTML") continue;
		if (value === void 0) continue;
		if (setBooleanScriptAttribute(el, attr, value)) continue;
		if (attr === "className" && typeof value === "string") el.setAttribute("class", value);
		else if (typeof value === "string") el.setAttribute(attr, value);
		else if (typeof value === "boolean" && value) el.setAttribute(attr, "");
	}
}
function loadClientScript(props, options) {
	const { src, id, onLoad, onReady, onError, strategy = "afterInteractive", children, dangerouslySetInnerHTML, stylesheets, ...rest } = props;
	if (typeof window === "undefined") return;
	insertClientStylesheets(stylesheets);
	const key = id ?? src ?? "";
	if (key && loadedScripts.has(key)) {
		if (options.fireReadyWhenAlreadyLoaded) onReady?.();
		return;
	}
	if (src) {
		const existingLoad = loadingScripts.get(src);
		if (existingLoad) {
			existingLoad.then((event) => {
				if (key) loadedScripts.add(key);
				onLoad?.(event);
				onReady?.();
			}, (event) => onError?.(event));
			return;
		}
	}
	const el = document.createElement("script");
	if (src) el.src = src;
	if (id) el.id = id;
	setScriptAttributes(el, rest);
	if (options.resolvedNonce && !el.getAttribute("nonce")) el.setAttribute("nonce", options.resolvedNonce);
	if (strategy === "worker") el.setAttribute("type", "text/partytown");
	const markLoaded = () => {
		if (key) loadedScripts.add(key);
		onReady?.();
	};
	if (dangerouslySetInnerHTML?.__html) {
		el.innerHTML = stringifyInlineContent(dangerouslySetInnerHTML.__html);
		markLoaded();
	} else if (children && typeof children === "string") {
		el.textContent = children;
		markLoaded();
	} else if (src) {
		const loadPromise = new Promise((resolve, reject) => {
			el.addEventListener("load", (event) => {
				resolve(event);
				if (key) loadedScripts.add(key);
				onLoad?.(event);
				onReady?.();
			});
			el.addEventListener("error", (event) => {
				reject(event);
				onError?.(event);
			});
		});
		loadPromise.catch(() => void 0).finally(() => loadingScripts.delete(src));
		loadingScripts.set(src, loadPromise);
	}
	document.body.appendChild(el);
}
/**
* Load a script imperatively (outside of React).
*/
function handleClientScriptLoad(props) {
	loadClientScript(props, {
		resolvedNonce: resolveScriptNonce(props.nonce),
		fireReadyWhenAlreadyLoaded: false
	});
}
/**
* Initialize multiple scripts at once (called during app bootstrap).
*/
function initScriptLoader(scripts) {
	for (const script of scripts) handleClientScriptLoad(script);
}
function Script(props) {
	const { src, id, strategy = "afterInteractive", onLoad, onReady, onError, children, dangerouslySetInnerHTML, stylesheets, ...rest } = props;
	const hasMounted = useRef(false);
	const key = id ?? src ?? "";
	const contextualNonce = useScriptNonce();
	const resolvedNonce = resolveScriptNonce(rest.nonce, contextualNonce);
	const registerBeforeInteractive = useBeforeInteractiveRegister();
	useEffect(() => {
		if (hasMounted.current) return;
		hasMounted.current = true;
		if (strategy === "beforeInteractive") {
			insertClientStylesheets(stylesheets);
			return;
		}
		if (key && loadedScripts.has(key)) {
			insertClientStylesheets(stylesheets);
			onReady?.();
			return;
		}
		const load = () => {
			if (key && loadedScripts.has(key)) {
				onReady?.();
				return;
			}
			loadClientScript({
				src,
				id,
				strategy,
				onLoad,
				onReady,
				onError,
				children,
				dangerouslySetInnerHTML,
				stylesheets,
				...rest
			}, {
				resolvedNonce,
				fireReadyWhenAlreadyLoaded: true
			});
		};
		if (strategy === "lazyOnload") if (document.readyState === "complete") if (typeof requestIdleCallback === "function") requestIdleCallback(load);
		else setTimeout(load, 1);
		else window.addEventListener("load", () => {
			if (typeof requestIdleCallback === "function") requestIdleCallback(load);
			else setTimeout(load, 1);
		});
		else load();
	}, [
		src,
		id,
		strategy,
		onLoad,
		onReady,
		onError,
		children,
		dangerouslySetInnerHTML,
		stylesheets,
		key,
		resolvedNonce,
		rest
	]);
	if (typeof window === "undefined") {
		preinitStylesheetsForSSR(stylesheets);
		if (src && typeof ReactDOM.preload === "function" && (strategy === "afterInteractive" || strategy === "beforeInteractive")) {
			const integrity = typeof rest.integrity === "string" ? rest.integrity : void 0;
			const preloadOptions = {
				as: "script",
				crossOrigin: rest.crossOrigin === "anonymous" || rest.crossOrigin === "use-credentials" ? rest.crossOrigin : void 0
			};
			if (resolvedNonce !== void 0) preloadOptions.nonce = resolvedNonce;
			if (integrity !== void 0) preloadOptions.integrity = integrity;
			ReactDOM.preload(src, preloadOptions);
		}
		if (strategy === "beforeInteractive") {
			const inlineContent = src ? null : extractBeforeInteractiveInlineContent(children, dangerouslySetInnerHTML);
			if ((src || inlineContent !== null) && registerBeforeInteractive) {
				registerBeforeInteractive({
					id,
					src: src ?? void 0,
					innerHTML: inlineContent !== null ? escapeInlineContent(inlineContent, "script") : void 0,
					nonce: resolvedNonce,
					attributes: collectBeforeInteractiveAttributes(rest)
				});
				return null;
			}
			return React.createElement("script", buildBeforeInteractiveScriptProps({
				src,
				id,
				rest,
				resolvedNonce,
				dangerouslySetInnerHTML
			}), children);
		}
		return null;
	}
	if (strategy === "beforeInteractive") {
		const inlineContent = src ? null : extractBeforeInteractiveInlineContent(children, dangerouslySetInnerHTML);
		if ((src || inlineContent !== null) && hasAppNavigationRuntimeBootstrap()) return null;
		return React.createElement("script", buildBeforeInteractiveScriptProps({
			src,
			id,
			rest,
			resolvedNonce,
			dangerouslySetInnerHTML
		}), children);
	}
	return null;
}
//#endregion
export { Script as default, handleClientScriptLoad, initScriptLoader };
