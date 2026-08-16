import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { collapseDuplicateBase, manifestFileWithBase } from "../utils/manifest-paths.js";
import fs from "node:fs";
//#region src/build/ssr-manifest.ts
/**
* Realpath with NATIVE separators (backslashes on Windows). Callers apply
* `toSlash` where the result becomes a module id / manifest key.
*/
function tryRealpathSync(candidate) {
	try {
		return fs.realpathSync.native(candidate);
	} catch {
		return null;
	}
}
function isWindowsAbsolutePath(candidate) {
	return /^[a-zA-Z]:[\\/]/.test(candidate) || candidate.startsWith("\\\\");
}
function relativeWithinRoot(root, moduleId) {
	const relativeId = isWindowsAbsolutePath(root) || isWindowsAbsolutePath(moduleId) ? path.win32.relative(root, moduleId) : path.relative(root, moduleId);
	if (!relativeId || relativeId === ".." || relativeId.startsWith("../")) return null;
	return relativeId;
}
function normalizeManifestModuleId(moduleId, root) {
	const normalizedId = toSlash(moduleId);
	if (normalizedId.startsWith("\0")) return normalizedId;
	if (normalizedId.startsWith("node_modules/") || normalizedId.includes("/node_modules/")) return normalizedId;
	if (!isWindowsAbsolutePath(moduleId) && !path.isAbsolute(moduleId)) {
		if (!normalizedId.startsWith(".") && !normalizedId.includes("../")) return normalizedId;
	}
	const rootCandidates = /* @__PURE__ */ new Set([root]);
	const realRoot = tryRealpathSync(root);
	if (realRoot) rootCandidates.add(toSlash(realRoot));
	const moduleCandidates = /* @__PURE__ */ new Set();
	if (isWindowsAbsolutePath(moduleId) || path.isAbsolute(moduleId)) moduleCandidates.add(moduleId);
	else moduleCandidates.add(path.resolve(root, moduleId));
	for (const candidate of moduleCandidates) {
		const realCandidate = tryRealpathSync(candidate);
		if (realCandidate) moduleCandidates.add(toSlash(realCandidate));
	}
	for (const rootCandidate of rootCandidates) for (const moduleCandidate of moduleCandidates) {
		const relativeId = relativeWithinRoot(rootCandidate, moduleCandidate);
		if (relativeId) return relativeId;
	}
	return normalizedId;
}
function augmentSsrManifestFromBundle(ssrManifest, bundle, root, base = "/") {
	const nextManifest = {};
	for (const [key, files] of Object.entries(ssrManifest)) {
		const normalizedKey = normalizeManifestModuleId(key, root);
		if (!nextManifest[normalizedKey]) nextManifest[normalizedKey] = /* @__PURE__ */ new Set();
		for (const file of files) nextManifest[normalizedKey].add(collapseDuplicateBase(file, base));
	}
	for (const item of Object.values(bundle)) {
		if (item.type !== "chunk") continue;
		const chunk = item;
		const files = /* @__PURE__ */ new Set();
		files.add(manifestFileWithBase(chunk.fileName, base));
		for (const importedFile of chunk.imports ?? []) files.add(manifestFileWithBase(importedFile, base));
		for (const cssFile of chunk.viteMetadata?.importedCss ?? []) files.add(manifestFileWithBase(cssFile, base));
		for (const assetFile of chunk.viteMetadata?.importedAssets ?? []) files.add(manifestFileWithBase(assetFile, base));
		for (const moduleId of Object.keys(chunk.modules ?? {})) {
			const key = normalizeManifestModuleId(moduleId, root);
			if (key.startsWith("node_modules/") || key.includes("/node_modules/")) continue;
			if (key.startsWith("\0")) continue;
			if (!nextManifest[key]) nextManifest[key] = /* @__PURE__ */ new Set();
			for (const file of files) nextManifest[key].add(file);
		}
	}
	return Object.fromEntries(Object.entries(nextManifest).map(([key, files]) => [key, [...files]]));
}
//#endregion
export { augmentSsrManifestFromBundle, relativeWithinRoot, tryRealpathSync };
