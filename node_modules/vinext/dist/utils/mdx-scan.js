import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/utils/mdx-scan.ts
/** Module-level cache for hasMdxFiles — avoids re-scanning per Vite environment. */
const mdxScanCache = /* @__PURE__ */ new Map();
/**
* Check if the project has .mdx files in app/ or pages/ directories.
*/
function hasMdxFiles(root, appDir, pagesDir) {
	const cacheKey = `${root}\0${appDir ?? ""}\0${pagesDir ?? ""}`;
	if (mdxScanCache.has(cacheKey)) return mdxScanCache.get(cacheKey);
	const dirs = [appDir, pagesDir].filter(Boolean);
	for (const dir of dirs) if (fs.existsSync(dir) && scanDirForMdx(dir)) {
		mdxScanCache.set(cacheKey, true);
		return true;
	}
	mdxScanCache.set(cacheKey, false);
	return false;
}
function scanDirForMdx(dir) {
	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (scanDirForMdx(full)) return true;
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) return true;
		}
	} catch {}
	return false;
}
//#endregion
export { hasMdxFiles, mdxScanCache };
