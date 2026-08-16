import { PagesClientAssets } from "../server/pages-client-assets.js";

//#region src/build/pages-client-assets-module.d.ts
declare const PAGES_CLIENT_ASSETS_MODULE = "vinext-client-assets.js";
declare function buildPagesClientAssetsModule(assets: PagesClientAssets): string;
declare function writePagesClientAssetsModuleIfMissing(outputDir: string, moduleSource: string): void;
declare function setPagesClientAssetsBuildMetadata(buildSession: string, moduleSource: string): void;
declare function takePagesClientAssetsBuildMetadata(buildSession: string): string | null;
declare function clearPagesClientAssetsBuildMetadata(buildSession: string): void;
//#endregion
export { PAGES_CLIENT_ASSETS_MODULE, buildPagesClientAssetsModule, clearPagesClientAssetsBuildMetadata, setPagesClientAssetsBuildMetadata, takePagesClientAssetsBuildMetadata, writePagesClientAssetsModuleIfMissing };