import { addBasePathToPathname, hasBasePath } from "../utils/base-path.js";
import { fillRoutePatternSegments, routePattern } from "../routing/route-pattern.js";
import { getMetadataImageRouteKind, getMetadataRouteKind, isValidMetadataImageId } from "./metadata-routes.js";
import { makeThenableParams } from "../shims/thenable-params.js";
//#region src/server/file-based-metadata.ts
function routeApplies(routePath, routePrefix) {
	if (!routePrefix) return true;
	return routePath === routePrefix || routePath.startsWith(`${routePrefix}/`);
}
function routeScore(routePrefix) {
	return routePrefix.split("/").filter(Boolean).length;
}
function routeSegmentsApply(routeSegments, routePrefixSegments) {
	if (routePrefixSegments.length > routeSegments.length) return false;
	for (let index = 0; index < routePrefixSegments.length; index++) if (routeSegments[index] !== routePrefixSegments[index]) return false;
	return true;
}
function removeParallelRouteSegments(routeSegments) {
	return routeSegments.filter((segment) => !segment.startsWith("@"));
}
function routeSegmentsApplyWithParallelSlots(routeSegments, routePrefixSegments) {
	if (routeSegmentsApply(routeSegments, routePrefixSegments)) return true;
	const visiblePrefixSegments = removeParallelRouteSegments(routePrefixSegments);
	return visiblePrefixSegments.length !== routePrefixSegments.length && routeSegmentsApply(routeSegments, visiblePrefixSegments);
}
function routeSpecificity(route) {
	return route.routeSegments?.length ?? routeScore(route.routePrefix);
}
function selectDeepestRoutes(metadataRoutes, kind, routePath, params, routeSegments) {
	if (!metadataRoutes || metadataRoutes.length === 0) return [];
	let selectedScore = -1;
	const selectedRoutes = [];
	for (const route of metadataRoutes) {
		if ((route.headData?.kind ?? getMetadataRouteKind(route)) !== kind) continue;
		if (routeSegments && route.routeSegments) {
			if (!routeSegmentsApplyWithParallelSlots(routeSegments, route.routeSegments)) continue;
			const currentScore = routeSpecificity(route);
			if (currentScore > selectedScore) {
				selectedScore = currentScore;
				selectedRoutes.length = 0;
				selectedRoutes.push(route);
				continue;
			}
			if (currentScore === selectedScore) selectedRoutes.push(route);
			continue;
		}
		const routePrefix = route.routePrefix;
		const resolvedRoutePrefix = fillRoutePatternSegments(routePrefix, params);
		const normalizedRoutePrefix = routePattern(routePrefix);
		if (!routeApplies(routePath, routePrefix) && !routeApplies(routePath, normalizedRoutePrefix) && (!resolvedRoutePrefix || !routeApplies(routePath, resolvedRoutePrefix))) continue;
		const currentScore = routeSpecificity(route);
		if (currentScore > selectedScore) {
			selectedScore = currentScore;
			selectedRoutes.length = 0;
			selectedRoutes.push(route);
			continue;
		}
		if (currentScore === selectedScore) selectedRoutes.push(route);
	}
	return selectedRoutes;
}
function isStringOrUrl(value) {
	return typeof value === "string" || typeof value === "object" && value instanceof URL;
}
function normalizeIconDescriptor(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const urlValue = Reflect.get(value, "url");
	if (!isStringOrUrl(urlValue)) return null;
	const entry = { url: urlValue };
	const sizesValue = Reflect.get(value, "sizes");
	if (typeof sizesValue === "string") entry.sizes = sizesValue;
	const typeValue = Reflect.get(value, "type");
	if (typeof typeValue === "string") entry.type = typeValue;
	const mediaValue = Reflect.get(value, "media");
	if (typeof mediaValue === "string") entry.media = mediaValue;
	return entry;
}
function normalizeIconValue(value) {
	if (isStringOrUrl(value)) return { url: value };
	return normalizeIconDescriptor(value);
}
function normalizeIconValueList(values) {
	const normalizedEntries = [];
	for (const value of values) {
		const normalizedValue = normalizeIconValue(value);
		if (normalizedValue) normalizedEntries.push(normalizedValue);
	}
	return normalizedEntries;
}
function normalizeIconEntries(icon) {
	const normalizedTopLevelValue = normalizeIconValue(icon);
	if (normalizedTopLevelValue) return [normalizedTopLevelValue];
	if (Array.isArray(icon)) return normalizeIconValueList(icon);
	if (!isIconMap(icon)) return [];
	const iconValue = icon.icon;
	if (!iconValue) return [];
	if (Array.isArray(iconValue)) return normalizeIconValueList(iconValue);
	const normalizedValue = normalizeIconValue(iconValue);
	return normalizedValue ? [normalizedValue] : [];
}
function isIconMap(value) {
	if (!value || typeof value !== "object" || value instanceof URL || Array.isArray(value)) return false;
	return normalizeIconValue(value) === null;
}
function cloneIconMap(value) {
	if (!value) return {};
	if (isIconMap(value)) return { ...value };
	const iconEntries = normalizeIconEntries(value);
	return iconEntries.length > 0 ? { icon: iconEntries } : {};
}
function buildIconEntry(headData) {
	if (headData.kind !== "favicon" && headData.kind !== "icon") return null;
	const iconEntry = { url: headData.href };
	if (headData.sizes) iconEntry.sizes = headData.sizes;
	if (headData.type) iconEntry.type = headData.type;
	return iconEntry;
}
function buildAppleEntry(headData) {
	if (headData.kind !== "apple") return null;
	const appleEntry = { url: headData.href };
	if (headData.sizes) appleEntry.sizes = headData.sizes;
	if (headData.type) appleEntry.type = headData.type;
	return appleEntry;
}
function normalizeAppleEntry(value) {
	if (isStringOrUrl(value)) return { url: value };
	return { ...value };
}
function markMetadataRouteSocialImage(entry) {
	Object.defineProperty(entry, "metadataRoute", {
		configurable: true,
		enumerable: false,
		value: true
	});
	return entry;
}
function buildSocialEntry(headData) {
	if (headData.kind !== "openGraph" && headData.kind !== "twitter") return null;
	const socialEntry = { url: headData.href };
	if (headData.width !== void 0) socialEntry.width = headData.width;
	if (headData.height !== void 0) socialEntry.height = headData.height;
	if (headData.alt) socialEntry.alt = headData.alt;
	if (headData.type) socialEntry.type = headData.type;
	return markMetadataRouteSocialImage(socialEntry);
}
function normalizeMetadataImageId(route, id) {
	const normalizedId = String(id);
	if (!isValidMetadataImageId(normalizedId)) {
		console.warn(`[vinext] Skipping metadata route ${route.servedUrl} image id "${normalizedId}" because metadata image ids must match /^[a-zA-Z0-9-_.]+$/.`);
		return null;
	}
	return normalizedId;
}
function withContentHash(href, contentHash) {
	if (!contentHash) return href;
	return `${href}?${contentHash}`;
}
function hasOwnProperty(source, key) {
	return Boolean(source && Object.prototype.hasOwnProperty.call(source, key));
}
function hasOpenGraphImages(metadata) {
	return hasOwnProperty(metadata?.openGraph, "images");
}
function hasTwitterImages(metadata) {
	return hasOwnProperty(metadata?.twitter, "images");
}
function hasIcons(metadata) {
	return Boolean(metadata?.icons);
}
function getMetadataSourceForRoute(route, options, fallbackMetadata) {
	if (!options?.metadataSources) return fallbackMetadata;
	if (!route.routeSegments) return null;
	for (let index = options.metadataSources.length - 1; index >= 0; index--) {
		const source = options.metadataSources[index];
		if (routeSegmentsApplyWithParallelSlots(source.routeSegments, route.routeSegments)) return source.metadata;
	}
	return null;
}
function socialRouteHasExplicitImagesAtSource(route, kind, options, fallbackMetadata) {
	const sourceMetadata = getMetadataSourceForRoute(route, options, fallbackMetadata);
	return kind === "openGraph" ? hasOpenGraphImages(sourceMetadata) : hasTwitterImages(sourceMetadata);
}
function iconRouteHasExplicitIconsAtSource(route, options, fallbackMetadata) {
	return hasIcons(fallbackMetadata) || hasIcons(getMetadataSourceForRoute(route, options, null));
}
function readStringProperty(source, key) {
	const value = Reflect.get(source, key);
	return typeof value === "string" ? value : void 0;
}
function readNumberProperty(source, key) {
	const value = Reflect.get(source, key);
	return typeof value === "number" ? value : void 0;
}
function readStringOrNumberProperty(source, key) {
	const value = Reflect.get(source, key);
	if (typeof value === "string" || typeof value === "number") return value;
}
function readSizeProperty(source) {
	const sizeValue = Reflect.get(source, "size");
	if (typeof sizeValue !== "object" || sizeValue === null) return;
	const width = readNumberProperty(sizeValue, "width");
	const height = readNumberProperty(sizeValue, "height");
	if (width === void 0 && height === void 0) return;
	return {
		width,
		height
	};
}
function readDynamicImageMetadataSource(source) {
	return {
		id: readStringOrNumberProperty(source, "id"),
		alt: readStringProperty(source, "alt"),
		contentType: readStringProperty(source, "contentType"),
		size: readSizeProperty(source)
	};
}
async function resolveDynamicImageMetadataSources(route, params) {
	if (!route.module || typeof route.module !== "object") return [];
	const generateImageMetadata = Reflect.get(route.module, "generateImageMetadata");
	if (typeof generateImageMetadata !== "function") return [readDynamicImageMetadataSource(route.module)];
	const result = await generateImageMetadata({ params: makeThenableParams(params) });
	if (!Array.isArray(result)) return [];
	const sources = [];
	for (const entry of result) if (typeof entry === "object" && entry !== null) {
		const source = readDynamicImageMetadataSource(entry);
		if (source.id === void 0) {
			console.warn(`[vinext] Skipping metadata route ${route.servedUrl} image metadata entry because generateImageMetadata entries must include an id.`);
			continue;
		}
		sources.push(source);
	}
	return sources;
}
async function resolveRouteHeadData(route, params) {
	if (!route.isDynamic || !route.module || typeof route.module !== "object") return route.headData ? [route.headData] : [];
	const routeKind = getMetadataImageRouteKind(route);
	if (!routeKind) return route.headData ? [route.headData] : [];
	const resolvedUrl = fillRoutePatternSegments(route.servedUrl, params);
	if (!resolvedUrl) {
		console.warn(`[vinext] Skipping metadata route ${route.servedUrl} because params did not fill all dynamic segments.`);
		return [];
	}
	const metadataSources = await resolveDynamicImageMetadataSources(route, params);
	const resolvedHeadData = [];
	for (const metadataSource of metadataSources) {
		let hrefBase = resolvedUrl;
		if (metadataSource.id !== void 0) {
			const normalizedId = normalizeMetadataImageId(route, metadataSource.id);
			if (!normalizedId) continue;
			hrefBase = `${resolvedUrl}/${normalizedId}`;
		}
		const href = withContentHash(hrefBase, route.contentHash);
		const contentType = metadataSource.contentType ?? route.contentType;
		const size = metadataSource.size;
		if (routeKind === "icon" || routeKind === "apple") {
			let sizes;
			if (size?.width !== void 0 && size.height !== void 0) sizes = `${size.width}x${size.height}`;
			resolvedHeadData.push({
				kind: routeKind,
				href,
				sizes,
				type: contentType
			});
			continue;
		}
		resolvedHeadData.push({
			kind: routeKind,
			href,
			alt: metadataSource.alt,
			height: size?.height,
			type: contentType,
			width: size?.width
		});
	}
	return resolvedHeadData;
}
async function resolveHeadDataList(routes, params) {
	return (await Promise.all(routes.map((route) => resolveRouteHeadData(route, params)))).flat();
}
/**
* Prepend the configured basePath to a file-based metadata href.
*
* Hrefs at this point are framework-built strings of the form
*   "/<route>/<file>[?<contentHash>]"
* The basePath must go before the path portion only; the query (cache-busting
* content hash) must be preserved verbatim. External URLs (http://, https://,
* //, data:, blob:) are left untouched — those are user-controlled and the
* framework has no business prefixing them.
*
* Idempotent: when the path already starts with `basePath` (or equals it),
* the path is returned unchanged so consumers may safely apply the prefix
* at any layer without risking `/base/base/icon.png`.
*/
function prefixMetadataHrefWithBasePath(href, basePath) {
	if (!basePath) return href;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return href;
	if (!href.startsWith("/")) return href;
	const queryIndex = href.indexOf("?");
	const pathname = queryIndex === -1 ? href : href.slice(0, queryIndex);
	const search = queryIndex === -1 ? "" : href.slice(queryIndex);
	if (hasBasePath(pathname, basePath)) return href;
	return `${addBasePathToPathname(pathname, basePath)}${search}`;
}
function applyBasePathToHeadDataList(headDataList, basePath) {
	if (!basePath) return headDataList;
	return headDataList.map((entry) => ({
		...entry,
		href: prefixMetadataHrefWithBasePath(entry.href, basePath)
	}));
}
async function applyFileBasedMetadata(metadata, routePath, params, metadataRoutes, options) {
	if (!metadataRoutes || metadataRoutes.length === 0) return metadata;
	const routeSegments = options?.routeSegments ?? null;
	const faviconRoutes = selectDeepestRoutes(metadataRoutes, "favicon", routePath, params, routeSegments);
	const iconRoutes = selectDeepestRoutes(metadataRoutes, "icon", routePath, params, routeSegments).filter((route) => !iconRouteHasExplicitIconsAtSource(route, options, metadata));
	const appleRoutes = selectDeepestRoutes(metadataRoutes, "apple", routePath, params, routeSegments).filter((route) => !iconRouteHasExplicitIconsAtSource(route, options, metadata));
	const openGraphRoutes = selectDeepestRoutes(metadataRoutes, "openGraph", routePath, params, routeSegments).filter((route) => !socialRouteHasExplicitImagesAtSource(route, "openGraph", options, metadata));
	const twitterRoutes = selectDeepestRoutes(metadataRoutes, "twitter", routePath, params, routeSegments).filter((route) => !socialRouteHasExplicitImagesAtSource(route, "twitter", options, metadata));
	const manifestRoutes = selectDeepestRoutes(metadataRoutes, "manifest", routePath, params, routeSegments);
	const basePath = options?.basePath ?? "";
	const [rawFaviconHeadData, rawIconHeadData, rawAppleHeadData, rawOpenGraphHeadData, rawTwitterHeadData, rawManifestHeadData] = await Promise.all([
		resolveHeadDataList(faviconRoutes, params),
		resolveHeadDataList(iconRoutes, params),
		resolveHeadDataList(appleRoutes, params),
		resolveHeadDataList(openGraphRoutes, params),
		resolveHeadDataList(twitterRoutes, params),
		resolveHeadDataList(manifestRoutes, params)
	]);
	const faviconHeadData = applyBasePathToHeadDataList(rawFaviconHeadData, basePath);
	const iconHeadData = applyBasePathToHeadDataList(rawIconHeadData, basePath);
	const appleHeadData = applyBasePathToHeadDataList(rawAppleHeadData, basePath);
	const openGraphHeadData = applyBasePathToHeadDataList(rawOpenGraphHeadData, basePath);
	const twitterHeadData = applyBasePathToHeadDataList(rawTwitterHeadData, basePath);
	const manifestHeadData = applyBasePathToHeadDataList(rawManifestHeadData, basePath);
	if (!metadata && faviconHeadData.length === 0 && iconHeadData.length === 0 && appleHeadData.length === 0 && openGraphHeadData.length === 0 && twitterHeadData.length === 0 && manifestHeadData.length === 0) return null;
	const nextMetadata = metadata ? { ...metadata } : {};
	const faviconEntries = [];
	for (const headData of faviconHeadData) {
		const iconEntry = buildIconEntry(headData);
		if (iconEntry) faviconEntries.push(iconEntry);
	}
	if (faviconEntries.length > 0) {
		const nextIcons = cloneIconMap(nextMetadata.icons);
		const normalizedIcons = normalizeIconEntries(nextIcons);
		nextIcons.icon = [...faviconEntries, ...normalizedIcons];
		nextMetadata.icons = nextIcons;
	}
	{
		const nextIcons = cloneIconMap(nextMetadata.icons);
		const iconEntries = [];
		for (const headData of iconHeadData) {
			const iconEntry = buildIconEntry(headData);
			if (iconEntry) iconEntries.push(iconEntry);
		}
		if (iconEntries.length > 0) {
			const normalizedIcons = normalizeIconEntries(nextIcons);
			nextIcons.icon = [...iconEntries, ...normalizedIcons];
		}
		const appleEntries = [];
		for (const headData of appleHeadData) {
			const appleEntry = buildAppleEntry(headData);
			if (appleEntry) appleEntries.push(appleEntry);
		}
		if (appleEntries.length > 0) {
			const existingApple = nextIcons.apple;
			const normalizedAppleEntries = [];
			if (Array.isArray(existingApple)) for (const entry of existingApple) normalizedAppleEntries.push(normalizeAppleEntry(entry));
			else if (existingApple) normalizedAppleEntries.push(normalizeAppleEntry(existingApple));
			nextIcons.apple = [...appleEntries, ...normalizedAppleEntries];
		}
		if (iconEntries.length > 0 || appleEntries.length > 0) nextMetadata.icons = nextIcons;
	}
	if (openGraphHeadData.length > 0) {
		const socialEntries = [];
		for (const headData of openGraphHeadData) {
			const socialEntry = buildSocialEntry(headData);
			if (socialEntry) socialEntries.push(socialEntry);
		}
		if (socialEntries.length > 0) {
			const nextOpenGraph = nextMetadata.openGraph ? { ...nextMetadata.openGraph } : {};
			nextOpenGraph.images = socialEntries;
			nextMetadata.openGraph = nextOpenGraph;
		}
	}
	if (twitterHeadData.length > 0) {
		const socialEntries = [];
		for (const headData of twitterHeadData) {
			const socialEntry = buildSocialEntry(headData);
			if (socialEntry) socialEntries.push(socialEntry);
		}
		if (socialEntries.length > 0) {
			const nextTwitter = nextMetadata.twitter ? { ...nextMetadata.twitter } : {};
			nextTwitter.images = socialEntries;
			nextMetadata.twitter = nextTwitter;
		}
	}
	if (manifestHeadData.length > 0 && manifestHeadData[0].kind === "manifest") nextMetadata.manifest = manifestHeadData[0].href;
	return nextMetadata;
}
//#endregion
export { applyFileBasedMetadata };
