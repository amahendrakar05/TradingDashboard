import { Plugin } from "vite";
import MagicString from "magic-string";

//#region src/plugins/dynamic-preload-metadata.d.ts
type TransformResult = {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
};
type ResolveDynamicImport = (specifier: string, importer: string) => Promise<string | null>;
declare function transformNextDynamicPreloadMetadata(code: string, id: string, root: string, resolveDynamicImport: ResolveDynamicImport): Promise<TransformResult | null>;
declare function createDynamicPreloadMetadataPlugin(): Plugin;
//#endregion
export { createDynamicPreloadMetadataPlugin, transformNextDynamicPreloadMetadata };