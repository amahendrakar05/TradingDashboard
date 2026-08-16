import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { isUnknownRecord } from "./record.js";
import { manifestFileWithBase } from "./manifest-paths.js";
import fs from "node:fs";
//#region src/utils/client-entry-manifest.ts
const VINEXT_CLIENT_ENTRY_MANIFEST = "vinext-client-entry-manifest.json";
function readClientEntryManifest(clientDir) {
	const manifestPath = path.join(clientDir, VINEXT_CLIENT_ENTRY_MANIFEST);
	if (!fs.existsSync(manifestPath)) return void 0;
	try {
		const value = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
		if (!isUnknownRecord(value)) return void 0;
		const manifest = {};
		if (typeof value.pagesClientEntry === "string") manifest.pagesClientEntry = value.pagesClientEntry;
		if (typeof value.appBrowserEntry === "string") manifest.appBrowserEntry = value.appBrowserEntry;
		return manifest.pagesClientEntry || manifest.appBrowserEntry ? manifest : void 0;
	} catch {
		return;
	}
}
function findClientEntryFileFromVinextManifest(manifest, assetBase) {
	const entry = manifest?.pagesClientEntry ?? manifest?.appBrowserEntry;
	return entry ? manifestFileWithBase(entry, assetBase) : void 0;
}
function findPagesClientEntryFileFromVinextManifest(manifest, assetBase) {
	return manifest?.pagesClientEntry ? manifestFileWithBase(manifest.pagesClientEntry, assetBase) : void 0;
}
//#endregion
export { VINEXT_CLIENT_ENTRY_MANIFEST, findClientEntryFileFromVinextManifest, findPagesClientEntryFileFromVinextManifest, readClientEntryManifest };
