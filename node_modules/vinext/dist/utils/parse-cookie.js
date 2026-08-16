//#region src/utils/parse-cookie.ts
function decodeCookieValue(value) {
	try {
		return {
			ok: true,
			value: decodeURIComponent(value)
		};
	} catch {
		return { ok: false };
	}
}
function forEachCookieHeaderPart(cookieHeader, visit) {
	for (const part of cookieHeader.split(/; */)) {
		if (!part) continue;
		visit(part, part.indexOf("="));
	}
}
/**
* Parse a Cookie header using the semantics of Next.js's compiled `cookie`
* package.
*/
function parseCookieHeader(cookieHeader) {
	const cookies = {};
	if (!cookieHeader) return cookies;
	forEachCookieHeaderPart(cookieHeader, (part, separator) => {
		if (separator < 0) return;
		const key = part.slice(0, separator).trim();
		let value = part.slice(separator + 1).trim();
		if (cookies[key] !== void 0) return;
		if (value.startsWith("\"")) value = value.slice(1, -1);
		const decoded = decodeCookieValue(value);
		cookies[key] = decoded.ok ? decoded.value : value;
	});
	return cookies;
}
/**
* Parse a Cookie header using Next.js/@edge-runtime RequestCookies semantics.
*/
function parseEdgeRequestCookieHeader(cookieHeader) {
	const cookies = /* @__PURE__ */ new Map();
	forEachCookieHeaderPart(cookieHeader, (part, separator) => {
		if (separator === -1) {
			cookies.set(part, "true");
			return;
		}
		const decoded = decodeCookieValue(part.slice(separator + 1));
		if (decoded.ok) cookies.set(part.slice(0, separator), decoded.value);
	});
	return cookies;
}
//#endregion
export { parseCookieHeader, parseEdgeRequestCookieHeader };
