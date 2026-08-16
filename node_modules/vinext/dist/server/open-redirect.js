//#region src/server/open-redirect.ts
/**
* Returns true if a request pathname looks like a protocol-relative open
* redirect, in either literal or percent-encoded form.
*
* A pathname is considered "open redirect shaped" when its first segment,
* after decoding backslashes and encoded delimiters, would cause a browser
* to resolve a `Location` containing the pathname as protocol-relative.
*/
function isOpenRedirectShaped(rawPathname) {
	if (!rawPathname.startsWith("/")) return false;
	const afterSlash = rawPathname.slice(1);
	if (afterSlash.startsWith("/") || afterSlash.startsWith("\\")) return true;
	if (afterSlash.length >= 3 && afterSlash[0] === "%") {
		const encoded = afterSlash.slice(0, 3).toLowerCase();
		if (encoded === "%5c" || encoded === "%2f") return true;
	}
	return false;
}
//#endregion
export { isOpenRedirectShaped };
