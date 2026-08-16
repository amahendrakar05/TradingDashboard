//#region src/utils/client-entry-manifest.d.ts
declare const VINEXT_CLIENT_ENTRY_MANIFEST = "vinext-client-entry-manifest.json";
type ClientEntryManifest = {
  pagesClientEntry?: string;
  appBrowserEntry?: string;
};
declare function readClientEntryManifest(clientDir: string): ClientEntryManifest | undefined;
declare function findClientEntryFileFromVinextManifest(manifest: ClientEntryManifest | undefined, assetBase: string): string | undefined;
declare function findPagesClientEntryFileFromVinextManifest(manifest: ClientEntryManifest | undefined, assetBase: string): string | undefined;
//#endregion
export { ClientEntryManifest, VINEXT_CLIENT_ENTRY_MANIFEST, findClientEntryFileFromVinextManifest, findPagesClientEntryFileFromVinextManifest, readClientEntryManifest };