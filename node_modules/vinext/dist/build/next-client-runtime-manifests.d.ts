import { ResolvedNextConfig } from "../config/next-config.js";

//#region src/build/next-client-runtime-manifests.d.ts
type EmitNextClientRuntimeManifestsOptions = {
  clientDir: string;
  assetsSubdir: string;
  buildId: string;
  rewrites: ResolvedNextConfig["rewrites"];
};
declare function buildNextClientBuildManifestContent(rewrites: ResolvedNextConfig["rewrites"]): string;
declare function buildNextClientSsgManifestContent(): string;
declare function emitNextClientRuntimeManifests(options: EmitNextClientRuntimeManifestsOptions): void;
//#endregion
export { buildNextClientBuildManifestContent, buildNextClientSsgManifestContent, emitNextClientRuntimeManifests };