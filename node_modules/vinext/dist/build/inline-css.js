import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { resolveAssetUrlPrefix, resolveAssetsDir } from "../utils/asset-prefix.js";
import fs from "node:fs";
//#region src/build/inline-css.ts
const INLINE_CSS_GLOBAL_MARKER = "globalThis.__VINEXT_INLINE_CSS__ = ";
function collectCssFiles(directory) {
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...collectCssFiles(filePath));
		else if (entry.isFile() && entry.name.endsWith(".css")) files.push(filePath);
	}
	return files;
}
function addPathnameAlias(manifest, href, css) {
	try {
		const url = new URL(href);
		manifest[url.pathname] = css;
	} catch {}
}
function collectInlineCssManifest(clientDir, assetPrefix) {
	const assetsDir = path.join(clientDir, resolveAssetsDir(assetPrefix));
	if (!fs.existsSync(assetsDir)) return {};
	const urlPrefix = resolveAssetUrlPrefix(assetPrefix);
	const manifest = {};
	for (const filePath of collectCssFiles(assetsDir)) {
		const href = `${urlPrefix}${path.relative(assetsDir, filePath)}`;
		const css = fs.readFileSync(filePath, "utf8");
		manifest[href] = css;
		addPathnameAlias(manifest, href, css);
	}
	return manifest;
}
function createInlineCssManifestGlobalCode(manifest) {
	return `${INLINE_CSS_GLOBAL_MARKER}${JSON.stringify(manifest)};`;
}
function injectInlineCssManifestGlobal(entryPath, manifest) {
	if (Object.keys(manifest).length === 0 || !fs.existsSync(entryPath)) return false;
	const code = fs.readFileSync(entryPath, "utf8");
	if (code.includes(INLINE_CSS_GLOBAL_MARKER)) return false;
	fs.writeFileSync(entryPath, `${createInlineCssManifestGlobalCode(manifest)}\n${code}`);
	return true;
}
//#endregion
export { collectInlineCssManifest, injectInlineCssManifestGlobal };
