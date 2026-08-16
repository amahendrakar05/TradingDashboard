//#region src/utils/external-url.ts
/** Detect an absolute URL with any scheme, or a protocol-relative URL. */
function isExternalUrl(url) {
	return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}
//#endregion
export { isExternalUrl };
