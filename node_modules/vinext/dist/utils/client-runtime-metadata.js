import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { isAbsoluteAssetPrefix, resolveAssetsDir } from "./asset-prefix.js";
import { manifestFileWithAssetPrefix, manifestFileWithBase } from "./manifest-paths.js";
import { findClientEntryFile, findPagesClientEntryFile, readClientBuildManifest } from "./client-build-manifest.js";
import { findClientEntryFileFromVinextManifest, findPagesClientEntryFileFromVinextManifest, readClientEntryManifest } from "./client-entry-manifest.js";
import { computeDynamicImportPreloads, computeLazyChunks, dynamicImportPreloadsWithBase } from "./lazy-chunks.js";
//#region src/utils/client-runtime-metadata.ts
function collectAppBootstrapPreinitModules(buildManifest, appBrowserEntry, applyBase) {
	if (!appBrowserEntry) return void 0;
	const entryKey = Object.keys(buildManifest).find((key) => buildManifest[key].file === appBrowserEntry);
	if (!entryKey) return void 0;
	const modules = [];
	const seenFiles = /* @__PURE__ */ new Set();
	const visitedChunks = /* @__PURE__ */ new Set();
	function visit(key) {
		if (visitedChunks.has(key)) return;
		visitedChunks.add(key);
		const chunk = buildManifest[key];
		if (!chunk) return;
		for (const importedKey of chunk.imports ?? []) {
			const importedChunk = buildManifest[importedKey];
			if (importedChunk?.file.endsWith(".js") && !seenFiles.has(importedChunk.file)) {
				seenFiles.add(importedChunk.file);
				modules.push(applyBase(importedChunk.file));
			}
			visit(importedKey);
		}
	}
	visit(entryKey);
	return modules.length > 0 ? modules : void 0;
}
/**
* Read the client build manifest and compute runtime metadata used by
* Cloudflare worker entry injection and Node production server startup.
*
* - `lazyChunks` — chunks only reachable through dynamic `import()`, excluded
*   from modulepreload hints.
* - `dynamicPreloads` — per-module JS/CSS files for rendered `next/dynamic()`
*   boundaries, injected as preload links during SSR.
* - `clientEntryFile` — the client entry chunk filename (optional, only
*   needed for Pages Router).
*
* All file paths are normalised with the configured `assetBase` (basePath)
* and `assetPrefix`.
*/
function computeClientRuntimeMetadata(opts) {
	const buildManifest = readClientBuildManifest(path.join(opts.clientDir, ".vite", "manifest.json"));
	const clientEntryManifest = readClientEntryManifest(opts.clientDir);
	const metadata = {};
	if (opts.includeClientEntry) {
		const entryOptions = {
			buildManifest,
			clientDir: opts.clientDir,
			assetsSubdir: resolveAssetsDir(opts.assetPrefix),
			assetBase: opts.assetBase
		};
		const entry = opts.includeClientEntry === "pages-client-entry" ? findPagesClientEntryFileFromVinextManifest(clientEntryManifest, opts.assetBase) ?? findPagesClientEntryFile(entryOptions) : findClientEntryFileFromVinextManifest(clientEntryManifest, opts.assetBase) ?? findClientEntryFile(entryOptions);
		if (entry) metadata.clientEntryFile = entry;
	}
	if (!buildManifest) return metadata;
	metadata.appBootstrapPreinitModules = collectAppBootstrapPreinitModules(buildManifest, clientEntryManifest?.appBrowserEntry, (file) => {
		const url = manifestFileWithAssetPrefix(file, opts.assetBase, opts.assetPrefix);
		return isAbsoluteAssetPrefix(opts.assetPrefix) ? url : "/" + url;
	});
	const lazyChunks = computeLazyChunks(buildManifest).map((file) => manifestFileWithBase(file, opts.assetBase));
	if (lazyChunks.length > 0) metadata.lazyChunks = lazyChunks;
	const dynamicPreloads = dynamicImportPreloadsWithBase(computeDynamicImportPreloads(buildManifest), (file) => manifestFileWithAssetPrefix(file, opts.assetBase, opts.assetPrefix));
	if (Object.keys(dynamicPreloads).length > 0) metadata.dynamicPreloads = dynamicPreloads;
	return metadata;
}
//#endregion
export { computeClientRuntimeMetadata };
