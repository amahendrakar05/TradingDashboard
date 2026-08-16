//#region src/utils/external-url.d.ts
/** Detect an absolute URL with any scheme, or a protocol-relative URL. */
declare function isExternalUrl(url: string): boolean;
//#endregion
export { isExternalUrl };