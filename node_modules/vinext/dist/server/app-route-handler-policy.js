import { parseNextHttpErrorDigest, parseNextRedirectDigest } from "./next-error-digest.js";
import { isPossibleAppRouteActionRequest } from "./app-action-request.js";
import { buildRouteHandlerAllowHeader, collectRouteHandlerMethods } from "./app-route-handler-runtime.js";
//#region src/server/app-route-handler-policy.ts
function getAppRouteHandlerRevalidateSeconds(handler) {
	const { revalidate } = handler;
	if (revalidate === false) return Infinity;
	if (typeof revalidate !== "number" || !Number.isFinite(revalidate) || revalidate < 0) return null;
	return revalidate;
}
function hasAppRouteHandlerDefaultExport(handler) {
	return typeof handler.default === "function";
}
function resolveAppRouteHandlerMethod(handler, method) {
	const exportedMethods = collectRouteHandlerMethods(handler);
	const allowHeaderForOptions = buildRouteHandlerAllowHeader(exportedMethods);
	const shouldAutoRespondToOptions = method === "OPTIONS" && typeof handler.OPTIONS !== "function";
	let handlerFn = typeof handler[method] === "function" ? handler[method] : void 0;
	let isAutoHead = false;
	if (method === "HEAD" && typeof handler.HEAD !== "function" && typeof handler.GET === "function") {
		handlerFn = handler.GET;
		isAutoHead = true;
	}
	return {
		allowHeaderForOptions,
		exportedMethods,
		handlerFn,
		isAutoHead,
		shouldAutoRespondToOptions
	};
}
function shouldReadAppRouteHandlerCache(options) {
	return options.isProduction && options.revalidateSeconds !== null && options.revalidateSeconds > 0 && options.revalidateSeconds !== Infinity && options.dynamicConfig !== "force-dynamic" && !options.isDraftMode && !options.isKnownDynamic && (options.method === "GET" || options.isAutoHead) && typeof options.handlerFn === "function";
}
function shouldApplyAppRouteHandlerRevalidateHeader(options) {
	return options.revalidateSeconds !== null && !options.isDraftMode && !options.dynamicUsedInHandler && (options.method === "GET" || options.isAutoHead) && !options.handlerSetCacheControl;
}
function shouldWriteAppRouteHandlerCache(options) {
	return options.isProduction && options.revalidateSeconds !== null && options.revalidateSeconds > 0 && options.revalidateSeconds !== Infinity && options.dynamicConfig !== "force-dynamic" && !options.isDraftMode && shouldApplyAppRouteHandlerRevalidateHeader(options);
}
function resolveAppRouteHandlerSpecialError(error, requestUrl, options) {
	if (!(error && typeof error === "object" && "digest" in error)) return null;
	const digest = String(error.digest);
	const redirect = parseNextRedirectDigest(digest);
	if (redirect) return {
		kind: "redirect",
		location: new URL(redirect.url, requestUrl).toString(),
		statusCode: options?.isAction ? 303 : redirect.status
	};
	const httpError = parseNextHttpErrorDigest(digest);
	if (httpError) return {
		kind: "status",
		statusCode: httpError.status
	};
	return null;
}
//#endregion
export { getAppRouteHandlerRevalidateSeconds, hasAppRouteHandlerDefaultExport, isPossibleAppRouteActionRequest, resolveAppRouteHandlerMethod, resolveAppRouteHandlerSpecialError, shouldApplyAppRouteHandlerRevalidateHeader, shouldReadAppRouteHandlerCache, shouldWriteAppRouteHandlerCache };
