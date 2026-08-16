import { BuildManifestChunk } from "./lazy-chunks.js";

//#region src/utils/client-build-manifest.d.ts
type ClientBuildManifest = Record<string, BuildManifestChunk>;
declare function readClientBuildManifest(manifestPath: string): ClientBuildManifest | undefined;
declare function findClientEntryFileFromManifest(buildManifest: ClientBuildManifest, assetBase: string): string | undefined;
declare function findPagesClientEntryFileFromManifest(buildManifest: ClientBuildManifest, assetBase: string): string | undefined;
declare function findClientEntryFile(options: {
  buildManifest?: ClientBuildManifest;
  clientDir: string;
  assetsSubdir: string;
  assetBase: string;
}): string | undefined;
declare function findPagesClientEntryFile(options: {
  buildManifest?: ClientBuildManifest;
  clientDir: string;
  assetsSubdir: string;
  assetBase: string;
}): string | undefined;
//#endregion
export { findClientEntryFile, findClientEntryFileFromManifest, findPagesClientEntryFile, findPagesClientEntryFileFromManifest, readClientBuildManifest };