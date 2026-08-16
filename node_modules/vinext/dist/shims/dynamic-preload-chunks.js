"use client";
import { appendAssetDeploymentIdQuery } from "../utils/deployment-id.js";
import { useScriptNonce } from "./script-nonce-context.js";
import React from "react";
import * as ReactDOM from "react-dom";
import { getPagesClientAssets } from "vinext/server/pages-client-assets";
//#region src/shims/dynamic-preload-chunks.tsx
/**
* Preload links for rendered next/dynamic() boundaries.
*
* This MUST be a "use client" component. next/dynamic() can be called from
* either a Server Component or a Client Component. If this rendered in the
* environment of the call site, a Server-Component call site would render it in
* the RSC environment, where the script-nonce React context is unavailable
* (createContext is not callable in react-server), so emitted preload links
* would drop the request CSP nonce — a CSP violation under
* `script-src 'nonce-…' 'strict-dynamic'`.
*
* Marking it "use client" forces it into the SSR pass (where vinext installs
* the ScriptNonceProvider via withScriptNonce()), so the nonce is available
* regardless of whether the dynamic() call site is a Server or Client
* Component. This mirrors Next.js's <PreloadChunks> ('use client') and vinext's
* own next/script shim.
*
* Deliberate divergence from Next.js: for CSS we render
* `<link rel="stylesheet">` WITHOUT `as="style"`. Next.js emits `as="style"`,
* but per the HTML spec `as` is only meaningful on `rel="preload"`/`modulepreload`
* — on `rel="stylesheet"` it is ignored by browsers and is semantically wrong.
* React keys stylesheet resources on href + precedence, not `as`, so omitting it
* is safe. This is an intentional, documented difference, not a parity bug.
*/
function dynamicPreloadHref(file) {
	if (file.startsWith("/") || file.startsWith("http://") || file.startsWith("https://") || file.startsWith("//")) return file;
	return `/${file}`;
}
function resolveDynamicPreloadFiles(moduleIds) {
	if (!moduleIds || moduleIds.length === 0) return [];
	const preloadMap = getPagesClientAssets().dynamicPreloads;
	if (!preloadMap) return [];
	const files = [];
	const seen = /* @__PURE__ */ new Set();
	for (const moduleId of moduleIds) for (const file of preloadMap[moduleId] ?? []) {
		if (seen.has(file)) continue;
		seen.add(file);
		files.push(file);
	}
	return files;
}
function DynamicPreloadChunks(props) {
	const nonce = useScriptNonce();
	if (typeof window !== "undefined") return null;
	const files = resolveDynamicPreloadFiles(props.moduleIds);
	if (files.length === 0) return null;
	const stylesheets = [];
	for (const file of files) {
		const assetHref = dynamicPreloadHref(file);
		if (assetHref.endsWith(".css")) {
			const href = appendAssetDeploymentIdQuery(assetHref);
			stylesheets.push(React.createElement("link", {
				key: href,
				rel: "stylesheet",
				href,
				nonce,
				precedence: "dynamic"
			}));
			continue;
		}
		if (assetHref.endsWith(".js") && typeof ReactDOM.preload === "function") {
			const preloadOptions = {
				as: "script",
				fetchPriority: "low",
				nonce
			};
			ReactDOM.preload(assetHref, preloadOptions);
		}
	}
	return stylesheets.length > 0 ? React.createElement(React.Fragment, null, ...stylesheets) : null;
}
//#endregion
export { DynamicPreloadChunks };
