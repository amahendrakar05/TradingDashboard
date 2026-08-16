import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { isUnknownRecord } from "./record.js";
import { manifestFileWithBase } from "./manifest-paths.js";
import fs from "node:fs";
//#region src/utils/client-build-manifest.ts
const PAGES_CLIENT_ENTRY_MARKERS = ["vinext-client-entry"];
const CLIENT_ENTRY_MARKERS = [...PAGES_CLIENT_ENTRY_MARKERS, "vinext-app-browser-entry"];
function readClientBuildManifest(manifestPath) {
	if (!fs.existsSync(manifestPath)) return void 0;
	try {
		const value = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
		if (!isUnknownRecord(value)) return void 0;
		const manifest = {};
		for (const [key, entry] of Object.entries(value)) {
			if (!isUnknownRecord(entry) || typeof entry.file !== "string") continue;
			const imports = readStringArray(entry.imports);
			const dynamicImports = readStringArray(entry.dynamicImports);
			const css = readStringArray(entry.css);
			const assets = readStringArray(entry.assets);
			manifest[key] = {
				file: entry.file,
				...entry.isEntry === true ? { isEntry: true } : {},
				...entry.isDynamicEntry === true ? { isDynamicEntry: true } : {},
				...imports ? { imports } : {},
				...dynamicImports ? { dynamicImports } : {},
				...css ? { css } : {},
				...assets ? { assets } : {}
			};
		}
		return manifest;
	} catch {
		return;
	}
}
function findClientEntryFileFromManifest(buildManifest, assetBase) {
	return findEntryFileFromManifest(buildManifest, assetBase, CLIENT_ENTRY_MARKERS, true);
}
function findPagesClientEntryFileFromManifest(buildManifest, assetBase) {
	return findEntryFileFromManifest(buildManifest, assetBase, PAGES_CLIENT_ENTRY_MARKERS, false);
}
function findEntryFileFromManifest(buildManifest, assetBase, markers, fallbackToFirstEntry) {
	const entries = Object.values(buildManifest).filter((entry) => entry.isEntry && entry.file);
	for (const marker of markers) {
		const markedEntry = entries.find((entry) => entry.file.includes(marker));
		if (markedEntry) return manifestFileWithBase(markedEntry.file, assetBase);
	}
	const chosen = fallbackToFirstEntry ? entries[0] : void 0;
	return chosen ? manifestFileWithBase(chosen.file, assetBase) : void 0;
}
function listFilesRecursive(dir) {
	const out = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listFilesRecursive(full));
		else if (entry.isFile()) out.push(full);
	}
	return out;
}
function findClientEntryFileInAssetsDir(options) {
	const assetsDir = path.join(options.clientDir, options.assetsSubdir);
	if (!fs.existsSync(assetsDir)) return void 0;
	const files = listFilesRecursive(assetsDir);
	let entryFull;
	for (const marker of options.markers) {
		entryFull = files.find((file) => path.basename(file).includes(marker) && file.endsWith(".js"));
		if (entryFull) break;
	}
	if (!entryFull) return void 0;
	return manifestFileWithBase(path.relative(options.clientDir, entryFull), options.assetBase);
}
function findClientEntryFile(options) {
	return (options.buildManifest ? findClientEntryFileFromManifest(options.buildManifest, options.assetBase) : void 0) ?? findClientEntryFileInAssetsDir({
		...options,
		markers: CLIENT_ENTRY_MARKERS
	});
}
function findPagesClientEntryFile(options) {
	return (options.buildManifest ? findPagesClientEntryFileFromManifest(options.buildManifest, options.assetBase) : void 0) ?? findClientEntryFileInAssetsDir({
		...options,
		markers: PAGES_CLIENT_ENTRY_MARKERS
	});
}
function readStringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : void 0;
}
//#endregion
export { findClientEntryFile, findClientEntryFileFromManifest, findPagesClientEntryFile, findPagesClientEntryFileFromManifest, readClientBuildManifest };
