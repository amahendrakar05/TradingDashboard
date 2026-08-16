import { addBasePathToPathname } from "../utils/base-path.js";
import { escapeHtmlAttr } from "./html.js";
import { getNextErrorDigest, parseNextHttpErrorDigest, parseNextRedirectDigest } from "./next-error-digest.js";
//#region src/server/app-ssr-error-meta.ts
const PERMANENT_REDIRECT_STATUS = 308;
function prefixRedirectLocation(location, basePath) {
	if (!basePath || !location.startsWith("/")) return location;
	const hashIndex = location.indexOf("#");
	const queryIndex = location.indexOf("?");
	const pathnameEnd = queryIndex === -1 ? hashIndex === -1 ? location.length : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
	return addBasePathToPathname(location.slice(0, pathnameEnd), basePath) + location.slice(pathnameEnd);
}
function renderSsrErrorMetaTag(error, options) {
	const digest = getNextErrorDigest(error);
	if (!digest) return "";
	if (parseNextHttpErrorDigest(digest)) {
		let html = "<meta name=\"robots\" content=\"noindex\"/>";
		if ((options.nodeEnv ?? process.env.NODE_ENV) === "development") html += "<meta name=\"next-error\" content=\"not-found\"/>";
		return html;
	}
	const redirect = parseNextRedirectDigest(digest);
	if (!redirect) return "";
	const delay = redirect.status === PERMANENT_REDIRECT_STATUS ? 0 : 1;
	const location = prefixRedirectLocation(redirect.url, options.basePath);
	return "<meta id=\"__next-page-redirect\" http-equiv=\"refresh\" content=\"" + delay + ";url=" + escapeHtmlAttr(location) + "\"/>";
}
function renderSsrErrorMetaTags(errors, options = {}) {
	let html = "";
	for (const error of errors) html += renderSsrErrorMetaTag(error, options);
	return html;
}
function createSsrErrorMetaRenderer(options = {}) {
	const capturedErrors = [];
	let flushedUntil = 0;
	return {
		capture(error) {
			capturedErrors.push(error);
		},
		flush() {
			if (flushedUntil >= capturedErrors.length) return "";
			const html = renderSsrErrorMetaTags(capturedErrors.slice(flushedUntil), options);
			flushedUntil = capturedErrors.length;
			return html;
		}
	};
}
//#endregion
export { createSsrErrorMetaRenderer, renderSsrErrorMetaTags };
