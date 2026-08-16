//#region src/server/pages-client-assets.d.ts
type PagesClientAssets = {
  clientEntry?: string;
  appBootstrapPreinitModules?: string[];
  ssrManifest?: Record<string, string[]>;
  lazyChunks?: string[];
  dynamicPreloads?: Record<string, string[]>;
};
declare function setPagesClientAssets(assets: PagesClientAssets | undefined): void;
declare function getPagesClientAssets(): PagesClientAssets;
//#endregion
export { PagesClientAssets, getPagesClientAssets, setPagesClientAssets };