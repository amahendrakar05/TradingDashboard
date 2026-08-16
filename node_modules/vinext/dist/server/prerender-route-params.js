import { VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER } from "../utils/protocol-headers.js";
import { isUnknownRecord } from "../utils/record.js";
//#region src/server/prerender-route-params.ts
function isPrerenderRouteParams(value) {
	if (!isUnknownRecord(value)) return false;
	for (const [, param] of Object.entries(value)) {
		if (typeof param === "string") continue;
		if (Array.isArray(param) && param.every((item) => typeof item === "string")) continue;
		return false;
	}
	return true;
}
function isPrerenderRouteParamsPayload(value) {
	if (!isUnknownRecord(value)) return false;
	const keys = Object.keys(value);
	if (keys.length !== 2 && keys.length !== 3) return false;
	if (keys.some((key) => key !== "fallbackParamNames" && key !== "params" && key !== "routePattern")) return false;
	if ("fallbackParamNames" in value && (!Array.isArray(value.fallbackParamNames) || !value.fallbackParamNames.every((name) => typeof name === "string"))) return false;
	return typeof value.routePattern === "string" && value.routePattern.startsWith("/") && isPrerenderRouteParams(value.params);
}
function serializePrerenderRouteParamsHeader(payload) {
	if (payload === null || Object.keys(payload.params).length === 0) return null;
	return encodeURIComponent(JSON.stringify(payload));
}
function parsePrerenderRouteParamsHeader(value) {
	if (value === null || value === "") return null;
	try {
		const parsed = JSON.parse(decodeURIComponent(value));
		return isPrerenderRouteParamsPayload(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
function readTrustedPrerenderRouteParamsFromHeaders(headers, expectedSecret) {
	if (process.env.VINEXT_PRERENDER !== "1") return null;
	const secret = headers.get(VINEXT_PRERENDER_SECRET_HEADER);
	if (secret === null) return null;
	if (expectedSecret !== void 0 && secret !== expectedSecret) return null;
	const header = headers.get(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER);
	if (header === null) return null;
	const params = parsePrerenderRouteParamsHeader(header);
	if (params === null) throw new Error("[vinext] Invalid internal prerender route params header.");
	return params;
}
function readTrustedPrerenderRouteParams(request) {
	return readTrustedPrerenderRouteParamsFromHeaders(request.headers);
}
function decodePrerenderRouteParam(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}
function decodedPrerenderRouteParamEquals(prerenderValue, matchedValue) {
	if (Array.isArray(prerenderValue) || Array.isArray(matchedValue)) {
		if (!Array.isArray(prerenderValue) || !Array.isArray(matchedValue)) return false;
		if (prerenderValue.length !== matchedValue.length) return false;
		return prerenderValue.every((item, index) => {
			const decoded = decodePrerenderRouteParam(item);
			return item === matchedValue[index] || decoded !== null && decoded === matchedValue[index];
		});
	}
	const decoded = decodePrerenderRouteParam(prerenderValue);
	return prerenderValue === matchedValue || decoded !== null && decoded === matchedValue;
}
function prerenderRouteParamsPayloadMatchesRoute(payload, routePattern, params) {
	return matchPrerenderRouteParamsPayload(payload, routePattern, params)?.kind === "exact";
}
function matchPrerenderRouteParamsPayload(payload, routePattern, params) {
	if (payload === null) return null;
	if (payload.routePattern !== routePattern) return null;
	if (Object.keys(payload.params).length !== Object.keys(params).length) return null;
	for (const [key, prerenderValue] of Object.entries(payload.params)) {
		const matchedValue = params[key];
		if (matchedValue === void 0) return null;
		if (!decodedPrerenderRouteParamEquals(prerenderValue, matchedValue)) return null;
	}
	if (payload.fallbackParamNames) {
		const routeParamNames = new Set(routePattern.split("/").filter((part) => part.startsWith(":")).map((part) => part.endsWith("+") || part.endsWith("*") ? part.slice(1, -1) : part.slice(1)));
		const fallbackParamNames = payload.fallbackParamNames.filter((name, index, names) => routeParamNames.has(name) && names.indexOf(name) === index);
		if (fallbackParamNames.length !== payload.fallbackParamNames.length) return null;
		if (fallbackParamNames.length === 0) return null;
		return {
			fallbackParamNames,
			kind: "fallback-shell",
			params: payload.params
		};
	}
	return {
		kind: "exact",
		params: payload.params
	};
}
function encodePrerenderRouteParams(pattern, params, fallbackParamNames) {
	const encoded = {};
	for (const part of pattern.split("/").filter(Boolean)) {
		let paramName = null;
		if (part.startsWith(":") && (part.endsWith("+") || part.endsWith("*"))) paramName = part.slice(1, -1);
		else if (part.startsWith(":")) paramName = part.slice(1);
		if (paramName === null) continue;
		const value = params[paramName];
		if (Array.isArray(value)) encoded[paramName] = value.map((item) => encodeURIComponent(item));
		else if (typeof value === "string") encoded[paramName] = encodeURIComponent(value);
	}
	return Object.keys(encoded).length > 0 ? {
		...fallbackParamNames && fallbackParamNames.length > 0 ? { fallbackParamNames } : {},
		routePattern: pattern,
		params: encoded
	} : null;
}
//#endregion
export { encodePrerenderRouteParams, matchPrerenderRouteParamsPayload, prerenderRouteParamsPayloadMatchesRoute, readTrustedPrerenderRouteParams, readTrustedPrerenderRouteParamsFromHeaders, serializePrerenderRouteParamsHeader };
