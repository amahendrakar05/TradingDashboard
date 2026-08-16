import { appendDeploymentIdQuery } from "./deployment-id.js";
import { ASSET_PREFIX_URL_DIR, resolveAssetUrlPrefix, resolveAssetsDir } from "./asset-prefix.js";
//#region src/utils/built-asset-url.ts
function renderVinextBuiltUrl(filename, assetPrefix, deploymentId, hostType) {
	const urlPrefix = resolveAssetUrlPrefix(assetPrefix);
	const dirPrefix = resolveAssetsDir(assetPrefix) + "/";
	const url = urlPrefix + (filename.startsWith(dirPrefix) ? filename.slice(dirPrefix.length) : filename.startsWith(`_next/static/`) ? filename.slice(ASSET_PREFIX_URL_DIR.length + 1) : filename);
	return hostType === "js" ? url : appendDeploymentIdQuery(url, deploymentId);
}
//#endregion
export { renderVinextBuiltUrl };
