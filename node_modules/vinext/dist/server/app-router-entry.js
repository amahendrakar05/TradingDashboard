import "./server-globals.js";
import { runWithExecutionContext } from "../shims/request-context.js";
import { VINEXT_PRERENDER_ROUTE_PARAMS_HEADER } from "../utils/protocol-headers.js";
import { badRequestResponse, notFoundResponse, notFoundStaticAssetResponse } from "./http-error-responses.js";
import { isOpenRedirectShaped } from "./open-redirect.js";
import { cloneRequestWithHeaders, filterInternalHeaders } from "./request-pipeline.js";
import { assetPrefixPathname, isNextStaticPath } from "../utils/asset-prefix.js";
import { getImageOptimizer, handleConfiguredImageOptimization, isImageOptimizationPath } from "./image-optimization.js";
import { finalizeMissingStaticAssetResponse, resolveStaticAssetSignal } from "./worker-utils.js";
import { readTrustedPrerenderRouteParams, serializePrerenderRouteParamsHeader } from "./prerender-route-params.js";
import rscHandler, { __assetPrefix, __basePath, __imageAllowedWidths, __imageConfig } from "virtual:vinext-rsc-entry";
import { registerConfiguredCacheAdapters } from "virtual:vinext-cache-adapters";
import { registerConfiguredImageOptimizer } from "virtual:vinext-image-adapters";
//#region src/server/app-router-entry.ts
const __workerBasePath = typeof __basePath === "string" ? __basePath : "";
const __workerAssetPathPrefix = assetPrefixPathname(typeof __assetPrefix === "string" ? __assetPrefix : "");
var app_router_entry_default = { async fetch(request, env, ctx) {
	return handleRequest(request, env, ctx);
} };
async function handleRequest(request, env, ctx) {
	registerConfiguredCacheAdapters(env);
	registerConfiguredImageOptimizer(env);
	const url = new URL(request.url);
	if (isImageOptimizationPath(url.pathname) && env?.ASSETS && getImageOptimizer()) {
		const assetFetcher = env.ASSETS;
		return handleConfiguredImageOptimization(request, (assetPath) => Promise.resolve(assetFetcher.fetch(new Request(new URL(assetPath, request.url)))), __imageAllowedWidths, __imageConfig);
	}
	if (isOpenRedirectShaped(url.pathname)) return notFoundResponse();
	try {
		decodeURIComponent(url.pathname);
	} catch {
		return badRequestResponse();
	}
	const missingBuildAsset = isNextStaticPath(url.pathname, __workerBasePath, __workerAssetPathPrefix);
	{
		const prerenderRouteParamsPayload = readTrustedPrerenderRouteParams(request);
		const filteredHeaders = filterInternalHeaders(request.headers);
		const prerenderRouteParamsHeader = serializePrerenderRouteParamsHeader(prerenderRouteParamsPayload);
		if (prerenderRouteParamsHeader !== null) filteredHeaders.set(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, prerenderRouteParamsHeader);
		request = cloneRequestWithHeaders(request, filteredHeaders);
	}
	const handleFn = () => rscHandler(request, ctx);
	const result = await (ctx ? runWithExecutionContext(ctx, handleFn) : handleFn());
	if (result instanceof Response) {
		let response = result;
		if (env?.ASSETS) {
			const assetFetcher = env.ASSETS;
			const assetResponse = await resolveStaticAssetSignal(response, { fetchAsset: (path) => Promise.resolve(assetFetcher.fetch(new Request(new URL(path, request.url)))) });
			if (assetResponse) response = assetResponse;
		}
		return finalizeMissingStaticAssetResponse(response, missingBuildAsset);
	}
	if (result === null || result === void 0) return missingBuildAsset ? notFoundStaticAssetResponse() : notFoundResponse();
	return new Response(String(result), { status: 200 });
}
//#endregion
export { app_router_entry_default as default };
