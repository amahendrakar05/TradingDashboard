import { AppElementsWire } from "./app-elements-wire.js";
import { APP_RSC_RENDER_MODE_NAVIGATION } from "./app-rsc-render-mode.js";
import "./app-elements.js";
import { createAppPageRenderIdentity } from "./app-page-render-identity.js";
import { matchRoutePattern } from "../routing/route-pattern.js";
import { makeThenableParams } from "../shims/thenable-params.js";
import { resolveAppPageBranchParams, resolveAppPageSegmentParams } from "./app-page-params.js";
import { resolveAppPageSpecialError } from "./app-page-execution.js";
import { prepareAppPageHead, resolveActiveParallelRouteHeadInputs } from "./app-page-head.js";
import { createAppPageSearchParamsObserver, makeObservedAppPageSearchParamsThenable } from "./app-page-search-params-observation.js";
import { buildAppPageElements, createAppPageSourcePage, createAppPageTreePath } from "./app-page-route-wiring.js";
import { resolveHttpAccessFallbackMetadata, resolveHttpAccessFallbackViewport } from "./app-page-http-access-fallback-metadata.js";
import "./app-rsc-route-matching.js";
import { resolveAppPageParentHttpAccessBoundary } from "./app-page-boundary.js";
import { sanitizeErrorForClient } from "./app-rsc-errors.js";
import { DEFAULT_GLOBAL_ERROR_MODULE } from "./default-global-error-module.js";
import { shouldServeStreamingMetadata } from "./streaming-metadata.js";
import { createElement } from "react";
//#region src/server/app-page-element-builder.ts
function resolveInterceptLayoutParams(branchSegments, layoutSegments, params) {
	return resolveAppPageBranchParams(branchSegments, layoutSegments.length, params, layoutSegments);
}
const REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference");
function isReactOwnedPageComponent(component) {
	if (typeof component !== "function") return true;
	const candidate = component;
	return candidate.$$typeof === REACT_CLIENT_REFERENCE || candidate.prototype?.isReactComponent != null;
}
/**
* Build the App Router element tree for a matched route.
*
* This is the central element-construction path for the App Router RSC
* handler. It resolves page head metadata (including parallel route metadata),
* creates the page React element, and wires it into the nested layout +
* boundary tree via {@link buildAppPageElements}.
*
* The function is extracted from the generated RSC entry template so it can
* be unit-tested independently of the code-generation machinery.
*
* Next.js equivalent: the component tree construction in
* {@link https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-component-tree.tsx|create-component-tree.tsx}
* and the page head resolution in
* {@link https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/create-metadata.tsx|create-metadata.tsx}.
*/
async function buildPageElements(options) {
	const { route, params, routePath, displayPathname = routePath, pageRequest, globalErrorModule, rootNotFoundModule, rootForbiddenModule, rootUnauthorizedModule, metadataRoutes } = options;
	const slotParamOverrides = resolveSlotParamOverrides(route, routePath);
	const { opts, searchParams, isRscRequest, mountedSlotsHeader, renderMode = APP_RSC_RENDER_MODE_NAVIGATION, observeMetadataSearchParamsAccess = false, observePageSearchParamsAccess = false, serveStreamingMetadata, isProduction = process.env.NODE_ENV === "production" } = pageRequest;
	const pageModule = route.page;
	const isSiblingIntercept = opts?.interceptSlotKey === "__vinext_page_intercept" && !!opts?.interceptPage;
	const effectivePageModule = isSiblingIntercept ? opts.interceptPage : pageModule;
	const EffectivePageComponent = effectivePageModule?.default;
	const effectiveParams = isSiblingIntercept ? opts.interceptParams ?? params : params;
	const sourcePageSegments = isSiblingIntercept ? opts?.interceptSourcePageSegments : route.routeSegments;
	const hasPageModule = !!pageModule;
	const renderIdentity = createAppPageRenderIdentity({
		displayPathname,
		matchedRoutePathname: routePath,
		targetMatchedPathname: routePath,
		interceptionContext: opts?.interceptionContext ?? null,
		interceptSourceMatchedUrl: opts?.interceptSourceMatchedUrl ?? null,
		interceptSlotId: isSiblingIntercept ? null : opts?.interceptSlotId ?? null
	});
	if ((hasPageModule || isSiblingIntercept) && !EffectivePageComponent) {
		let noExportRootLayout = null;
		const noExportLayoutIds = route.ids?.layouts ?? route.layouts.map((_, index) => AppElementsWire.encodeLayoutId(createAppPageTreePath(route.routeSegments, route.layoutTreePositions?.[index] ?? 0)));
		if (route.layouts?.length > 0) {
			const treePosition = route.layoutTreePositions?.[0] ?? 0;
			noExportRootLayout = createAppPageTreePath(route.routeSegments, treePosition);
		}
		return {
			...AppElementsWire.createMetadataEntries({
				interception: renderIdentity.interception,
				interceptionContext: renderIdentity.interceptionContext,
				layoutIds: noExportLayoutIds,
				rootLayoutTreePath: noExportRootLayout,
				routeId: renderIdentity.routeId,
				sourcePage: createAppPageSourcePage(sourcePageSegments)
			}),
			[renderIdentity.routeId]: createElement("div", null, "Page has no default export")
		};
	}
	const activeParallelRouteHeadInputs = resolveActiveParallelRouteHeadInputs({
		interceptBranchSegments: opts?.interceptBranchSegments ?? null,
		interceptLayouts: opts?.interceptLayouts ?? null,
		interceptLayoutSegments: opts?.interceptLayoutSegments ?? null,
		interceptNotFoundBranchSegments: opts?.interceptNotFoundBranchSegments ?? null,
		interceptNotFound: opts?.interceptNotFound ?? null,
		interceptNotFoundTreePosition: opts?.interceptNotFoundTreePosition ?? null,
		interceptPage: opts?.interceptPage ?? null,
		interceptParams: opts?.interceptParams ?? null,
		interceptSlotKey: opts?.interceptSlotKey ?? null,
		interceptSourcePageSegments: opts?.interceptSourcePageSegments ?? null,
		layoutTreePositions: route.layoutTreePositions,
		params,
		routeSegments: route.routeSegments ?? [],
		slotParams: slotParamOverrides,
		slots: route.slots ?? null
	});
	const primaryParallelRouteHeadInput = isSiblingIntercept ? {
		head: {
			layoutModules: opts?.interceptLayouts ?? [],
			layoutParams: (opts?.interceptLayoutSegments ?? []).map((segments) => resolveInterceptLayoutParams(opts?.interceptBranchSegments ?? segments, segments, effectiveParams)),
			pageModule: effectivePageModule ?? null,
			params: effectiveParams,
			routeSegments: opts?.interceptSourcePageSegments ?? route.routeSegments ?? []
		},
		...opts?.interceptNotFound ? {
			notFoundModule: opts.interceptNotFound,
			notFoundParams: resolveAppPageBranchParams(opts.interceptNotFoundBranchSegments ?? opts.interceptBranchSegments ?? route.routeSegments ?? [], opts.interceptNotFoundTreePosition ?? 0, effectiveParams)
		} : {},
		ownerTreePosition: route.routeSegments?.length ?? 0
	} : null;
	const parallelRoutes = [...activeParallelRouteHeadInputs.map((input) => input.head), ...primaryParallelRouteHeadInput ? [primaryParallelRouteHeadInput.head] : []];
	const metadataSearchParamsObserver = observeMetadataSearchParamsAccess ? createAppPageSearchParamsObserver() : void 0;
	const preparedHead = prepareAppPageHead({
		applyFileBasedMetadata: options.applyFileBasedMetadata,
		basePath: options.basePath ?? "",
		layoutModules: route.layouts,
		layoutTreePositions: route.layoutTreePositions,
		metadataRoutes,
		pageModule: isSiblingIntercept ? null : effectivePageModule ?? null,
		parallelRoutes,
		params: effectiveParams,
		routePath: route.pattern,
		routeSegments: route.routeSegments ?? null,
		searchParams,
		searchParamsObserver: metadataSearchParamsObserver
	});
	const { hasDynamicMetadata, pageSearchParams } = preparedHead;
	const streamGeneratedHead = serveStreamingMetadata ?? shouldServeStreamingMetadata(pageRequest.request.headers.get("user-agent") ?? "", options.htmlLimitedBots);
	const metadataPlacement = hasDynamicMetadata && streamGeneratedHead ? "body" : "head";
	const shouldDeferMetadata = metadataPlacement === "body";
	const streamingMetadata = shouldDeferMetadata ? isProduction ? preparedHead.metadata.catch((error) => {
		throw sanitizeErrorForClient(error, "production");
	}) : preparedHead.metadata : null;
	streamingMetadata?.catch(() => null);
	const resolveNotFoundFallbackPlanOptions = () => {
		const routeBoundaryModule = route.notFound;
		const parentBoundary = resolveAppPageParentHttpAccessBoundary({
			layoutIndex: route.layouts.length,
			rootForbiddenModule,
			rootNotFoundModule,
			rootUnauthorizedModule,
			routeForbiddenModules: route.forbiddens,
			routeNotFoundModules: route.notFounds,
			routeUnauthorizedModules: route.unauthorizeds,
			statusCode: 404
		});
		const boundaryModule = routeBoundaryModule ?? parentBoundary.module;
		const boundaryTreePosition = routeBoundaryModule ? route.notFoundTreePosition : parentBoundary.layoutIndex === null ? null : route.layoutTreePositions?.[parentBoundary.layoutIndex];
		return {
			boundaryModule,
			boundaryParams: boundaryModule && boundaryTreePosition != null ? resolveAppPageSegmentParams(route.routeSegments ?? [], boundaryTreePosition, effectiveParams) : {},
			layoutModules: route.layouts,
			layoutTreePositions: route.layoutTreePositions,
			parallelBranches: activeParallelRouteHeadInputs,
			params: effectiveParams,
			primaryParallelBranch: primaryParallelRouteHeadInput,
			routeSegments: route.routeSegments ?? null
		};
	};
	let viewportErrorOutlet = null;
	let metadataErrorOutlet = null;
	const resolveMetadataErrorTags = async (error) => {
		if (resolveAppPageSpecialError(error)?.kind !== "http-access-fallback") return null;
		return resolveHttpAccessFallbackMetadata({
			applyFileBasedMetadata: options.applyFileBasedMetadata,
			basePath: options.basePath ?? "",
			...resolveNotFoundFallbackPlanOptions(),
			metadataRoutes,
			routePath: route.pattern
		}).catch(() => null);
	};
	const [resolvedMetadata, resolvedViewport] = await Promise.all([shouldDeferMetadata ? Promise.resolve(null) : preparedHead.metadata.catch((error) => {
		metadataErrorOutlet = Promise.reject(isProduction ? sanitizeErrorForClient(error, "production") : error);
		metadataErrorOutlet.catch(() => null);
		return resolveMetadataErrorTags(error);
	}), preparedHead.viewport.catch(async (error) => {
		const specialError = resolveAppPageSpecialError(error);
		viewportErrorOutlet = Promise.reject(isProduction ? sanitizeErrorForClient(error, "production") : error);
		viewportErrorOutlet.catch(() => null);
		return specialError?.kind === "http-access-fallback" ? resolveHttpAccessFallbackViewport(resolveNotFoundFallbackPlanOptions()).catch(() => ({})) : {};
	})]);
	const streamingMetadataTags = shouldDeferMetadata ? preparedHead.metadata.catch(resolveMetadataErrorTags) : null;
	const streamingMetadataOutletInputs = [
		streamingMetadata,
		metadataErrorOutlet,
		viewportErrorOutlet
	].filter((promise) => promise !== null).map((promise) => Promise.resolve(promise));
	const streamingMetadataOutlet = streamingMetadataOutletInputs.length > 0 ? Promise.all(streamingMetadataOutletInputs).then(() => null) : null;
	streamingMetadataOutlet?.catch(() => null);
	const pageProps = { params: makeThenableParams(effectiveParams) };
	const hasRequestSearchParams = Object.keys(pageSearchParams).length > 0;
	const createPageElement = (PageComponent, props) => {
		if (isReactOwnedPageComponent(PageComponent)) {
			const invocationProps = { ...props };
			if (searchParams) invocationProps.searchParams = observePageSearchParamsAccess ? makeObservedAppPageSearchParamsThenable(pageSearchParams, { markDynamic: hasRequestSearchParams }) : makeThenableParams(pageSearchParams);
			return createElement(PageComponent, invocationProps);
		}
		const ServerPageComponent = PageComponent;
		const PageInvoker = () => {
			const invocationProps = { ...props };
			if (searchParams) invocationProps.searchParams = observePageSearchParamsAccess ? makeObservedAppPageSearchParamsThenable(pageSearchParams) : makeThenableParams(pageSearchParams);
			return ServerPageComponent(invocationProps);
		};
		return createElement(PageInvoker);
	};
	const pageSearchParamsThenable = searchParams ? makeThenableParams(pageSearchParams) : void 0;
	const mountedSlotIds = mountedSlotsHeader ? new Set(mountedSlotsHeader.split(" ")) : null;
	const slotOverrides = buildSlotOverrides(route, params, routePath, opts);
	let siblingInterceptElement = isSiblingIntercept && EffectivePageComponent ? createPageElement(EffectivePageComponent, pageProps) : null;
	if (isSiblingIntercept && siblingInterceptElement !== null && opts?.interceptLayouts?.length) for (let i = opts.interceptLayouts.length - 1; i >= 0; i--) {
		const LayoutComponent = opts.interceptLayouts[i]?.default;
		if (LayoutComponent) {
			const interceptLayoutSegments = opts.interceptLayoutSegments?.[i] ?? [];
			siblingInterceptElement = createElement(LayoutComponent, { params: makeThenableParams(resolveInterceptLayoutParams(opts.interceptBranchSegments ?? interceptLayoutSegments, interceptLayoutSegments, effectiveParams)) }, siblingInterceptElement);
		}
	}
	return buildAppPageElements({
		element: isSiblingIntercept ? siblingInterceptElement : EffectivePageComponent ? createPageElement(EffectivePageComponent, pageProps) : null,
		createPageElement,
		globalErrorModule: globalErrorModule ?? DEFAULT_GLOBAL_ERROR_MODULE,
		isRscRequest,
		layoutParamAccess: options.layoutParamAccess,
		mountedSlotIds,
		makeThenableParams,
		matchedParams: params,
		metadataPlacement,
		resolvedMetadata,
		resolvedMetadataPathname: routePath,
		resolvedViewport,
		streamingMetadata,
		streamingMetadataOutlet,
		streamingMetadataOutletSuspended: streamGeneratedHead,
		streamingMetadataTags,
		renderIdentity,
		routePath,
		sourcePageSegments,
		rootNotFoundModule: rootNotFoundModule ?? null,
		rootForbiddenModule: rootForbiddenModule ?? null,
		rootUnauthorizedModule: rootUnauthorizedModule ?? null,
		route,
		searchParams: pageSearchParamsThenable,
		slotOverrides,
		renderMode,
		trailingSlash: options.trailingSlash
	});
}
/**
* Build the per-request `slotOverrides` map. Combines:
*  - Interception overrides (existing behavior — swap in the intercepting page
*    and its layouts when the request is intercepted into this slot).
*  - Slot-specific param extraction for inherited slots whose URL pattern
*    has different param names than the route's. The runtime matches the
*    cleaned request path against `slot.slotPatternParts` to produce
*    slot-scoped params, which `app-page-route-wiring` then hands to the
*    slot page instead of the route's matched params.
*
* `routePath` is the already-normalized request pathname (basePath stripped,
* RSC suffix removed). Re-parsing `request.url` here would re-introduce the
* basePath and silently break the match for any app that configures one.
*/
function buildSlotOverrides(route, routeParams, routePath, opts) {
	const overrides = {};
	if (opts && opts.interceptSlotKey && opts.interceptPage && opts.interceptSlotKey !== "__vinext_page_intercept") overrides[opts.interceptSlotKey] = {
		branchSegments: opts.interceptBranchSegments ?? null,
		layoutModules: opts.interceptLayouts || null,
		layoutSegments: opts.interceptLayoutSegments ?? null,
		pageModule: opts.interceptPage,
		params: opts.interceptParams || routeParams,
		routeSegments: resolveInterceptedSlotSegments(opts.interceptSourcePageSegments, opts.interceptSlotKey)
	};
	const slotParamOverrides = resolveSlotParamOverrides(route, routePath);
	for (const [slotKey, params] of Object.entries(slotParamOverrides ?? {})) {
		const existing = overrides[slotKey];
		overrides[slotKey] = existing ? {
			...existing,
			params: existing.params ?? params
		} : { params };
	}
	return Object.keys(overrides).length > 0 ? overrides : null;
}
function resolveInterceptedSlotSegments(sourcePageSegments, slotKey) {
	if (!sourcePageSegments) return null;
	const markerTraversals = [
		{
			prefix: "(...)",
			levels: Number.POSITIVE_INFINITY
		},
		{
			prefix: "(..)(..)",
			levels: 2
		},
		{
			prefix: "(..)",
			levels: 1
		},
		{
			prefix: "(.)",
			levels: 0
		}
	];
	const markerIndex = sourcePageSegments.findIndex((segment) => markerTraversals.some(({ prefix }) => segment.startsWith(prefix)));
	if (markerIndex < 0) return null;
	const slotPathSeparator = slotKey.indexOf("@");
	const ownerSegments = (slotPathSeparator >= 0 ? slotKey.slice(slotPathSeparator + 1) : "").split("/").filter(Boolean);
	let segmentStart = ownerSegments.length;
	if (segmentStart === 0 || segmentStart > markerIndex || !ownerSegments.every((segment, index) => sourcePageSegments[index] === segment)) {
		let slotName = null;
		for (let index = ownerSegments.length - 1; index >= 0; index--) if (ownerSegments[index].startsWith("@")) {
			slotName = ownerSegments[index];
			break;
		}
		let slotIndex = -1;
		if (slotName) {
			for (let index = markerIndex - 1; index >= 0; index--) if (sourcePageSegments[index] === slotName) {
				slotIndex = index;
				break;
			}
		}
		if (slotIndex < 0) return null;
		segmentStart = slotIndex + 1;
	}
	const routeSegments = sourcePageSegments.slice(segmentStart, markerIndex).filter((segment) => !segment.startsWith("@") && !(segment.startsWith("(") && segment.endsWith(")")));
	const markerSegment = sourcePageSegments[markerIndex];
	const marker = markerTraversals.find(({ prefix }) => markerSegment.startsWith(prefix));
	if (!marker) return null;
	if (Number.isFinite(marker.levels)) routeSegments.splice(Math.max(0, routeSegments.length - marker.levels), marker.levels);
	else routeSegments.length = 0;
	const targetSegment = markerSegment.slice(marker.prefix.length);
	if (targetSegment) routeSegments.push(targetSegment);
	routeSegments.push(...sourcePageSegments.slice(markerIndex + 1).filter((segment) => !segment.startsWith("@") && !(segment.startsWith("(") && segment.endsWith(")"))));
	return routeSegments;
}
function resolveSlotParamOverrides(route, routePath) {
	const overrides = {};
	const slots = route.slots;
	if (slots) {
		let urlParts = null;
		const routeParamSet = collectParamNameSet(route.params);
		for (const [slotKey, slot] of Object.entries(slots)) {
			const patternParts = slot.slotPatternParts;
			const paramNames = slot.slotParamNames;
			if (!patternParts || patternParts.length === 0) continue;
			if (paramNames && paramNames.every((name) => routeParamSet.has(name))) continue;
			if (urlParts === null) urlParts = routePath.split("/").filter(Boolean);
			const matched = matchRoutePattern(urlParts, patternParts);
			if (!matched) continue;
			overrides[slotKey] = matched;
		}
	}
	return Object.keys(overrides).length > 0 ? overrides : null;
}
function mergeAppPageParams(target, source) {
	for (const [key, value] of Object.entries(source)) target[key] = value;
}
function isDefaultExportModule(module) {
	return typeof module === "object" && module !== null;
}
function hasDefaultExport(module) {
	if (!isDefaultExportModule(module)) return false;
	return module?.default !== null && module?.default !== void 0;
}
function resolveAppPageNavigationParams(route, routeParams, routePath, opts) {
	const navigationParams = { ...routeParams };
	const slotParamOverrides = resolveSlotParamOverrides(route, routePath);
	for (const [slotKey, slot] of Object.entries(route.slots ?? {})) {
		const isInterceptedSlot = opts?.interceptSlotKey === slotKey && opts.interceptSlotKey !== "__vinext_page_intercept" && hasDefaultExport(opts.interceptPage);
		if (!isInterceptedSlot && !hasDefaultExport(slot.page) && !hasDefaultExport(slot.default)) continue;
		mergeAppPageParams(navigationParams, isInterceptedSlot ? opts?.interceptParams ?? routeParams : slotParamOverrides?.[slotKey] ?? routeParams);
	}
	return navigationParams;
}
function collectParamNameSet(params) {
	const set = /* @__PURE__ */ new Set();
	if (params) for (const name of params) set.add(name);
	return set;
}
//#endregion
export { buildPageElements, resolveAppPageNavigationParams, resolveInterceptedSlotSegments, resolveSlotParamOverrides };
