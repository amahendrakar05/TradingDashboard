//#region src/server/open-redirect.d.ts
/**
 * Returns true if a request pathname looks like a protocol-relative open
 * redirect, in either literal or percent-encoded form.
 *
 * A pathname is considered "open redirect shaped" when its first segment,
 * after decoding backslashes and encoded delimiters, would cause a browser
 * to resolve a `Location` containing the pathname as protocol-relative.
 */
declare function isOpenRedirectShaped(rawPathname: string): boolean;
//#endregion
export { isOpenRedirectShaped };