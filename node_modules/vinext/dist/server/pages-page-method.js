import { methodNotAllowedResponse } from "./http-error-responses.js";
//#region src/server/pages-page-method.ts
function isNonGetOrHead(method) {
	const normalizedMethod = method.toUpperCase();
	return normalizedMethod !== "GET" && normalizedMethod !== "HEAD";
}
/**
* Returns a 405 `Response` when the request method is not allowed for a
* static (no `getServerSideProps`) Pages Router page, otherwise `null`.
*/
function resolvePagesPageMethodResponse(options) {
	if (!isNonGetOrHead(options.method)) return null;
	if (options.hasGetServerSideProps) return null;
	return methodNotAllowedResponse("GET, HEAD");
}
//#endregion
export { resolvePagesPageMethodResponse };
