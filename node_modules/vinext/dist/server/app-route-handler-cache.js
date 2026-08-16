import { makeThenableParams } from "../shims/thenable-params.js";
import { applyRouteHandlerMiddlewareContext, assertSupportedAppRouteHandlerResponse, buildAppRouteCacheValue, buildRouteHandlerCachedResponse } from "./app-route-handler-response.js";
import { markKnownDynamicAppRoute } from "./app-route-handler-runtime.js";
import { runAppRouteHandler } from "./app-route-handler-execution.js";
//#region src/server/app-route-handler-cache.ts
const EMPTY_PARAMS = Object.freeze({});
function getCachedAppRouteValue(entry) {
	return entry?.value.value && entry.value.value.kind === "APP_ROUTE" ? entry.value.value : null;
}
async function readAppRouteHandlerCacheResponse(options) {
	const routeKey = options.isrRouteKey(options.cleanPathname);
	try {
		const cached = await options.isrGet(routeKey);
		const cachedValue = getCachedAppRouteValue(cached);
		if (cachedValue && !cached?.isStale) {
			options.isrDebug?.("HIT (route)", options.cleanPathname);
			options.clearRequestContext();
			return applyRouteHandlerMiddlewareContext(buildRouteHandlerCachedResponse(cachedValue, {
				cacheState: "HIT",
				cacheControl: cached?.value.cacheControl,
				expireSeconds: options.expireSeconds,
				isHead: options.isAutoHead,
				revalidateSeconds: options.revalidateSeconds
			}), options.middlewareContext);
		}
		if (cached?.isStale && cachedValue) {
			const staleValue = cachedValue;
			const revalidateSearchParams = new URLSearchParams(options.revalidateSearchParams);
			options.scheduleBackgroundRegeneration(routeKey, async () => {
				await options.runInRevalidationContext(async () => {
					options.setNavigationContext({
						pathname: options.cleanPathname,
						searchParams: revalidateSearchParams,
						params: options.params ?? EMPTY_PARAMS
					});
					const { dynamicUsedInHandler, response } = await runAppRouteHandler({
						basePath: options.basePath,
						consumeDynamicUsage: options.consumeDynamicUsage,
						dynamicConfig: options.dynamicConfig,
						handlerFn: options.handlerFn,
						i18n: options.i18n,
						trailingSlash: options.trailingSlash,
						markDynamicUsage: options.markDynamicUsage,
						params: options.params === null ? null : makeThenableParams(options.params),
						request: new Request(options.requestUrl, { method: "GET" }),
						routePattern: options.routePattern,
						setHeadersAccessPhase: options.setHeadersAccessPhase
					});
					options.setNavigationContext(null);
					assertSupportedAppRouteHandlerResponse(response);
					if (dynamicUsedInHandler) {
						markKnownDynamicAppRoute(options.routePattern);
						options.isrDebug?.("route regen skipped (dynamic usage)", options.cleanPathname);
						return;
					}
					const routeTags = options.buildPageCacheTags(options.cleanPathname, options.getCollectedFetchTags());
					const routeCacheValue = await buildAppRouteCacheValue(response);
					await options.isrSet(routeKey, routeCacheValue, options.revalidateSeconds, routeTags, options.expireSeconds);
					options.isrDebug?.("route regen complete", routeKey);
				});
			});
			options.isrDebug?.("STALE (route)", options.cleanPathname);
			options.clearRequestContext();
			return applyRouteHandlerMiddlewareContext(buildRouteHandlerCachedResponse(staleValue, {
				cacheState: "STALE",
				cacheControl: cached.value.cacheControl,
				expireSeconds: options.expireSeconds,
				isHead: options.isAutoHead,
				revalidateSeconds: options.revalidateSeconds
			}), options.middlewareContext);
		}
	} catch (routeCacheError) {
		console.error("[vinext] ISR route cache read error:", routeCacheError);
	}
	return null;
}
//#endregion
export { readAppRouteHandlerCacheResponse };
