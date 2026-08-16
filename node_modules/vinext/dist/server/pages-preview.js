import { parseCookieHeader } from "../utils/parse-cookie.js";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
//#region src/server/pages-preview.ts
const PAGES_PREVIEW_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";
const pagesPreviewCookiesCleared = Symbol("__prerender_bypass");
let devCredentials;
function decodeKey(value) {
	if (!value || !/^[0-9a-f]{64}$/i.test(value)) return null;
	return Buffer.from(value, "hex");
}
function getPagesPreviewCredentials() {
	const bypassId = process.env.__VINEXT_PREVIEW_MODE_ID;
	const encryptionKey = decodeKey(process.env.__VINEXT_PREVIEW_MODE_ENCRYPTION_KEY);
	const signingKey = decodeKey(process.env.__VINEXT_PREVIEW_MODE_SIGNING_KEY);
	if (bypassId && encryptionKey && signingKey) return {
		bypassId,
		encryptionKey,
		signingKey
	};
	if (!devCredentials) devCredentials = {
		bypassId: randomBytes(16).toString("hex"),
		encryptionKey: randomBytes(32),
		signingKey: randomBytes(32)
	};
	return devCredentials;
}
function getPagesPreviewModeId() {
	return getPagesPreviewCredentials().bypassId;
}
function serializeCookie(name, value, options = {}) {
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		"HttpOnly",
		`Path=${options.path ?? "/"}`,
		process.env.NODE_ENV !== "development" ? "SameSite=None" : "SameSite=Lax"
	];
	if (process.env.NODE_ENV !== "development") parts.push("Secure");
	if (options.maxAge !== void 0) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
	return parts.join("; ");
}
function serializeClearedCookie(name, options = {}) {
	return [
		`${name}=`,
		"Expires=Thu, 01 Jan 1970 00:00:00 GMT",
		"HttpOnly",
		`Path=${options.path ?? "/"}`,
		process.env.NODE_ENV !== "development" ? "SameSite=None" : "SameSite=Lax",
		...process.env.NODE_ENV !== "development" ? ["Secure"] : []
	].join("; ");
}
function normalizeSetCookie(value) {
	if (value === void 0) return [];
	return Array.isArray(value) ? value.map(String) : [String(value)];
}
function encodePayload(data, maxAge) {
	const iv = randomBytes(12);
	const credentials = getPagesPreviewCredentials();
	const cipher = createCipheriv("aes-256-gcm", credentials.encryptionKey, iv);
	const plaintext = JSON.stringify({
		data,
		...maxAge === void 0 ? {} : { expiresAt: Date.now() + maxAge * 1e3 }
	});
	const encryptedToken = [
		iv,
		Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]),
		cipher.getAuthTag()
	].map((part) => part.toString("base64url")).join(".");
	return `${encryptedToken}.${createHmac("sha256", credentials.signingKey).update(encryptedToken).digest("base64url")}`;
}
function decodePayload(payload) {
	try {
		const [ivValue, encryptedValue, tagValue, signatureValue, ...extra] = payload.split(".");
		if (!ivValue || !encryptedValue || !tagValue || !signatureValue || extra.length > 0) return false;
		const encryptedToken = `${ivValue}.${encryptedValue}.${tagValue}`;
		const credentials = getPagesPreviewCredentials();
		const expected = createHmac("sha256", credentials.signingKey).update(encryptedToken).digest();
		const signature = Buffer.from(signatureValue, "base64url");
		if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return false;
		const decipher = createDecipheriv("aes-256-gcm", credentials.encryptionKey, Buffer.from(ivValue, "base64url"));
		decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
		const decoded = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
		const value = JSON.parse(decoded);
		if (typeof value !== "object" || value === null || !("data" in value)) return false;
		const expiresAt = "expiresAt" in value ? value.expiresAt : void 0;
		if (typeof expiresAt === "number" && Date.now() >= expiresAt) return false;
		const data = value.data;
		return typeof data === "object" && data !== null ? data : String(data);
	} catch {
		return false;
	}
}
function getPagesPreviewState(cookieHeader, options = {}) {
	if (options.isOnDemandRevalidate) return {
		data: false,
		shouldClear: false
	};
	const cookies = parseCookieHeader(Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader);
	const bypass = cookies.__prerender_bypass;
	const payload = cookies.__next_preview_data;
	if (!bypass && !payload) return {
		data: false,
		shouldClear: false
	};
	if (!bypass || bypass !== getPagesPreviewCredentials().bypassId) return {
		data: false,
		shouldClear: true
	};
	if (!payload) return {
		data: {},
		shouldClear: false
	};
	const data = decodePayload(payload);
	return {
		data,
		shouldClear: data === false
	};
}
function setPagesDraftMode(response, enabled) {
	const cookie = enabled ? serializeCookie("__prerender_bypass", getPagesPreviewModeId()) : serializeClearedCookie("__prerender_bypass");
	response.setHeader("Set-Cookie", [...normalizeSetCookie(response.getHeader("Set-Cookie")), cookie]);
}
function setPagesPreviewData(response, data, options = {}) {
	const payload = encodePayload(data, options.maxAge);
	if (payload.length > 2048) throw new Error("Preview data is limited to 2KB currently, reduce how much data you are storing as preview data to continue");
	response.setHeader("Set-Cookie", [
		...normalizeSetCookie(response.getHeader("Set-Cookie")),
		serializeCookie("__prerender_bypass", getPagesPreviewModeId(), options),
		serializeCookie("__next_preview_data", payload, options)
	]);
}
function clearPagesPreviewData(response, options = {}) {
	if (pagesPreviewCookiesCleared in response) return;
	response.setHeader("Set-Cookie", [
		...normalizeSetCookie(response.getHeader("Set-Cookie")),
		serializeClearedCookie("__prerender_bypass", options),
		serializeClearedCookie("__next_preview_data", options)
	]);
	Object.defineProperty(response, pagesPreviewCookiesCleared, {
		value: true,
		enumerable: false
	});
}
function appendPagesPreviewClearCookies(headers) {
	const cookies = headers.getSetCookie();
	const hasExpiredCookie = (name) => cookies.some((cookie) => {
		const [cookieValue, ...attributes] = cookie.split(";").map((part) => part.trim());
		if (!cookieValue?.startsWith(`${name}=`)) return false;
		let expiresAtEpoch = false;
		let path;
		let hasDomain = false;
		for (const attribute of attributes) {
			const separator = attribute.indexOf("=");
			const attributeName = (separator === -1 ? attribute : attribute.slice(0, separator)).trim().toLowerCase();
			const attributeValue = separator === -1 ? "" : attribute.slice(separator + 1).trim();
			if (attributeName === "expires") expiresAtEpoch = Date.parse(attributeValue) === 0;
			if (attributeName === "path") path = attributeValue;
			if (attributeName === "domain") hasDomain = true;
		}
		return expiresAtEpoch && path === "/" && !hasDomain;
	});
	if (!hasExpiredCookie("__prerender_bypass")) headers.append("Set-Cookie", serializeClearedCookie("__prerender_bypass"));
	if (!hasExpiredCookie("__next_preview_data")) headers.append("Set-Cookie", serializeClearedCookie("__next_preview_data"));
}
//#endregion
export { PAGES_PREVIEW_CACHE_CONTROL, appendPagesPreviewClearCookies, clearPagesPreviewData, getPagesPreviewModeId, getPagesPreviewState, setPagesDraftMode, setPagesPreviewData };
