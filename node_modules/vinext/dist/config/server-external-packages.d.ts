//#region src/config/server-external-packages.d.ts
declare function mergeServerExternalPackages(userPackages?: readonly string[], transpilePackages?: readonly string[]): string[];
//#endregion
export { mergeServerExternalPackages };