import { notFoundResponse } from "./http-error-responses.js";
import { isValidMetadataImageId, manifestToJson, matchMetadataRoutePattern, robotsToText, sitemapToXml } from "./metadata-routes.js";
//#region src/server/metadata-route-response.ts
const routeFunctionCache = /* @__PURE__ */ new WeakMap();
const CACHE_HEADERS = {
	noCache: "no-cache, no-store",
	revalidate: "public, max-age=0, must-revalidate"
};
function isObject(value) {
	return typeof value === "object" && value !== null;
}
function readFunction(module, key) {
	if (!module) return null;
	const value = Reflect.get(module, key);
	if (typeof value !== "function") return null;
	return (props) => Reflect.apply(value, module, [props]);
}
function isSitemapEntries(value) {
	return Array.isArray(value);
}
function isRobotsConfig(value) {
	return isObject(value) && !Array.isArray(value);
}
function isManifestConfig(value) {
	return isObject(value) && !Array.isArray(value);
}
function isImageMetadataRoute(route) {
	return route.type === "icon" || route.type === "apple-icon" || route.type === "opengraph-image" || route.type === "twitter-image";
}
function metadataRouteCacheHeader(route) {
	if (route.isDynamic && isImageMetadataRoute(route) && process.env.NODE_ENV === "development") return CACHE_HEADERS.noCache;
	return CACHE_HEADERS.revalidate;
}
function withMetadataRouteCacheHeader(response, route) {
	const headers = new Headers(response.headers);
	if (!headers.has("Cache-Control")) headers.set("Cache-Control", metadataRouteCacheHeader(route));
	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText
	});
}
function getMetadataRouteFunctions(route) {
	const cached = routeFunctionCache.get(route);
	if (cached) return cached;
	const generateImageMetadata = route.isDynamic && isImageMetadataRoute(route) ? readFunction(route.module, "generateImageMetadata") : null;
	const functions = {
		defaultExport: route.isDynamic ? readFunction(route.module, "default") : null,
		generateImageMetadata,
		generateSitemaps: route.type === "sitemap" && route.isDynamic ? readFunction(route.module, "generateSitemaps") : null,
		hasGeneratedImageMetadata: route.isDynamic && isImageMetadataRoute(route) && Boolean(generateImageMetadata)
	};
	routeFunctionCache.set(route, functions);
	return functions;
}
function matchMetadataRoute(route, cleanPathname, functions, getUrlParts) {
	if (route.patternParts) {
		const urlParts = getUrlParts();
		if (functions.hasGeneratedImageMetadata && urlParts.length > 0) {
			const params = matchMetadataRoutePattern(urlParts.slice(0, -1), route.patternParts);
			if (params) return {
				params,
				imageId: urlParts[urlParts.length - 1]
			};
		}
		const params = matchMetadataRoutePattern(urlParts, route.patternParts);
		return params ? {
			params,
			imageId: null
		} : null;
	}
	if (functions.hasGeneratedImageMetadata && cleanPathname.startsWith(`${route.servedUrl}/`)) {
		const imageSuffix = cleanPathname.slice(route.servedUrl.length + 1);
		if (!imageSuffix || imageSuffix.includes("/")) return null;
		return {
			params: Object.create(null),
			imageId: imageSuffix
		};
	}
	return cleanPathname === route.servedUrl ? {
		params: null,
		imageId: null
	} : null;
}
function findGeneratedSitemapId(entries, rawId) {
	if (!Array.isArray(entries)) return null;
	for (const entry of entries) {
		if (!isObject(entry) || Reflect.get(entry, "id") == null) throw new Error("id property is required for every item returned from generateSitemaps");
		const id = Reflect.get(entry, "id");
		if (String(id) === rawId) return rawId;
	}
	return null;
}
function makeThenableMetadataRouteId(id) {
	return Object.assign(Promise.resolve(id), {
		toString() {
			return id;
		},
		valueOf() {
			return id;
		},
		[Symbol.toPrimitive]() {
			return id;
		}
	});
}
async function handleGeneratedSitemap(route, cleanPathname, functions) {
	if (!functions.generateSitemaps || !functions.defaultExport) return null;
	const sitemapPrefix = route.servedUrl.slice(0, -4);
	if (!cleanPathname.startsWith(`${sitemapPrefix}/`) || !cleanPathname.endsWith(".xml")) return null;
	const rawId = cleanPathname.slice(sitemapPrefix.length + 1, -4);
	if (rawId.includes("/")) return null;
	const matchedId = findGeneratedSitemapId(await functions.generateSitemaps({}), rawId);
	if (!matchedId) return notFoundResponse();
	const result = await functions.defaultExport({ id: makeThenableMetadataRouteId(matchedId) });
	if (result instanceof Response) return withMetadataRouteCacheHeader(result, route);
	if (!isSitemapEntries(result)) throw new TypeError("Metadata sitemap routes must return an array.");
	return new Response(sitemapToXml(result), { headers: {
		"Content-Type": route.contentType,
		"Cache-Control": metadataRouteCacheHeader(route)
	} });
}
function findGeneratedImageId(imageMetadata, imageId, servedUrl) {
	if (!Array.isArray(imageMetadata)) return null;
	for (const item of imageMetadata) {
		if (!isObject(item) || Reflect.get(item, "id") == null) throw new Error("id property is required for every item returned from generateImageMetadata");
		const itemId = String(Reflect.get(item, "id"));
		if (!isValidMetadataImageId(itemId)) {
			console.warn(`[vinext] Skipping metadata route ${servedUrl} image id "${itemId}" because metadata image ids must match /^[a-zA-Z0-9-_.]+$/.`);
			continue;
		}
		if (itemId === imageId) return itemId;
	}
	return null;
}
async function callDynamicMetadataRoute(route, match, makeThenableParams, functions) {
	if (!functions.defaultExport) {
		console.warn(`[vinext] Dynamic metadata route ${route.servedUrl} has no default export.`);
		return notFoundResponse();
	}
	const paramsThenable = makeThenableParams(match.params ?? {});
	let result;
	if (functions.hasGeneratedImageMetadata) {
		if (match.imageId === null || !isValidMetadataImageId(match.imageId)) return notFoundResponse();
		if (!functions.generateImageMetadata) return notFoundResponse();
		const matchedImageId = findGeneratedImageId(await functions.generateImageMetadata({ params: paramsThenable }), match.imageId, route.servedUrl);
		if (!matchedImageId) return notFoundResponse();
		result = await functions.defaultExport({
			params: paramsThenable,
			id: makeThenableMetadataRouteId(matchedImageId)
		});
	} else result = await functions.defaultExport({ params: paramsThenable });
	if (result instanceof Response) return withMetadataRouteCacheHeader(result, route);
	let body;
	if (route.type === "sitemap") {
		if (!isSitemapEntries(result)) throw new TypeError("Metadata sitemap routes must return an array.");
		body = sitemapToXml(result);
	} else if (route.type === "robots") {
		if (!isRobotsConfig(result)) throw new TypeError("Metadata robots routes must return an object.");
		body = robotsToText(result);
	} else if (route.type === "manifest") {
		if (!isManifestConfig(result)) throw new TypeError("Metadata manifest routes must return an object.");
		body = manifestToJson(result);
	} else if (isImageMetadataRoute(route)) throw new TypeError(`Dynamic metadata ${route.type} route ${route.servedUrl} must return a Response.`);
	else body = JSON.stringify(result);
	return new Response(body, { headers: {
		"Content-Type": route.contentType,
		"Cache-Control": metadataRouteCacheHeader(route)
	} });
}
function serveStaticMetadataRoute(route) {
	if (typeof route.fileDataBase64 !== "string") throw new Error(`[vinext] Static metadata route ${route.servedUrl} is missing embedded file data.`);
	try {
		const binary = atob(route.fileDataBase64);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
		return new Response(bytes, { headers: {
			"Content-Type": route.contentType,
			"Cache-Control": metadataRouteCacheHeader(route)
		} });
	} catch (error) {
		const reason = error instanceof Error && error.message ? `: ${error.message}` : "";
		throw new Error(`[vinext] Failed to decode embedded metadata route file data for ${route.servedUrl}${reason}`, { cause: error });
	}
}
async function handleMetadataRouteRequest(options) {
	let urlParts;
	const getUrlParts = () => urlParts ??= options.cleanPathname.split("/").filter(Boolean);
	for (const route of options.metadataRoutes) {
		const functions = getMetadataRouteFunctions(route);
		if (route.type === "sitemap" && route.isDynamic) {
			if (functions.generateSitemaps) {
				const generatedSitemapResponse = await handleGeneratedSitemap(route, options.cleanPathname, functions);
				if (generatedSitemapResponse) return generatedSitemapResponse;
				continue;
			}
		}
		const match = matchMetadataRoute(route, options.cleanPathname, functions, getUrlParts);
		if (!match) continue;
		return route.isDynamic ? callDynamicMetadataRoute(route, match, options.makeThenableParams, functions) : serveStaticMetadataRoute(route);
	}
	return null;
}
//#endregion
export { handleMetadataRouteRequest };
