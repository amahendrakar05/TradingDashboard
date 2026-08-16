import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/build/pages-client-assets-module.ts
const PAGES_CLIENT_ASSETS_MODULE = "vinext-client-assets.js";
const pagesClientAssetsByBuildSession = /* @__PURE__ */ new Map();
function buildPagesClientAssetsModule(assets) {
	return `export default ${JSON.stringify(assets)};\n`;
}
function writePagesClientAssetsModuleIfMissing(outputDir, moduleSource) {
	const outputPath = path.join(outputDir, PAGES_CLIENT_ASSETS_MODULE);
	if (fs.existsSync(outputPath)) return;
	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(outputPath, moduleSource);
}
function setPagesClientAssetsBuildMetadata(buildSession, moduleSource) {
	pagesClientAssetsByBuildSession.set(buildSession, moduleSource);
}
function takePagesClientAssetsBuildMetadata(buildSession) {
	const moduleSource = pagesClientAssetsByBuildSession.get(buildSession) ?? null;
	pagesClientAssetsByBuildSession.delete(buildSession);
	return moduleSource;
}
function clearPagesClientAssetsBuildMetadata(buildSession) {
	pagesClientAssetsByBuildSession.delete(buildSession);
}
//#endregion
export { PAGES_CLIENT_ASSETS_MODULE, buildPagesClientAssetsModule, clearPagesClientAssetsBuildMetadata, setPagesClientAssetsBuildMetadata, takePagesClientAssetsBuildMetadata, writePagesClientAssetsModuleIfMissing };
