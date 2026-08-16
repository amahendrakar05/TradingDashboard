import { appendDeploymentIdQuery } from "../utils/deployment-id.js";
import { createNonceAttribute } from "./html.js";
import { assetServingUrlFromBaseAnchored } from "../utils/manifest-paths.js";
import { getPagesClientAssets } from "./pages-client-assets.js";
//#region src/server/pages-asset-tags.ts
/**
* Pages Router SSR asset-tag helpers.
*
* Builds the `<link rel="modulepreload">`, `<link rel="stylesheet">`, and
* `<script type="module">` tags injected into the SSR HTML response.
*
* Extracted from `entries/pages-server-entry.ts` so the logic is
* unit-testable and lives in a normal typed module rather than a codegen
* template string.
*/
/**
* Resolve the effective SSR manifest: prefer the caller-supplied object and
* fall back to the registered client build metadata.
*/
function resolveSsrManifest(manifest) {
	if (manifest && Object.keys(manifest).length > 0) return manifest;
	return getPagesClientAssets().ssrManifest ?? null;
}
/**
* Look up the asset-file list for a module ID in the SSR manifest.
*
* The manifest keys may use relative paths while callers supply absolute
* paths, so a suffix-match fallback is used when an exact-key lookup fails.
*/
function getManifestFilesForModule(manifest, moduleId) {
	if (!manifest || !moduleId) return null;
	const files = manifest[moduleId];
	if (files) return files;
	for (const key in manifest) if (moduleId.endsWith("/" + key) || moduleId === key) return manifest[key];
	return null;
}
/**
* Find the first `.js` file in the manifest for `moduleId` and return the URL it
* is actually SERVED from. Used to resolve the client-navigation / hydration URL
* for the matched page or the `_app` module (it is `import()`ed on the client),
* so it must point at the served location: `assetPrefix` replaces `basePath` for
* asset URLs. SSR-manifest values are base-anchored; re-anchor under any
* configured `assetPrefix` (default `""` keeps the legacy `"/" + file`).
*/
function resolveClientModuleUrl(manifest, moduleId, basePath = "", assetPrefix = "", _deploymentId) {
	const files = getManifestFilesForModule(resolveSsrManifest(manifest), moduleId);
	if (!files) return void 0;
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (!file || !file.endsWith(".js")) continue;
		return assetServingUrlFromBaseAnchored(file, basePath, assetPrefix);
	}
}
/**
* Build the HTML `<link>` and `<script>` tag string for the SSR response.
*
* Mirrors Next.js `_document` behaviour:
* - CSS files → `<link rel="stylesheet">`.
* - JS files → `<link rel="modulepreload">` + `<script type="module" defer>`.
* - Lazy chunks (behind `React.lazy` / `next/dynamic`) are skipped.
* - The registered client-entry bootstrap is injected first.
* - Shared framework / vinext runtime chunks are always included alongside
*   page-specific chunks.
*
* Extracted from `entries/pages-server-entry.ts`.
*/
function collectAssetTags(options) {
	const m = resolveSsrManifest(options.manifest);
	const tags = [];
	const seen = /* @__PURE__ */ new Set();
	const nonceAttr = createNonceAttribute(options.scriptNonce);
	const deferAttr = options.disableOptimizedLoading ? "" : " defer";
	const basePath = options.basePath ?? "";
	const assetPrefix = options.assetPrefix ?? "";
	const href = (value) => {
		const url = assetServingUrlFromBaseAnchored(value, basePath, assetPrefix);
		return value.endsWith(".js") ? url : appendDeploymentIdQuery(url, options.deploymentId);
	};
	const runtimeAssets = getPagesClientAssets();
	const lazyChunks = runtimeAssets.lazyChunks ?? null;
	const lazySet = lazyChunks && lazyChunks.length > 0 ? new Set(lazyChunks) : null;
	const clientEntry = runtimeAssets.clientEntry;
	if (clientEntry) {
		seen.add(clientEntry);
		tags.push("<link rel=\"modulepreload\"" + nonceAttr + " href=\"" + href(clientEntry) + "\" />");
		tags.push("<script type=\"module\"" + deferAttr + nonceAttr + " src=\"" + href(clientEntry) + "\" crossorigin><\/script>");
	}
	if (m) {
		const allFiles = [];
		const moduleIds = options.moduleIds;
		if (moduleIds && moduleIds.length > 0) {
			for (let mi = 0; mi < moduleIds.length; mi++) {
				const id = moduleIds[mi];
				const files = getManifestFilesForModule(m, id);
				if (files) for (let fi = 0; fi < files.length; fi++) allFiles.push(files[fi]);
			}
			for (const key in m) {
				const vals = m[key];
				if (!vals) continue;
				for (let vi = 0; vi < vals.length; vi++) {
					const file = vals[vi];
					const basename = file.split("/").pop() || "";
					if (basename.startsWith("framework-") || basename.startsWith("vinext-") || basename.includes("vinext-client-entry") || basename.includes("vinext-app-browser-entry")) allFiles.push(file);
				}
			}
		} else for (const akey in m) {
			const avals = m[akey];
			if (avals) for (let ai = 0; ai < avals.length; ai++) allFiles.push(avals[ai]);
		}
		for (let ti = 0; ti < allFiles.length; ti++) {
			let tf = allFiles[ti];
			if (tf.charAt(0) === "/") tf = tf.slice(1);
			if (seen.has(tf)) continue;
			seen.add(tf);
			if (tf.endsWith(".css")) tags.push("<link rel=\"stylesheet\"" + nonceAttr + " href=\"" + href(tf) + "\" />");
			else if (tf.endsWith(".js")) {
				if (lazySet && lazySet.has(tf)) continue;
				tags.push("<link rel=\"modulepreload\"" + nonceAttr + " href=\"" + href(tf) + "\" />");
				tags.push("<script type=\"module\"" + deferAttr + nonceAttr + " src=\"" + href(tf) + "\" crossorigin><\/script>");
			}
		}
	}
	return tags.join("\n  ");
}
//#endregion
export { collectAssetTags, getManifestFilesForModule, resolveClientModuleUrl, resolveSsrManifest };
