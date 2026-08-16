//#region src/server/pages-media-type.ts
/**
* Shared media-type helpers and body-parse error for Pages API routes.
*
* Used by both api-handler.ts (Pages Router dev/prod with Node.js req/res) and
* pages-node-compat.ts (Pages Router fetch-based facade for Cloudflare Workers).
*/
var PagesBodyParseError = class extends Error {
	statusCode;
	constructor(message, statusCode) {
		super(message);
		this.statusCode = statusCode;
		this.name = "PagesBodyParseError";
	}
};
function getMediaType(contentType) {
	const [type] = (contentType ?? "text/plain").split(";");
	return type?.trim().toLowerCase() || "text/plain";
}
function isJsonMediaType(mediaType) {
	return mediaType === "application/json" || mediaType === "application/ld+json";
}
//#endregion
export { PagesBodyParseError, getMediaType, isJsonMediaType };
