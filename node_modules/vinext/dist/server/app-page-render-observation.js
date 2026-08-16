import { fnv1a64 } from "../utils/hash.js";
import { AppElementsWire, isAppElementsRecord } from "./app-elements-wire.js";
import { normalizeMountedSlotsHeader } from "./app-mounted-slots-header.js";
import "./app-elements.js";
import { consumeDynamicUsage, consumeInvalidDynamicUsageError, consumeRenderRequestApiUsage } from "../shims/headers.js";
import { _consumeRequestScopedCacheLife } from "../shims/cache-request-state.js";
import { consumeDynamicFetchObservations } from "../shims/fetch-cache.js";
import { buildRenderObservation, buildRenderRequestApiObservations } from "./cache-proof.js";
//#region src/server/app-page-render-observation.ts
function readRootBoundaryId(element) {
	const rootLayoutTreePath = element[AppElementsWire.keys.rootLayout];
	return typeof rootLayoutTreePath === "string" ? rootLayoutTreePath : null;
}
function readRouteId(element, routePattern) {
	if (isAppElementsRecord(element)) {
		const routeId = element[AppElementsWire.keys.route];
		if (typeof routeId === "string") return routeId;
	}
	return AppElementsWire.encodeRouteId(routePattern, null);
}
function createMountedSlotsFingerprint(mountedSlotsHeader) {
	const normalized = normalizeMountedSlotsHeader(mountedSlotsHeader);
	return normalized ? `slots:${fnv1a64(normalized)}` : null;
}
function mergeObservedRequestApis(observed, params) {
	const merged = new Set(observed);
	if (Object.keys(params).length > 0) merged.add("params");
	return [...merged].sort();
}
function createEmptyAppPageRenderObservationState() {
	return {
		dynamicFetches: [],
		requestApis: []
	};
}
function consumeAppPageRenderObservationState() {
	return {
		dynamicFetches: consumeDynamicFetchObservations(),
		requestApis: consumeRenderRequestApiUsage()
	};
}
function discardAppPageRenderState() {
	_consumeRequestScopedCacheLife();
	consumeDynamicFetchObservations();
	consumeRenderRequestApiUsage();
	consumeInvalidDynamicUsageError();
	consumeDynamicUsage();
}
function createAppPageRenderObservation(options) {
	return buildRenderObservation({
		boundaryOutcome: options.boundaryOutcome,
		cacheability: options.cacheability,
		cacheTags: options.cacheTags,
		completeness: options.completeness,
		dynamicFetches: options.state.dynamicFetches,
		output: options.output,
		pathTags: [options.cleanPathname],
		requestApis: buildRenderRequestApiObservations({
			completeness: options.completeness,
			observed: mergeObservedRequestApis(options.state.requestApis, options.params)
		})
	});
}
function createAppPageRscOutputScope(options) {
	return {
		kind: "app-rsc",
		mountedSlotsFingerprint: createMountedSlotsFingerprint(options.mountedSlotsHeader),
		renderEpoch: options.renderEpoch,
		rootBoundaryId: options.rootBoundaryId ?? (isAppElementsRecord(options.element) ? readRootBoundaryId(options.element) : null),
		routeId: readRouteId(options.element, options.routePattern)
	};
}
function createAppPageHtmlOutputScope(options) {
	return {
		kind: "app-html",
		renderEpoch: options.renderEpoch,
		rootBoundaryId: options.rootBoundaryId ?? (isAppElementsRecord(options.element) ? readRootBoundaryId(options.element) : null),
		routeId: readRouteId(options.element, options.routePattern)
	};
}
//#endregion
export { consumeAppPageRenderObservationState, createAppPageHtmlOutputScope, createAppPageRenderObservation, createAppPageRscOutputScope, createEmptyAppPageRenderObservationState, discardAppPageRenderState };
