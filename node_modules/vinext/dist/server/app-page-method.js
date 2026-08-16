import { methodNotAllowedResponse } from "./http-error-responses.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { isPossibleAppRouteActionRequest } from "./app-action-request.js";
//#region src/server/app-page-method.ts
function isNonGetOrHead(method) {
	const normalizedMethod = method.toUpperCase();
	return normalizedMethod !== "GET" && normalizedMethod !== "HEAD";
}
function isStaticOrSsgAppPageCandidate(options) {
	if (options.dynamicConfig === "force-dynamic" || options.revalidateSeconds === 0) return false;
	if (options.dynamicConfig === "force-static" || options.dynamicConfig === "error") return true;
	if (options.revalidateSeconds !== null && options.revalidateSeconds > 0) return true;
	if (options.hasGenerateStaticParams) return true;
	return !options.isDynamicRoute;
}
function resolveAppPageMethodResponse(options) {
	if (!isNonGetOrHead(options.request.method)) return null;
	if (isPossibleAppRouteActionRequest(options.request)) return null;
	if (!isStaticOrSsgAppPageCandidate(options)) return null;
	const headers = new Headers();
	mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders ?? null);
	return methodNotAllowedResponse("GET, HEAD", { headers });
}
//#endregion
export { isStaticOrSsgAppPageCandidate, resolveAppPageMethodResponse };
