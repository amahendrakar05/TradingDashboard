import { createAppRenderDependency, registerAppElementRenderDependencies, renderAfterAppDependencies, renderWithAppDependencyBarrier } from "./app-render-dependency.js";
import { APP_STATIC_SIBLINGS_KEY, AppElementsWire, normalizeAppElementsSlotBindings } from "./app-elements-wire.js";
import { APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL } from "./app-rsc-render-mode.js";
import { APP_PREFETCH_LOADING_SHELL_MARKER_KEY } from "./app-elements.js";
import DefaultGlobalError from "../shims/default-global-error.js";
import { ErrorBoundary, ForbiddenBoundary, GlobalErrorBoundary, NotFoundBoundary, RedirectBoundary, UnauthorizedBoundary } from "../shims/error-boundary.js";
import { AppRouterScrollTarget } from "../shims/app-router-scroll.js";
import { LayoutSegmentProvider } from "../shims/layout-segment-context.js";
import { MetadataHead, ViewportHead, renderMetadataToHtml } from "../shims/metadata.js";
import { Children as Children$1, ParallelSlot, Slot } from "../shims/slot.js";
import { resolveAppPageBranchParams, resolveAppPageSegmentParamScopeKeys, resolveAppPageSegmentParams } from "./app-page-params.js";
import { probeReactServerSubtree } from "./app-page-probe.js";
import { APP_PAGE_SEGMENT_KEY, resolveAppPageChildSegments, resolveAppPageRouteStateKey, resolveAppPageSegmentStateKey } from "./app-page-segment-state.js";
import { Fragment, Suspense } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region src/server/app-page-route-wiring.tsx
const APP_PAGE_LAYOUT_PROBE_CHILD = /* @__PURE__ */ jsx(Fragment, {});
const DEFAULT_GLOBAL_ERROR_COMPONENT = DefaultGlobalError;
function resolveSlotLayoutParams(routeSegments, treePosition, params) {
	return resolveAppPageBranchParams(routeSegments, treePosition, params);
}
function getDefaultExport(module) {
	return module?.default ?? null;
}
function getErrorBoundaryExport(module) {
	return module?.default ?? null;
}
function createAppPageTreePath(routeSegments, treePosition) {
	const treePathSegments = routeSegments?.slice(0, treePosition) ?? [];
	if (treePathSegments.length === 0) return "/";
	return `/${treePathSegments.join("/")}`;
}
function readFiniteRevalidateSeconds(module) {
	const revalidate = module?.revalidate;
	return typeof revalidate === "number" && Number.isFinite(revalidate) && revalidate > 0 ? revalidate : null;
}
function recordLayoutSkipObservationScope(options) {
	options.layoutParamAccess?.recordLayoutParamScope(options.layoutId, resolveAppPageSegmentParamScopeKeys(options.routeSegments, options.treePosition));
	const revalidateSeconds = readFiniteRevalidateSeconds(options.layoutModule);
	if (revalidateSeconds !== null) options.layoutParamAccess?.recordLayoutFiniteRevalidate(options.layoutId, revalidateSeconds);
}
function probeAppPageLayoutWithTracking(options) {
	const treePosition = options.route.layoutTreePositions?.[options.layoutIndex] ?? 0;
	const treePath = createAppPageTreePath(options.route.routeSegments, treePosition);
	const layoutId = AppElementsWire.encodeLayoutId(treePath);
	const probe = () => {
		const layoutModule = options.route.layouts[options.layoutIndex];
		const LayoutComponent = getDefaultExport(layoutModule);
		if (!LayoutComponent) return null;
		recordLayoutSkipObservationScope({
			layoutId,
			layoutModule,
			layoutParamAccess: options.layoutParamAccess,
			routeSegments: options.route.routeSegments,
			treePosition
		});
		const layoutParams = resolveAppPageSegmentParams(options.route.routeSegments, treePosition, options.matchedParams);
		return probeReactServerSubtree(/* @__PURE__ */ jsx(LayoutComponent, {
			params: options.makeThenableParams(layoutParams, options.layoutParamAccess?.createThenableParamsObserver(layoutId)),
			children: APP_PAGE_LAYOUT_PROBE_CHILD
		}));
	};
	return options.layoutParamAccess ? options.layoutParamAccess.runLayoutProbe(layoutId, probe) : probe();
}
function createAppPageLayoutEntries(route) {
	return route.layouts.map((layoutModule, index) => {
		const treePosition = route.layoutTreePositions?.[index] ?? 0;
		const treePath = createAppPageTreePath(route.routeSegments, treePosition);
		return {
			errorModule: route.errorTreePositions ? null : route.errors?.[index] ?? null,
			forbiddenModule: route.forbiddens?.[index] ?? null,
			id: AppElementsWire.encodeLayoutId(treePath),
			layoutModule,
			notFoundModule: route.notFounds?.[index] ?? null,
			unauthorizedModule: route.unauthorizeds?.[index] ?? null,
			treePath,
			treePosition
		};
	});
}
function createAppPageTemplateEntries(route) {
	return (route.templates ?? []).map((templateModule, index) => {
		const treePosition = route.templateTreePositions?.[index] ?? 0;
		const treePath = createAppPageTreePath(route.routeSegments, treePosition);
		return {
			id: AppElementsWire.encodeTemplateId(treePath),
			templateModule,
			treePath,
			treePosition
		};
	});
}
function createAppPageSourcePage(routeSegments) {
	return `/${[...routeSegments ?? [], "page"].join("/")}`;
}
function resolveAppPageLayoutSegmentProviderSegments(routeSegments, treePosition, params) {
	const segments = resolveAppPageChildSegments(routeSegments, treePosition, params);
	return segments.at(-1) === "__PAGE__" ? segments.slice(0, -1) : segments;
}
function createAppPageErrorEntries(route) {
	return (route.errorPaths ?? route.errors ?? []).flatMap((errorModule, index) => {
		if (!errorModule) return [];
		const treePosition = route.errorTreePositions?.[index];
		if (treePosition === void 0) return [];
		return [{
			errorModule,
			treePosition
		}];
	});
}
function createAppPageParallelSlotEntries(layoutIndex, layoutEntries, route, getEffectiveSlotParams, resolveSlotOverride) {
	const parallelSlots = {};
	for (const [slotKey, slot] of Object.entries(route.slots ?? {})) {
		const slotName = slot.name;
		const targetIndex = slot.layoutIndex >= 0 ? slot.layoutIndex : layoutEntries.length - 1;
		if (targetIndex !== layoutIndex) continue;
		const slotId = resolveAppPageSlotId(slot, layoutEntries[targetIndex]?.treePath ?? "/");
		const slotParams = getEffectiveSlotParams(slotKey, slotName);
		const routeSegments = resolveSlotOverride(slotKey, slotName)?.routeSegments ?? slot.routeSegments;
		parallelSlots[slotName] = /* @__PURE__ */ jsx(LayoutSegmentProvider, {
			providerId: slotId,
			segmentMap: { children: routeSegments ? resolveAppPageLayoutSegmentProviderSegments(routeSegments, 0, slotParams) : [] },
			children: /* @__PURE__ */ jsx(Slot, { id: slotId })
		});
	}
	return Object.keys(parallelSlots).length > 0 ? parallelSlots : void 0;
}
function resolveAppPageSlotId(slot, treePath) {
	const slotId = AppElementsWire.encodeSlotId(slot.name, treePath);
	if (slot.id && slot.id !== slotId) throw new Error(`[vinext] App Router slot id mismatch for @${slot.name}: graph id ${slot.id} does not match wire id ${slotId}`);
	return slotId;
}
function resolveAppPageSlotBindingState(slot, override) {
	if (getDefaultExport(override?.pageModule) ?? getDefaultExport(slot.page)) return "active";
	if (getDefaultExport(slot.default)) return "default";
	return "unmatched";
}
function createAppPageSlotBindings(route, layoutEntries, resolveSlotOverride, options) {
	const bindings = [];
	if (route.childrenSlot) {
		const ownerLayoutId = layoutEntries.find((layoutEntry) => layoutEntry.treePath === route.childrenSlot?.ownerTreePath)?.id;
		bindings.push({
			ownerLayoutId: ownerLayoutId ?? null,
			slotId: route.childrenSlot.id,
			state: route.childrenSlot.state
		});
	}
	for (const [slotKey, slot] of Object.entries(route.slots ?? {})) {
		const layoutEntry = layoutEntries[slot.layoutIndex >= 0 ? slot.layoutIndex : layoutEntries.length - 1] ?? null;
		const ownerLayoutId = layoutEntry?.id ?? null;
		const override = resolveSlotOverride(slotKey, slot.name);
		const slotId = resolveAppPageSlotId(slot, layoutEntry?.treePath ?? "/");
		const state = resolveAppPageSlotBindingState(slot, override);
		const activeRouteId = state === "active" ? options.interception?.slotId === slotId ? options.interception.targetRouteId : AppElementsWire.encodeRouteId(options.routePath, null) : null;
		bindings.push({
			...activeRouteId !== null ? { activeRouteId } : {},
			ownerLayoutId,
			slotId,
			state
		});
	}
	return normalizeAppElementsSlotBindings(bindings, { layoutIds: layoutEntries.map((entry) => entry.id) });
}
function createAppPageRouteHead(metadata, viewport, pathname, metadataPlacement, trailingSlash) {
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [
		/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
		metadata && metadataPlacement === "head" ? /* @__PURE__ */ jsx(MetadataHead, {
			metadata,
			pathname,
			trailingSlash
		}) : null,
		/* @__PURE__ */ jsx(ViewportHead, { viewport })
	] });
}
function createAppPageRouteBodyMetadata(metadata, pathname, metadataPlacement, trailingSlash) {
	if (!metadata || metadataPlacement !== "body") return null;
	return /* @__PURE__ */ jsx("div", {
		hidden: true,
		dangerouslySetInnerHTML: { __html: renderMetadataToHtml(metadata, pathname, { trailingSlash }) }
	});
}
async function AppPageStreamingMetadata(props) {
	try {
		return createAppPageRouteBodyMetadata(await props.metadata, props.pathname, "body", props.trailingSlash);
	} catch {
		return null;
	}
}
AppPageStreamingMetadata.displayName = "Vinext.StreamingMetadata";
async function AppPageMetadataOutlet(props) {
	await props.metadata;
	return null;
}
AppPageMetadataOutlet.displayName = "Vinext.MetadataOutlet";
function createAppPageStreamingMetadataOutlet(elementId, suspended = true) {
	if (!elementId) return null;
	const outlet = /* @__PURE__ */ jsx(Slot, { id: elementId });
	return suspended ? /* @__PURE__ */ jsx(Suspense, {
		fallback: null,
		children: outlet
	}) : outlet;
}
function createAppPageStreamingMetadataBody(elementId) {
	if (!elementId) return null;
	return /* @__PURE__ */ jsx("div", {
		hidden: true,
		children: /* @__PURE__ */ jsx(Suspense, {
			fallback: null,
			children: /* @__PURE__ */ jsx(Slot, { id: elementId })
		})
	});
}
function buildAppPageElements(options) {
	const renderIdentity = options.renderIdentity;
	const interceptionContext = renderIdentity?.interceptionContext ?? options.interceptionContext ?? null;
	const renderMode = options.renderMode ?? "navigation";
	const routeSegments = options.route.routeSegments ?? [];
	const routeResetKey = resolveAppPageRouteStateKey(routeSegments, options.matchedParams);
	const routeId = renderIdentity?.routeId ?? AppElementsWire.encodeRouteId(options.routePath, interceptionContext);
	const pageId = renderIdentity?.pageId ?? AppElementsWire.encodePageId(options.routePath, interceptionContext);
	const pageElementId = options.route.childrenSlot?.id ?? pageId;
	const streamingMetadataBodyId = options.streamingMetadata ? `__vinext_streaming_metadata_body:${routeId}` : null;
	const streamingMetadataOutletId = options.streamingMetadataOutlet ? `__vinext_streaming_metadata_outlet:${routeId}` : null;
	const layoutEntries = createAppPageLayoutEntries(options.route);
	const templateEntries = createAppPageTemplateEntries(options.route);
	const errorEntries = createAppPageErrorEntries(options.route);
	const metadataPlacement = options.metadataPlacement ?? "head";
	const layoutEntriesByTreePosition = /* @__PURE__ */ new Map();
	const templateEntriesByTreePosition = /* @__PURE__ */ new Map();
	const errorEntriesByTreePosition = /* @__PURE__ */ new Map();
	for (const layoutEntry of layoutEntries) layoutEntriesByTreePosition.set(layoutEntry.treePosition, layoutEntry);
	for (const templateEntry of templateEntries) templateEntriesByTreePosition.set(templateEntry.treePosition, templateEntry);
	for (const errorEntry of errorEntries) errorEntriesByTreePosition.set(errorEntry.treePosition, errorEntry);
	const layoutIndicesByTreePosition = /* @__PURE__ */ new Map();
	for (let index = 0; index < layoutEntries.length; index++) layoutIndicesByTreePosition.set(layoutEntries[index].treePosition, index);
	const layoutDependenciesByIndex = /* @__PURE__ */ new Map();
	const renderDependenciesByElementId = /* @__PURE__ */ new Map();
	const layoutDependenciesBefore = [];
	const slotDependenciesByLayoutIndex = [];
	const templateDependenciesById = /* @__PURE__ */ new Map();
	const templateDependenciesBeforeById = /* @__PURE__ */ new Map();
	const pageDependencies = [];
	const rootLayoutTreePath = layoutEntries[0]?.treePath ?? null;
	const slotNameCounts = /* @__PURE__ */ new Map();
	for (const slot of Object.values(options.route.slots ?? {})) {
		const slotName = slot.name;
		slotNameCounts.set(slotName, (slotNameCounts.get(slotName) ?? 0) + 1);
	}
	const orderedTreePositions = Array.from(/* @__PURE__ */ new Set([
		...layoutEntries.map((entry) => entry.treePosition),
		...templateEntries.map((entry) => entry.treePosition),
		...errorEntries.map((entry) => entry.treePosition)
	])).sort((left, right) => left - right);
	const resolveSlotOverride = (slotKey, slotName) => {
		const overrideByKey = options.slotOverrides?.[slotKey];
		if (overrideByKey) return overrideByKey;
		if (slotKey === slotName || (slotNameCounts.get(slotName) ?? 0) === 1) return options.slotOverrides?.[slotName];
	};
	const elements = { ...AppElementsWire.createMetadataEntries({
		interception: renderIdentity?.interception ?? options.interception ?? null,
		interceptionContext,
		layoutIds: options.route.ids?.layouts ?? layoutEntries.map((entry) => entry.id),
		rootLayoutTreePath,
		routeId,
		sourcePage: createAppPageSourcePage(options.sourcePageSegments ?? routeSegments),
		slotBindings: createAppPageSlotBindings(options.route, layoutEntries, resolveSlotOverride, {
			interception: renderIdentity?.interception ?? options.interception ?? null,
			interceptionContext,
			routePath: options.routePath
		})
	}) };
	if (options.route.staticSiblings && options.route.staticSiblings.length > 0) elements[APP_STATIC_SIBLINGS_KEY] = options.route.staticSiblings;
	if (options.streamingMetadata && streamingMetadataBodyId) elements[streamingMetadataBodyId] = /* @__PURE__ */ jsx(AppPageStreamingMetadata, {
		metadata: options.streamingMetadataTags ?? options.streamingMetadata,
		pathname: options.resolvedMetadataPathname ?? options.routePath,
		trailingSlash: options.trailingSlash
	});
	if (options.streamingMetadataOutlet && streamingMetadataOutletId) elements[streamingMetadataOutletId] = /* @__PURE__ */ jsx(AppPageMetadataOutlet, { metadata: options.streamingMetadataOutlet });
	const getEffectiveSlotParams = (slotKey, slotName) => resolveSlotOverride(slotKey, slotName)?.params ?? options.matchedParams;
	for (const treePosition of orderedTreePositions) {
		const layoutIndex = layoutIndicesByTreePosition.get(treePosition);
		if (layoutIndex !== void 0) {
			const layoutEntry = layoutEntries[layoutIndex];
			layoutDependenciesBefore[layoutIndex] = [...pageDependencies];
			if (getDefaultExport(layoutEntry.layoutModule)) {
				const layoutDependency = createAppRenderDependency();
				layoutDependenciesByIndex.set(layoutIndex, layoutDependency);
				renderDependenciesByElementId.set(layoutEntry.id, layoutDependency);
				pageDependencies.push(layoutDependency);
			}
			slotDependenciesByLayoutIndex[layoutIndex] = [...pageDependencies];
		}
		const templateEntry = templateEntriesByTreePosition.get(treePosition);
		if (!templateEntry || !getDefaultExport(templateEntry.templateModule)) continue;
		const templateDependency = createAppRenderDependency();
		templateDependenciesById.set(templateEntry.id, templateDependency);
		templateDependenciesBeforeById.set(templateEntry.id, [...pageDependencies]);
		pageDependencies.push(templateDependency);
	}
	const routeLoadingComponent = getDefaultExport(options.route.loading);
	const isPrefetchLoadingShell = renderMode === APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL;
	if (isPrefetchLoadingShell && routeLoadingComponent !== null) elements[APP_PREFETCH_LOADING_SHELL_MARKER_KEY] = "LoadingBoundary";
	elements[pageElementId] = isPrefetchLoadingShell ? null : renderAfterAppDependencies(options.element, pageDependencies);
	for (const templateEntry of templateEntries) {
		const templateComponent = getDefaultExport(templateEntry.templateModule);
		if (!templateComponent) continue;
		const TemplateComponent = templateComponent;
		const templateDependency = templateDependenciesById.get(templateEntry.id);
		const templateElement = templateDependency ? renderWithAppDependencyBarrier(/* @__PURE__ */ jsx(TemplateComponent, { children: /* @__PURE__ */ jsx(Children$1, {}) }), templateDependency) : /* @__PURE__ */ jsx(TemplateComponent, { children: /* @__PURE__ */ jsx(Children$1, {}) });
		elements[templateEntry.id] = renderAfterAppDependencies(templateElement, templateDependenciesBeforeById.get(templateEntry.id) ?? []);
	}
	for (let index = 0; index < layoutEntries.length; index++) {
		const layoutEntry = layoutEntries[index];
		const layoutComponent = getDefaultExport(layoutEntry.layoutModule);
		if (!layoutComponent) continue;
		const layoutParams = resolveAppPageSegmentParams(options.route.routeSegments, layoutEntry.treePosition, options.matchedParams);
		recordLayoutSkipObservationScope({
			layoutId: layoutEntry.id,
			layoutModule: layoutEntry.layoutModule,
			layoutParamAccess: options.layoutParamAccess,
			routeSegments: options.route.routeSegments,
			treePosition: layoutEntry.treePosition
		});
		const layoutProps = { params: options.makeThenableParams(layoutParams, options.layoutParamAccess?.createThenableParamsObserver(layoutEntry.id)) };
		for (const slot of Object.values(options.route.slots ?? {})) {
			const slotName = slot.name;
			if ((slot.layoutIndex >= 0 ? slot.layoutIndex : layoutEntries.length - 1) !== index) continue;
			layoutProps[slotName] = /* @__PURE__ */ jsx(ParallelSlot, { name: slotName });
		}
		const LayoutComponent = layoutComponent;
		const layoutDependency = layoutDependenciesByIndex.get(index);
		const layoutElement = layoutDependency ? renderWithAppDependencyBarrier(/* @__PURE__ */ jsx(LayoutComponent, {
			...layoutProps,
			children: /* @__PURE__ */ jsx(Children$1, {})
		}), layoutDependency) : /* @__PURE__ */ jsx(LayoutComponent, {
			...layoutProps,
			children: /* @__PURE__ */ jsx(Children$1, {})
		});
		elements[layoutEntry.id] = renderAfterAppDependencies(layoutElement, layoutDependenciesBefore[index] ?? []);
	}
	for (const [slotKey, slot] of Object.entries(options.route.slots ?? {})) {
		const slotName = slot.name;
		const targetIndex = slot.layoutIndex >= 0 ? slot.layoutIndex : layoutEntries.length - 1;
		const slotId = resolveAppPageSlotId(slot, layoutEntries[targetIndex]?.treePath ?? "/");
		const slotOverride = resolveSlotOverride(slotKey, slotName);
		const slotParams = getEffectiveSlotParams(slotKey, slotName);
		const slotRouteSegments = slotOverride?.routeSegments ?? slot.routeSegments ?? [];
		const slotOwnerParams = resolveAppPageSegmentParams(options.route.routeSegments, layoutEntries[targetIndex]?.treePosition ?? 0, options.matchedParams);
		const slotResetKey = resolveAppPageRouteStateKey(slotRouteSegments, slotParams);
		const overrideOrPageComponent = getDefaultExport(slotOverride?.pageModule) ?? getDefaultExport(slot.page);
		const defaultComponent = getDefaultExport(slot.default);
		if (!overrideOrPageComponent && defaultComponent && options.isRscRequest && options.mountedSlotIds?.has(slotId)) continue;
		const slotComponent = overrideOrPageComponent ?? defaultComponent;
		if (!slotComponent) {
			elements[slotId] = AppElementsWire.unmatchedSlotValue;
			continue;
		}
		const slotProps = { params: options.makeThenableParams(slotParams) };
		if (options.searchParams !== void 0) slotProps.searchParams = options.searchParams;
		if (slotOverride?.props) Object.assign(slotProps, slotOverride.props);
		let slotElement = options.createPageElement ? options.createPageElement(slotComponent, slotProps) : (() => {
			return /* @__PURE__ */ jsx(slotComponent, { ...slotProps });
		})();
		const hasSlotTreeOverride = slotOverride?.pageModule != null || slotOverride?.layoutModules !== void 0;
		const interceptLayouts = slotOverride?.layoutModules ?? [];
		for (let layoutIndex = interceptLayouts.length - 1; layoutIndex >= 0; layoutIndex--) {
			const interceptLayoutComponent = getDefaultExport(interceptLayouts[layoutIndex]);
			if (!interceptLayoutComponent) continue;
			const InterceptLayoutComponent = interceptLayoutComponent;
			const interceptLayoutParams = resolveSlotLayoutParams(slotOverride?.branchSegments ?? slotRouteSegments, slotOverride?.layoutSegments?.[layoutIndex]?.length ?? slotRouteSegments.length, slotParams);
			slotElement = /* @__PURE__ */ jsx(InterceptLayoutComponent, {
				params: options.makeThenableParams(interceptLayoutParams),
				children: slotElement
			});
		}
		if (!hasSlotTreeOverride) for (let layoutIndex = (slot.configLayouts?.length ?? 0) - 1; layoutIndex >= 0; layoutIndex--) {
			const nestedLayoutComponent = getDefaultExport(slot.configLayouts?.[layoutIndex]);
			if (!nestedLayoutComponent) continue;
			const NestedLayoutComponent = nestedLayoutComponent;
			const nestedLayoutParams = resolveSlotLayoutParams(slotRouteSegments, slot.configLayoutTreePositions?.[layoutIndex] ?? 0, slotParams);
			slotElement = /* @__PURE__ */ jsx(NestedLayoutComponent, {
				params: options.makeThenableParams({
					...slotOwnerParams,
					...nestedLayoutParams
				}),
				children: slotElement
			});
		}
		const slotLayoutComponent = overrideOrPageComponent ? getDefaultExport(slot.layout) : null;
		if (slotLayoutComponent) slotElement = /* @__PURE__ */ jsx(slotLayoutComponent, {
			params: options.makeThenableParams(slotOwnerParams),
			children: slotElement
		});
		const slotLoadingComponent = getDefaultExport(slot.loading);
		if (slotLoadingComponent) slotElement = /* @__PURE__ */ jsx(Suspense, {
			fallback: /* @__PURE__ */ jsx(slotLoadingComponent, {}),
			children: slotElement
		}, slotResetKey);
		const slotErrorComponent = getErrorBoundaryExport(slot.error);
		if (slotErrorComponent) slotElement = /* @__PURE__ */ jsx(ErrorBoundary, {
			resetKey: slotResetKey,
			fallback: slotErrorComponent,
			children: slotElement
		});
		elements[slotId] = renderAfterAppDependencies(slotElement, targetIndex >= 0 ? slotDependenciesByLayoutIndex[targetIndex] ?? [] : []);
	}
	let routeChildren = /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(LayoutSegmentProvider, {
		providerId: pageElementId,
		segmentMap: { children: [APP_PAGE_SEGMENT_KEY] },
		children: /* @__PURE__ */ jsx(Slot, { id: pageElementId })
	}), createAppPageStreamingMetadataOutlet(streamingMetadataOutletId, options.streamingMetadataOutletSuspended)] });
	if (isPrefetchLoadingShell) if (routeLoadingComponent === null) routeChildren = null;
	else routeChildren = /* @__PURE__ */ jsx(routeLoadingComponent, {});
	else {
		routeChildren = /* @__PURE__ */ jsx(RedirectBoundary, { children: routeChildren });
		if (routeLoadingComponent) routeChildren = /* @__PURE__ */ jsx(Suspense, {
			fallback: /* @__PURE__ */ jsx(routeLoadingComponent, {}),
			children: routeChildren
		}, routeResetKey);
		routeChildren = /* @__PURE__ */ jsx(AppRouterScrollTarget, { children: routeChildren });
	}
	const lastLayoutErrorModule = errorEntries.length > 0 ? errorEntries[errorEntries.length - 1].errorModule : null;
	const notFoundComponent = getDefaultExport(options.route.notFound) ?? getDefaultExport(options.rootNotFoundModule);
	if (notFoundComponent) routeChildren = /* @__PURE__ */ jsx(NotFoundBoundary, {
		resetKey: routeResetKey,
		fallback: /* @__PURE__ */ jsx(notFoundComponent, {}),
		children: routeChildren
	});
	const forbiddenComponent = getDefaultExport(options.route.forbidden) ?? getDefaultExport(options.rootForbiddenModule);
	if (forbiddenComponent) routeChildren = /* @__PURE__ */ jsx(ForbiddenBoundary, {
		resetKey: routeResetKey,
		fallback: /* @__PURE__ */ jsx(forbiddenComponent, {}),
		children: routeChildren
	});
	const unauthorizedComponent = getDefaultExport(options.route.unauthorized) ?? getDefaultExport(options.rootUnauthorizedModule);
	if (unauthorizedComponent) routeChildren = /* @__PURE__ */ jsx(UnauthorizedBoundary, {
		resetKey: routeResetKey,
		fallback: /* @__PURE__ */ jsx(unauthorizedComponent, {}),
		children: routeChildren
	});
	const pageErrorComponent = getErrorBoundaryExport(options.route.error);
	if (pageErrorComponent && options.route.error !== lastLayoutErrorModule) routeChildren = /* @__PURE__ */ jsx(ErrorBoundary, {
		resetKey: routeResetKey,
		fallback: pageErrorComponent,
		children: routeChildren
	});
	for (let index = orderedTreePositions.length - 1; index >= 0; index--) {
		const treePosition = orderedTreePositions[index];
		const segmentResetKey = resolveAppPageSegmentStateKey(routeSegments, treePosition, options.matchedParams);
		let segmentChildren = routeChildren;
		const layoutEntry = layoutEntriesByTreePosition.get(treePosition);
		const templateEntry = templateEntriesByTreePosition.get(treePosition);
		const errorEntry = errorEntriesByTreePosition.get(treePosition);
		if (layoutEntry) {
			const layoutNotFoundComponent = getDefaultExport(layoutEntry.notFoundModule);
			if (layoutNotFoundComponent) segmentChildren = /* @__PURE__ */ jsx(NotFoundBoundary, {
				resetKey: segmentResetKey,
				fallback: /* @__PURE__ */ jsx(layoutNotFoundComponent, {}),
				children: segmentChildren
			});
			const layoutForbiddenComponent = getDefaultExport(layoutEntry.forbiddenModule);
			if (layoutForbiddenComponent) segmentChildren = /* @__PURE__ */ jsx(ForbiddenBoundary, {
				resetKey: segmentResetKey,
				fallback: /* @__PURE__ */ jsx(layoutForbiddenComponent, {}),
				children: segmentChildren
			});
			const layoutUnauthorizedComponent = getDefaultExport(layoutEntry.unauthorizedModule);
			if (layoutUnauthorizedComponent) segmentChildren = /* @__PURE__ */ jsx(UnauthorizedBoundary, {
				resetKey: segmentResetKey,
				fallback: /* @__PURE__ */ jsx(layoutUnauthorizedComponent, {}),
				children: segmentChildren
			});
		}
		const segmentErrorComponent = getErrorBoundaryExport(errorEntry?.errorModule ?? layoutEntry?.errorModule);
		if (segmentErrorComponent) segmentChildren = /* @__PURE__ */ jsx(ErrorBoundary, {
			resetKey: segmentResetKey,
			fallback: segmentErrorComponent,
			children: segmentChildren
		});
		if (templateEntry && getDefaultExport(templateEntry.templateModule)) segmentChildren = /* @__PURE__ */ jsx(Slot, {
			id: templateEntry.id,
			children: segmentChildren
		}, segmentResetKey);
		if (!layoutEntry) {
			routeChildren = segmentChildren;
			continue;
		}
		const layoutHasElement = getDefaultExport(layoutEntry.layoutModule) !== null;
		const layoutIndex = layoutIndicesByTreePosition.get(treePosition) ?? -1;
		const segmentMap = { children: resolveAppPageLayoutSegmentProviderSegments(options.route.childrenRouteSegments ?? routeSegments, layoutEntry.treePosition, options.matchedParams) };
		for (const [slotKey, slot] of Object.entries(options.route.slots ?? {})) {
			const slotName = slot.name;
			if ((slot.layoutIndex >= 0 ? slot.layoutIndex : layoutEntries.length - 1) !== layoutIndex) continue;
			const slotParams = getEffectiveSlotParams(slotKey, slotName);
			const slotOverride = resolveSlotOverride(slotKey, slotName);
			if (!(getDefaultExport(slotOverride?.pageModule) !== null || getDefaultExport(slot.page) !== null) && options.isRscRequest && options.mountedSlotIds?.has(resolveAppPageSlotId(slot, layoutEntry.treePath))) continue;
			const slotRouteSegments = slotOverride?.routeSegments ?? slot.routeSegments;
			segmentMap[slotName] = slotRouteSegments ? resolveAppPageLayoutSegmentProviderSegments(slotRouteSegments, 0, slotParams) : [];
		}
		routeChildren = /* @__PURE__ */ jsx(LayoutSegmentProvider, {
			providerId: layoutEntry.id,
			segmentMap,
			children: layoutHasElement ? /* @__PURE__ */ jsx(Slot, {
				id: layoutEntry.id,
				parallelSlots: createAppPageParallelSlotEntries(layoutIndex, layoutEntries, options.route, getEffectiveSlotParams, resolveSlotOverride),
				children: segmentChildren
			}) : segmentChildren
		});
	}
	const globalErrorComponent = getErrorBoundaryExport(options.globalErrorModule);
	routeChildren = /* @__PURE__ */ jsx(GlobalErrorBoundary, {
		fallback: DEFAULT_GLOBAL_ERROR_COMPONENT,
		children: globalErrorComponent ? /* @__PURE__ */ jsx(ErrorBoundary, {
			fallback: globalErrorComponent,
			children: routeChildren
		}) : routeChildren
	});
	elements[routeId] = /* @__PURE__ */ jsxs(Fragment$1, { children: [
		createAppPageRouteHead(options.resolvedMetadata, options.resolvedViewport, options.resolvedMetadataPathname ?? options.routePath, metadataPlacement, options.trailingSlash),
		routeChildren,
		createAppPageRouteBodyMetadata(options.resolvedMetadata, options.resolvedMetadataPathname ?? options.routePath, metadataPlacement, options.trailingSlash),
		createAppPageStreamingMetadataBody(streamingMetadataBodyId)
	] });
	registerAppElementRenderDependencies(elements, renderDependenciesByElementId);
	return elements;
}
//#endregion
export { buildAppPageElements, createAppPageLayoutEntries, createAppPageRouteBodyMetadata, createAppPageSourcePage, createAppPageTreePath, probeAppPageLayoutWithTracking, resolveAppPageChildSegments };
