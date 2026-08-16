//#region src/server/csp.ts
const ESCAPE_REGEX = /[&><\u2028\u2029]/;
function getNodeHeaderValue(headers, key) {
	const value = headers?.[key];
	if (Array.isArray(value)) return value.join(", ");
	if (value == null) return;
	return String(value);
}
function getScriptNonceFromHeader(cspHeaderValue) {
	const directives = cspHeaderValue.split(";").map((directive) => directive.trim());
	const directive = directives.find((value) => value.startsWith("script-src")) ?? directives.find((value) => value.startsWith("default-src"));
	if (!directive) return;
	const nonce = directive.split(" ").slice(1).map((source) => source.trim()).find((source) => source.startsWith("'nonce-") && source.length > 8 && source.endsWith("'"))?.slice(7, -1);
	if (!nonce) return;
	if (ESCAPE_REGEX.test(nonce)) throw new Error("Nonce value from Content-Security-Policy contained HTML escape characters.\nLearn more: https://nextjs.org/docs/messages/nonce-contained-invalid-characters");
	return nonce;
}
function getScriptNonceFromHeaders(headers) {
	const csp = headers?.get("content-security-policy") ?? headers?.get("content-security-policy-report-only");
	if (!csp) return;
	return getScriptNonceFromHeader(csp);
}
function getScriptNonceFromNodeHeaders(headers) {
	const csp = getNodeHeaderValue(headers, "content-security-policy") ?? getNodeHeaderValue(headers, "content-security-policy-report-only");
	if (!csp) return;
	return getScriptNonceFromHeader(csp);
}
function getScriptNonceFromNodeHeaderSources(...headersList) {
	for (const headers of headersList) {
		const nonce = getScriptNonceFromNodeHeaders(headers);
		if (nonce) return nonce;
	}
}
function getScriptNonceFromHeaderSources(...headersList) {
	for (const headers of headersList) {
		const nonce = getScriptNonceFromHeaders(headers);
		if (nonce) return nonce;
	}
}
//#endregion
export { getScriptNonceFromHeader, getScriptNonceFromHeaderSources, getScriptNonceFromHeaders, getScriptNonceFromNodeHeaderSources };
