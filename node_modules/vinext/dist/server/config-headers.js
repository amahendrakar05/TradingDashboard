import { matchHeaders } from "../config/config-matchers.js";
//#region src/server/config-headers.ts
function findHeaderRecordKey(headers, lowerName) {
	for (const key of Object.keys(headers)) if (key.toLowerCase() === lowerName) return key;
}
function appendHeaderRecord(headers, lowerName, value) {
	const key = findHeaderRecordKey(headers, lowerName) ?? lowerName;
	const existing = headers[key];
	if (existing === void 0) {
		headers[key] = value;
		return;
	}
	if (Array.isArray(existing)) {
		existing.push(value);
		return;
	}
	headers[key] = [existing, value];
}
function appendVaryHeaderRecord(headers, value) {
	const key = findHeaderRecordKey(headers, "vary") ?? "vary";
	const existing = headers[key];
	if (existing === void 0) {
		headers[key] = value;
		return;
	}
	if (Array.isArray(existing)) {
		existing.push(value);
		return;
	}
	headers[key] = existing + ", " + value;
}
/** Apply matched next.config.js headers to a Web Headers object. */
function applyConfigHeadersToResponse(responseHeaders, options) {
	const matched = matchHeaders(options.pathname, options.configHeaders, options.requestContext, options.basePathState);
	for (const header of matched) {
		const lowerName = header.key.toLowerCase();
		if (lowerName === "vary" || lowerName === "set-cookie") responseHeaders.append(header.key, header.value);
		else if (options.overwriteExisting?.has(lowerName) || !responseHeaders.has(lowerName)) responseHeaders.set(header.key, header.value);
	}
}
/** Apply matched next.config.js headers to an early response header record. */
function applyConfigHeadersToHeaderRecord(headers, options) {
	const matched = matchHeaders(options.pathname, options.configHeaders, options.requestContext, options.basePathState);
	for (const header of matched) {
		const lowerName = header.key.toLowerCase();
		if (lowerName === "set-cookie") appendHeaderRecord(headers, lowerName, header.value);
		else if (lowerName === "vary") appendVaryHeaderRecord(headers, header.value);
		else if (findHeaderRecordKey(headers, lowerName) === void 0) headers[lowerName] = header.value;
	}
}
//#endregion
export { applyConfigHeadersToHeaderRecord, applyConfigHeadersToResponse };
