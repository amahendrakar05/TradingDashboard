import { isEdgeApiRuntime } from "./edge-api-runtime.js";
//#region src/server/app-segment-config.ts
const DYNAMIC_VALUES = /* @__PURE__ */ new Set([
	"auto",
	"error",
	"force-dynamic",
	"force-static"
]);
const FETCH_CACHE_VALUES = /* @__PURE__ */ new Set([
	"auto",
	"default-cache",
	"default-no-store",
	"force-cache",
	"force-no-store",
	"only-cache",
	"only-no-store"
]);
function isRouteSegmentDynamic(value) {
	return DYNAMIC_VALUES.has(value);
}
function isRouteSegmentFetchCache(value) {
	return FETCH_CACHE_VALUES.has(value);
}
function isRouteSegmentRuntime(value) {
	return value === "edge" || value === "experimental-edge" || value === "nodejs";
}
function resolveRevalidateSeconds(current, value) {
	if (value === false) {
		if (current === null) return Infinity;
		return current === Infinity ? Infinity : current;
	}
	if (typeof value !== "number") return current;
	if (current === null) return value;
	return value < current ? value : current;
}
function resolveDynamicStaleTimeSeconds(current, value) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return current;
	return current === void 0 ? value : Math.min(current, value);
}
function isDynamicSegment(segment) {
	return segment.startsWith("[") && segment.endsWith("]");
}
function resolveSegmentConfigOwnerPosition(routeSegments, treePosition) {
	let ownerPosition = Math.min(treePosition - 1, routeSegments.length - 1);
	while (ownerPosition >= 0) {
		const segment = routeSegments[ownerPosition];
		if (!segment.startsWith("@") && !(segment.startsWith("(") && segment.endsWith(")"))) break;
		ownerPosition -= 1;
	}
	return ownerPosition;
}
function getParallelSegments(options) {
	if (!options.parallelBranches) return options.parallelSegments ?? [];
	return options.parallelBranches.flatMap((branch) => branch ? [
		branch.layout,
		...branch.configLayouts ?? [],
		branch.page
	] : []);
}
function resolveDynamicParamsConfig(options) {
	const parallelSegments = getParallelSegments(options);
	const segments = [
		...options.layouts ?? [],
		options.page,
		...parallelSegments
	];
	let dynamicParamsConfig;
	for (const segment of segments) if (segment?.dynamicParams === false) dynamicParamsConfig = false;
	else if (segment?.dynamicParams === true && dynamicParamsConfig !== false) dynamicParamsConfig = true;
	if (dynamicParamsConfig !== false || !options.routeSegments) return dynamicParamsConfig;
	const routeSegments = options.routeSegments;
	let lastDynamicPosition = -1;
	for (let index = routeSegments.length - 1; index >= 0; index--) if (isDynamicSegment(routeSegments[index])) {
		lastDynamicPosition = index;
		break;
	}
	if (lastDynamicPosition < 0) return dynamicParamsConfig;
	const layouts = options.layouts ?? [];
	const layoutPositions = options.layoutTreePositions ?? [];
	let lastDynamicSegmentIsStaticOnly = false;
	let lastDynamicSegmentHasStaticParams = false;
	layouts.forEach((layout, index) => {
		if (resolveSegmentConfigOwnerPosition(routeSegments, layoutPositions[index] ?? 0) !== lastDynamicPosition) return;
		if (layout?.dynamicParams === false) lastDynamicSegmentIsStaticOnly = true;
		if (typeof layout?.generateStaticParams === "function") lastDynamicSegmentHasStaticParams = true;
	});
	if (options.page?.dynamicParams === false) lastDynamicSegmentIsStaticOnly = true;
	if (typeof options.page?.generateStaticParams === "function") lastDynamicSegmentHasStaticParams = true;
	for (const branch of options.parallelBranches ?? []) {
		if (!branch) continue;
		const branchStartPosition = routeSegments.length - (branch.routeSegments?.length ?? 0);
		const checkSegment = (segment, ownerPosition) => {
			if (ownerPosition !== lastDynamicPosition) return;
			if (segment?.dynamicParams === false) lastDynamicSegmentIsStaticOnly = true;
			if (typeof segment?.generateStaticParams === "function") lastDynamicSegmentHasStaticParams = true;
		};
		checkSegment(branch.layout, branchStartPosition - 1);
		branch.configLayouts?.forEach((layout, index) => {
			checkSegment(layout, branchStartPosition + (branch.configLayoutTreePositions?.[index] ?? 0) - 1);
		});
		checkSegment(branch.page, branchStartPosition + (branch.routeSegments?.length ?? 0) - 1);
	}
	if (!options.parallelBranches) for (const segment of parallelSegments) {
		if (segment?.dynamicParams === false) lastDynamicSegmentIsStaticOnly = true;
		if (typeof segment?.generateStaticParams === "function") lastDynamicSegmentHasStaticParams = true;
	}
	return lastDynamicSegmentIsStaticOnly || lastDynamicSegmentHasStaticParams ? false : void 0;
}
function isCacheFetchCacheMode(value) {
	return value === "default-cache" || value === "force-cache" || value === "only-cache";
}
function describeFetchCacheConflict(value) {
	return `Route segment config has incompatible fetchCache values including "${value}".`;
}
/**
* Resolve the route segment config that applies to an App page route.
*
* Next.js collects config from every segment in the loader tree and reduces it
* into the effective route config. The generated vinext entry already knows
* the concrete layout/page modules for a route, so it should only describe
* those modules and delegate the behavior to this helper.
*/
function resolveAppPageSegmentConfig(options) {
	const segments = [...options.layouts ?? [], options.page];
	const parallelSegments = getParallelSegments(options);
	const config = { revalidateSeconds: null };
	config.dynamicParamsConfig = resolveDynamicParamsConfig(options);
	let hasForceCache = false;
	let hasForceNoStore = false;
	let hasOnlyCache = false;
	let hasOnlyNoStore = false;
	let hasParentDefaultNoStore = false;
	let hasForceDynamic = false;
	for (const segment of segments) {
		if (!segment) continue;
		if (isRouteSegmentDynamic(segment.dynamic)) {
			if (segment.dynamic === "force-dynamic") hasForceDynamic = true;
			config.dynamicConfig = hasForceDynamic ? "force-dynamic" : segment.dynamic;
		}
		if (isRouteSegmentRuntime(segment.runtime)) config.runtime = segment.runtime;
		if (isRouteSegmentFetchCache(segment.fetchCache)) {
			const fetchCache = segment.fetchCache;
			if (hasParentDefaultNoStore && (fetchCache === "auto" || isCacheFetchCacheMode(fetchCache))) throw new Error(describeFetchCacheConflict(fetchCache));
			if (fetchCache === "force-cache") hasForceCache = true;
			if (fetchCache === "force-no-store") hasForceNoStore = true;
			if (fetchCache === "only-cache") hasOnlyCache = true;
			if (fetchCache === "only-no-store") hasOnlyNoStore = true;
			if (hasForceCache && hasForceNoStore || !hasForceCache && !hasForceNoStore && hasOnlyCache && hasOnlyNoStore) throw new Error(describeFetchCacheConflict(fetchCache));
			if (fetchCache === "default-no-store") hasParentDefaultNoStore = true;
			if (hasForceCache) config.fetchCache = "force-cache";
			else if (hasForceNoStore) config.fetchCache = "force-no-store";
			else if (hasOnlyCache) config.fetchCache = "only-cache";
			else if (hasOnlyNoStore) config.fetchCache = "only-no-store";
			else config.fetchCache = fetchCache;
		}
		config.revalidateSeconds = resolveRevalidateSeconds(config.revalidateSeconds, segment.revalidate);
	}
	for (const segment of parallelSegments) {
		if (!segment) continue;
		if (segment.dynamic === "force-dynamic") {
			hasForceDynamic = true;
			config.dynamicConfig = "force-dynamic";
		} else if (config.dynamicConfig === void 0 && isRouteSegmentDynamic(segment.dynamic)) config.dynamicConfig = segment.dynamic;
		if (config.runtime === void 0 && isRouteSegmentRuntime(segment.runtime)) config.runtime = segment.runtime;
		if (isRouteSegmentFetchCache(segment.fetchCache)) {
			const fetchCache = segment.fetchCache;
			if (hasParentDefaultNoStore && (fetchCache === "auto" || isCacheFetchCacheMode(fetchCache))) throw new Error(describeFetchCacheConflict(fetchCache));
			if (fetchCache === "force-cache") hasForceCache = true;
			if (fetchCache === "force-no-store") hasForceNoStore = true;
			if (fetchCache === "only-cache") hasOnlyCache = true;
			if (fetchCache === "only-no-store") hasOnlyNoStore = true;
			if (hasForceCache && hasForceNoStore || !hasForceCache && !hasForceNoStore && hasOnlyCache && hasOnlyNoStore) throw new Error(describeFetchCacheConflict(fetchCache));
			if (fetchCache === "default-no-store") hasParentDefaultNoStore = true;
			if (hasForceCache) config.fetchCache = "force-cache";
			else if (hasForceNoStore) config.fetchCache = "force-no-store";
			else if (hasOnlyCache) config.fetchCache = "only-cache";
			else if (hasOnlyNoStore) config.fetchCache = "only-no-store";
			else if (config.fetchCache === void 0) config.fetchCache = fetchCache;
		}
		config.revalidateSeconds = resolveRevalidateSeconds(config.revalidateSeconds, segment.revalidate);
	}
	for (const segment of [options.page, ...options.parallelPages ?? []]) {
		if (!segment) continue;
		config.dynamicStaleTimeSeconds = resolveDynamicStaleTimeSeconds(config.dynamicStaleTimeSeconds, segment.unstable_dynamicStaleTime);
	}
	if (config.dynamicConfig === "force-dynamic") config.revalidateSeconds = 0;
	if (config.fetchCache === void 0) {
		if (config.dynamicConfig === "error") config.fetchCache = "only-cache";
	}
	return config;
}
function resolveAppPageFetchCacheMode(options) {
	return resolveAppPageSegmentConfig(options).fetchCache ?? null;
}
/**
* Resolve the `fetchCache` segment config exported by a route handler module.
*
* Route handlers have no layout chain, so the module's own export applies
* directly. Mirrors upstream's app-route module, which copies
* `userland.fetchCache` into the work store before invoking the handler.
*/
function resolveAppRouteHandlerFetchCacheMode(handler) {
	return isRouteSegmentFetchCache(handler.fetchCache) ? handler.fetchCache : null;
}
function isEdgeRuntime(runtime) {
	return isEdgeApiRuntime(runtime);
}
//#endregion
export { isEdgeRuntime, resolveAppPageFetchCacheMode, resolveAppPageSegmentConfig, resolveAppRouteHandlerFetchCacheMode };
