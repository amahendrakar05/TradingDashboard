//#region src/build/inline-css.d.ts
type InlineCssManifest = Record<string, string>;
declare function collectInlineCssManifest(clientDir: string, assetPrefix: string): InlineCssManifest;
declare function injectInlineCssManifestGlobal(entryPath: string, manifest: InlineCssManifest): boolean;
//#endregion
export { collectInlineCssManifest, injectInlineCssManifestGlobal };