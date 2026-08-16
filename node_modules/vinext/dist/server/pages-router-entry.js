import { normalizePathnameForRouteMatchStrict } from "../routing/utils.js";
import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { notFoundStaticAssetResponse } from "./http-error-responses.js";
import { isOpenRedirectShaped } from "./open-redirect.js";
import { cloneRequestWithHeaders, cloneRequestWithUrl, filterInternalHeaders } from "./request-pipeline.js";
import { assetPrefixPathname, isNextStaticPath } from "../utils/asset-prefix.js";
import { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, handleConfiguredImageOptimization, isImageOptimizationPath } from "./image-optimization.js";
import { finalizeMissingStaticAssetResponse } from "./worker-utils.js";
import { fetchWorkerFilesystemRoute, runPagesRequest, wrapMiddlewareWithBasePath } from "./pages-request-pipeline.js";
import { registerConfiguredCacheAdapters } from "virtual:vinext-cache-adapters";
import { registerConfiguredImageOptimizer } from "virtual:vinext-image-adapters";
import * as pagesEntry from "virtual:vinext-server-entry";
//#region src/server/pages-router-entry.ts
/**
* Router-specific Cloudflare Worker entry point for vinext Pages Router.
*
* New projects should usually use the router-selected entry in wrangler.jsonc:
*   "main": "vinext/server/fetch-handler"
*
* This Pages Router entry remains available for existing configs and for custom
* workers that need to opt into the Pages Router handler explicitly:
*   "main": "vinext/server/pages-router-entry"
*
* Or import and delegate to it from a custom worker:
*   import handler from "vinext/server/pages-router-entry";
*   return handler.fetch(request, env, ctx);
*/
const { handleApiRoute, hasMiddleware, matchPageRoute, normalizeDataRequest, renderPage, runMiddleware, vinextConfig } = pagesEntry;
const basePath = vinextConfig?.basePath ?? "";
const assetPathPrefix = assetPrefixPathname(vinextConfig?.assetPrefix ?? "");
const trailingSlash = vinextConfig?.trailingSlash ?? false;
const i18nConfig = vinextConfig?.i18n ?? null;
const configRedirects = vinextConfig?.redirects ?? [];
const configRewrites = vinextConfig?.rewrites ?? {
	beforeFiles: [],
	afterFiles: [],
	fallback: []
};
const configHeaders = vinextConfig?.headers ?? [];
const imageConfig = vinextConfig?.images ? {
	qualities: vinextConfig.images.qualities,
	dangerouslyAllowSVG: vinextConfig.images.dangerouslyAllowSVG,
	dangerouslyAllowLocalIP: vinextConfig.images.dangerouslyAllowLocalIP,
	contentDispositionType: vinextConfig.images.contentDispositionType,
	contentSecurityPolicy: vinextConfig.images.contentSecurityPolicy
} : void 0;
var pages_router_entry_default = { async fetch(request, env, ctx) {
	return handleRequest(request, env, ctx);
} };
async function handleRequest(request, env, ctx) {
	registerConfiguredCacheAdapters(env);
	registerConfiguredImageOptimizer(env);
	try {
		let pathname = new URL(request.url).pathname;
		if (isOpenRedirectShaped(pathname)) return new Response("This page could not be found", { status: 404 });
		try {
			normalizePathnameForRouteMatchStrict(pathname);
		} catch {
			return new Response("Bad Request", { status: 400 });
		}
		const missingBuildAsset = isNextStaticPath(pathname, basePath, assetPathPrefix);
		request = cloneRequestWithHeaders(request, filterInternalHeaders(request.headers));
		const hadBasePath = !basePath || hasBasePath(pathname, basePath);
		{
			const stripped = stripBasePath(pathname, basePath);
			if (stripped !== pathname) {
				const strippedUrl = new URL(request.url);
				strippedUrl.pathname = stripped;
				request = cloneRequestWithUrl(request, strippedUrl.toString());
				pathname = stripped;
			}
		}
		const dataNorm = normalizeDataRequest(request);
		if (dataNorm.notFoundResponse) return dataNorm.notFoundResponse;
		const isDataReq = dataNorm.isDataReq;
		if (isDataReq) {
			request = dataNorm.request;
			pathname = dataNorm.normalizedPathname;
		}
		if (isImageOptimizationPath(pathname) && env?.ASSETS) {
			const allowedWidths = [...vinextConfig?.images?.deviceSizes ?? DEFAULT_DEVICE_SIZES, ...vinextConfig?.images?.imageSizes ?? DEFAULT_IMAGE_SIZES];
			return handleConfiguredImageOptimization(request, (assetPath) => Promise.resolve(env.ASSETS.fetch(new Request(new URL(assetPath, request.url)))), allowedWidths, imageConfig);
		}
		const deps = {
			basePath,
			trailingSlash,
			i18nConfig,
			configRedirects,
			configRewrites,
			configHeaders,
			hadBasePath,
			isDataReq,
			isDataRequest: isDataReq,
			hasMiddleware,
			ctx,
			matchPageRoute: typeof matchPageRoute === "function" ? matchPageRoute : null,
			runMiddleware: typeof runMiddleware === "function" ? wrapMiddlewareWithBasePath(runMiddleware, basePath, hadBasePath) : null,
			renderPage: typeof renderPage === "function" ? (req, resolvedUrl, options, stagedHeaders) => renderPage(req, resolvedUrl, null, ctx, stagedHeaders, options) : null,
			handleApi: typeof handleApiRoute === "function" ? (req, apiUrl) => handleApiRoute(req, apiUrl, ctx) : null,
			serveFilesystemRoute: async (requestPathname, _stagedHeaders, phase) => {
				if (!env?.ASSETS) return false;
				return fetchWorkerFilesystemRoute(request, requestPathname, phase, (assetRequest) => Promise.resolve(env.ASSETS.fetch(assetRequest)));
			}
		};
		const result = await runPagesRequest(request, deps);
		if (result.type === "response") return finalizeMissingStaticAssetResponse(result.response, missingBuildAsset);
		return missingBuildAsset ? notFoundStaticAssetResponse() : new Response("This page could not be found", { status: 404 });
	} catch (error) {
		console.error("[vinext] Worker error:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
}
//#endregion
export { pages_router_entry_default as default };
