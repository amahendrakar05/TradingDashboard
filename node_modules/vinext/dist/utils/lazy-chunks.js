//#region src/utils/lazy-chunks.ts
/**
* Compute the set of chunk filenames that are ONLY reachable through dynamic
* imports (i.e. behind React.lazy(), next/dynamic, or manual import()).
*
* These chunks should NOT be modulepreloaded in the HTML — they will be
* fetched on demand when the dynamic import executes.
*
* Algorithm: Starting from all entry chunks in the build manifest, walk the
* static `imports` tree (breadth-first). Any chunk file NOT reached by this
* walk is only reachable through `dynamicImports` and is therefore "lazy".
*
* @param buildManifest - Vite's build manifest (manifest.json), which is a
*   Record<string, ManifestChunk> where each chunk has `file`, `imports`,
*   `dynamicImports`, `isEntry`, and `isDynamicEntry` fields.
* @returns Array of chunk filenames (e.g. "_next/static/mermaid-NOHMQCX5.js") that
*   should be excluded from modulepreload hints.
*/
function computeLazyChunks(buildManifest) {
	const eagerFiles = /* @__PURE__ */ new Set();
	const visited = /* @__PURE__ */ new Set();
	const queue = [];
	for (const key of Object.keys(buildManifest)) if (buildManifest[key].isEntry) queue.push(key);
	while (queue.length > 0) {
		const key = queue.shift();
		if (!key || visited.has(key)) continue;
		visited.add(key);
		const chunk = buildManifest[key];
		if (!chunk) continue;
		eagerFiles.add(chunk.file);
		if (chunk.css) for (const cssFile of chunk.css) eagerFiles.add(cssFile);
		if (chunk.imports) {
			for (const imp of chunk.imports) if (!visited.has(imp)) queue.push(imp);
		}
	}
	const lazyChunks = [];
	const allFiles = /* @__PURE__ */ new Set();
	for (const key of Object.keys(buildManifest)) {
		const chunk = buildManifest[key];
		if (chunk.file && !allFiles.has(chunk.file)) {
			allFiles.add(chunk.file);
			if (!eagerFiles.has(chunk.file) && chunk.file.endsWith(".js")) lazyChunks.push(chunk.file);
		}
	}
	return lazyChunks;
}
function normalizeManifestKey(key) {
	return key.split("?")[0].replace(/\\/g, "/").replace(/^\/+/, "");
}
function addFile(files, seen, file) {
	if (!file || seen.has(file)) return;
	seen.add(file);
	files.push(file);
}
function collectStaticChunkFiles(buildManifest, key, files, seenFiles, visitedChunks) {
	if (visitedChunks.has(key)) return;
	visitedChunks.add(key);
	const chunk = buildManifest[key];
	if (!chunk) return;
	if (chunk.file.endsWith(".js")) addFile(files, seenFiles, chunk.file);
	for (const cssFile of chunk.css ?? []) addFile(files, seenFiles, cssFile);
	for (const importedKey of chunk.imports ?? []) collectStaticChunkFiles(buildManifest, importedKey, files, seenFiles, visitedChunks);
}
/**
* Compute the production preload files for each module referenced by a
* `next/dynamic()` boundary.
*
* Next.js records module IDs during compilation, then resolves those IDs
* against its react-loadable manifest at render time. Vinext's equivalent
* source of truth is Vite's build manifest: each chunk lists the modules it
* reaches through `dynamicImports`, and each dynamic entry lists the JS/CSS
* files required to evaluate it.
*
* Note on shared chunks: a boundary's static-import tree (`collectStaticChunkFiles`)
* can include chunks that the page entry ALSO loads eagerly (a shared vendor
* chunk imported by both). Those files are intentionally NOT subtracted here, so
* a rendered boundary may emit a `<link rel="preload">` / `<link rel="stylesheet">`
* for a chunk the page already `<link rel="modulepreload">`s. This is harmless —
* the browser dedupes preloads by URL, `ReactDOM.preload()` dedupes script hints,
* and React's stylesheet resource model dedupes by href + precedence — and it
* mirrors Next.js listing a module's full file set in its react-loadable
* manifest. Subtracting the eager set would couple this to the entry's import
* closure for no correctness gain.
*
* @returns A map keyed by root-relative module ID, with JS/CSS files that
* should be preloaded when that dynamic boundary is rendered.
*/
function computeDynamicImportPreloads(buildManifest) {
	const preloads = {};
	for (const chunk of Object.values(buildManifest)) for (const dynamicKey of chunk.dynamicImports ?? []) {
		const files = [];
		collectStaticChunkFiles(buildManifest, dynamicKey, files, /* @__PURE__ */ new Set(), /* @__PURE__ */ new Set());
		if (files.length === 0) continue;
		const normalizedKey = normalizeManifestKey(dynamicKey);
		const existing = preloads[normalizedKey] ?? [];
		const merged = new Set(existing);
		for (const file of files) {
			if (merged.has(file)) continue;
			merged.add(file);
			existing.push(file);
		}
		preloads[normalizedKey] = existing;
	}
	return preloads;
}
function dynamicImportPreloadsWithBase(preloads, applyBase) {
	const withBase = {};
	for (const [key, files] of Object.entries(preloads)) withBase[key] = files.map(applyBase);
	return withBase;
}
//#endregion
export { computeDynamicImportPreloads, computeLazyChunks, dynamicImportPreloadsWithBase };
