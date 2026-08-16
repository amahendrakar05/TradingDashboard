import path, { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { decodeRouteSegment, isInvisibleSegment, sortRoutes } from "./utils.js";
import { findFileWithExts, scanWithExtensions } from "./file-matcher.js";
import { validateRoutePatterns } from "./route-validation.js";
import { compareStrings } from "../utils/compare.js";
import fs from "node:fs";
import { createHash } from "node:crypto";
//#region src/routing/app-route-graph.ts
/**
* App Router route graph construction.
*
* Scans app/ directories and materializes route metadata before the request-time
* matcher consumes it. Keep request matching and cache ownership in app-router.ts.
*/
function createAppRouteGraphRouteId(pattern) {
	return `route:${pattern}`;
}
function createAppRouteGraphPageId(pattern) {
	return `page:${pattern}`;
}
function createAppRouteGraphRouteHandlerId(pattern) {
	return `route-handler:${pattern}`;
}
function createAppRouteGraphLayoutId(treePath) {
	return `layout:${treePath}`;
}
function createAppRouteGraphTemplateId(treePath) {
	return `template:${treePath}`;
}
function createAppRouteGraphSlotId(slotName, ownerTreePath) {
	return `slot:${slotName}:${ownerTreePath}`;
}
function createAppRouteGraphDefaultId(slotId) {
	return `default:${slotId}`;
}
const SIBLING_INTERCEPT_SLOT_NAME = "__vinext_sibling_intercept";
function createAppRouteGraphSiblingInterceptSlotId(sourcePattern) {
	return createAppRouteGraphSlotId(SIBLING_INTERCEPT_SLOT_NAME, sourcePattern);
}
function createAppRouteGraphInterceptionId(slotId, sourcePattern, targetPattern) {
	return `interception:${slotId}:${sourcePattern}->${targetPattern}`;
}
function createAppRouteGraphRootBoundaryId(treePath) {
	return `root-boundary:${treePath}`;
}
const compareStableStrings = compareStrings;
function sortedMapValues(map) {
	return Array.from(map.entries()).sort(([left], [right]) => compareStableStrings(left, right)).map(([, value]) => value);
}
function createRouteManifest(routes) {
	const segmentGraph = createStaticSegmentGraph(routes);
	return {
		graphVersion: createRouteManifestGraphVersion(segmentGraph),
		segmentGraph
	};
}
function createStaticSegmentGraph(routes) {
	const routeEntries = /* @__PURE__ */ new Map();
	const pages = /* @__PURE__ */ new Map();
	const routeHandlers = /* @__PURE__ */ new Map();
	const layouts = /* @__PURE__ */ new Map();
	const templates = /* @__PURE__ */ new Map();
	const slots = /* @__PURE__ */ new Map();
	const defaults = /* @__PURE__ */ new Map();
	const slotBindings = /* @__PURE__ */ new Map();
	const interceptions = /* @__PURE__ */ new Map();
	const boundaries = /* @__PURE__ */ new Map();
	const rootBoundaries = /* @__PURE__ */ new Map();
	const routeIdByPattern = createRouteManifestRouteIdByPattern(routes);
	for (const route of routes) {
		routeEntries.set(route.ids.route, {
			id: route.ids.route,
			pattern: route.pattern,
			patternParts: [...route.patternParts],
			isDynamic: route.isDynamic,
			paramNames: [...route.params],
			rootParamNames: [...route.rootParamNames],
			rootBoundaryId: route.ids.rootBoundary,
			pageId: route.ids.page,
			routeHandlerId: route.ids.routeHandler,
			layoutIds: [...route.ids.layouts],
			templateIds: [...route.ids.templates],
			slotIds: route.parallelSlots.map((slot) => slot.id).sort(compareStableStrings)
		});
		if (route.childrenSlot) {
			const ownerLayoutId = findRouteManifestOwnerLayoutIdByTreePath(route, route.childrenSlot.ownerTreePath);
			routeEntries.get(route.ids.route).slotIds = [...routeEntries.get(route.ids.route).slotIds, route.childrenSlot.id].sort(compareStableStrings);
			slotBindings.set(`${route.ids.route}::${route.childrenSlot.id}`, {
				id: `${route.ids.route}::${route.childrenSlot.id}`,
				routeId: route.ids.route,
				slotId: route.childrenSlot.id,
				ownerLayoutId,
				state: route.childrenSlot.state,
				defaultId: null,
				routeSegments: null
			});
		}
		if (route.ids.page) pages.set(route.ids.page, {
			id: route.ids.page,
			routeId: route.ids.route,
			pattern: route.pattern
		});
		if (route.ids.routeHandler) routeHandlers.set(route.ids.routeHandler, {
			id: route.ids.routeHandler,
			routeId: route.ids.route,
			pattern: route.pattern
		});
		for (const [index, layoutId] of route.ids.layouts.entries()) {
			const treePosition = route.layoutTreePositions[index];
			assertRouteManifestTreePosition("layout", route, layoutId, treePosition);
			const treePath = createAppRouteGraphTreePath(route.routeSegments, treePosition);
			const existingLayout = layouts.get(layoutId);
			if (existingLayout) assertRouteManifestRootBoundary("layout", route, layoutId, existingLayout.rootBoundaryId);
			const layoutRouteParts = convertTreePathToRouteParts(treePath);
			const layout = {
				id: layoutId,
				treePath,
				patternParts: layoutRouteParts.urlSegments,
				paramNames: layoutRouteParts.params,
				rootBoundaryId: route.ids.rootBoundary
			};
			layouts.set(layoutId, layout);
			addRouteManifestBoundaryFacts({
				boundaries,
				route,
				layoutId,
				treePath,
				layoutIndex: index
			});
			if (index === 0 && route.ids.rootBoundary) rootBoundaries.set(route.ids.rootBoundary, {
				id: route.ids.rootBoundary,
				layoutId,
				treePath
			});
		}
		addRouteManifestSegmentErrorBoundaryFacts({
			boundaries,
			route
		});
		for (const [index, templateId] of route.ids.templates.entries()) {
			const treePosition = route.templateTreePositions?.[index];
			assertRouteManifestTreePosition("template", route, templateId, treePosition);
			const treePath = createAppRouteGraphTreePath(route.routeSegments, treePosition);
			const existingTemplate = templates.get(templateId);
			if (existingTemplate) assertRouteManifestRootBoundary("template", route, templateId, existingTemplate.rootBoundaryId);
			templates.set(templateId, {
				id: templateId,
				treePath,
				rootBoundaryId: route.ids.rootBoundary,
				ownerLayoutId: findRouteManifestOwnerLayoutId(route, treePosition),
				reset: {
					kind: "remountSubtree",
					treePath
				}
			});
		}
		for (const slot of route.parallelSlots) {
			const ownerLayoutId = findSlotOwnerLayoutId(route, slot);
			const defaultId = slot.defaultPath ? createAppRouteGraphDefaultId(slot.id) : null;
			if (slot.layoutPath) {
				const slotLayoutTreePath = createSlotLayoutTreePath(slot);
				const slotLayoutId = createAppRouteGraphLayoutId(slotLayoutTreePath);
				const existingLayout = layouts.get(slotLayoutId);
				if (existingLayout) assertRouteManifestRootBoundary("layout", route, slotLayoutId, existingLayout.rootBoundaryId);
				const slotLayoutRouteParts = convertTreePathToRouteParts(slotLayoutTreePath);
				layouts.set(slotLayoutId, {
					id: slotLayoutId,
					treePath: slotLayoutTreePath,
					patternParts: slotLayoutRouteParts.urlSegments,
					paramNames: slotLayoutRouteParts.params,
					rootBoundaryId: route.ids.rootBoundary
				});
			}
			slots.set(slot.id, {
				id: slot.id,
				key: slot.key,
				name: slot.name,
				ownerTreePath: slot.ownerTreePath,
				ownerLayoutId,
				rootBoundaryId: ownerLayoutId ? route.ids.rootBoundary : null,
				defaultId,
				hasDefault: slot.defaultPath !== null,
				hasPage: slot.hasPage
			});
			if (defaultId) defaults.set(defaultId, {
				id: defaultId,
				slotId: slot.id,
				ownerTreePath: slot.ownerTreePath,
				ownerLayoutId,
				rootBoundaryId: ownerLayoutId ? route.ids.rootBoundary : null
			});
			const binding = createRouteManifestSlotBinding(route, slot, ownerLayoutId, defaultId);
			slotBindings.set(binding.id, binding);
			addRouteManifestInterceptionFacts({
				interceptions,
				ownerLayoutId,
				route,
				routeIdByPattern,
				slot
			});
		}
		for (const ir of route.siblingIntercepts) {
			if (!ir.slotId) continue;
			const id = createAppRouteGraphInterceptionId(ir.slotId, ir.sourceMatchPattern, ir.targetPattern);
			interceptions.set(id, {
				id,
				sourcePattern: ir.sourceMatchPattern,
				sourcePatternParts: splitRouteManifestPatternParts(ir.sourceMatchPattern),
				targetPattern: ir.targetPattern,
				targetPatternParts: splitRouteManifestPatternParts(ir.targetPattern),
				slotId: ir.slotId,
				ownerLayoutId: null,
				interceptingRouteId: routeIdByPattern.get(ir.sourceMatchPattern) ?? null,
				targetRouteId: routeIdByPattern.get(ir.targetPattern) ?? null
			});
		}
	}
	return {
		routes: routeEntries,
		pages,
		routeHandlers,
		layouts,
		templates,
		slots,
		defaults,
		slotBindings,
		interceptions,
		interceptionsBySlotId: createRouteManifestInterceptionsBySlotId(interceptions),
		boundaries,
		rootBoundaries
	};
}
function createRouteManifestRouteIdByPattern(routes) {
	return new Map(routes.map((route) => [route.pattern, route.ids.route]));
}
function findRouteManifestOwnerLayoutId(route, treePosition) {
	const layoutIndex = route.layoutTreePositions.indexOf(treePosition);
	return route.ids.layouts[layoutIndex] ?? null;
}
function findRouteManifestOwnerLayoutIdByTreePath(route, treePath) {
	const layoutIndex = route.layoutTreePositions.findIndex((treePosition) => createAppRouteGraphTreePath(route.routeSegments, treePosition) === treePath);
	return route.ids.layouts[layoutIndex] ?? null;
}
function findSlotOwnerLayoutId(route, slot) {
	if (slot.layoutIndex < 0) return null;
	return route.ids.layouts[slot.layoutIndex] ?? null;
}
function createSlotLayoutTreePath(slot) {
	const slotSegment = `@${slot.name}`;
	if (slot.ownerTreePath === "/") return `/${slotSegment}`;
	return `${slot.ownerTreePath}/${slotSegment}`;
}
function createRouteManifestSlotBinding(route, slot, ownerLayoutId, defaultId) {
	const state = getRouteManifestSlotBindingState(slot);
	const binding = {
		id: `${route.ids.route}::${slot.id}`,
		routeId: route.ids.route,
		slotId: slot.id,
		ownerLayoutId,
		state,
		defaultId: state === "default" ? defaultId : null,
		routeSegments: slot.routeSegments ? [...slot.routeSegments] : null
	};
	if (slot.slotPatternParts) binding.slotPatternParts = [...slot.slotPatternParts];
	if (slot.slotParamNames) binding.slotParamNames = [...slot.slotParamNames];
	return binding;
}
function addRouteManifestInterceptionFacts(input) {
	for (const interception of input.slot.interceptingRoutes) {
		const id = createAppRouteGraphInterceptionId(input.slot.id, interception.sourceMatchPattern, interception.targetPattern);
		input.interceptions.set(id, {
			id,
			sourcePattern: interception.sourceMatchPattern,
			sourcePatternParts: splitRouteManifestPatternParts(interception.sourceMatchPattern),
			targetPattern: interception.targetPattern,
			targetPatternParts: splitRouteManifestPatternParts(interception.targetPattern),
			slotId: input.slot.id,
			ownerLayoutId: input.ownerLayoutId,
			interceptingRouteId: input.routeIdByPattern.get(interception.sourceMatchPattern) ?? null,
			targetRouteId: input.routeIdByPattern.get(interception.targetPattern) ?? null
		});
	}
}
function createRouteManifestInterceptionsBySlotId(interceptions) {
	const interceptionsBySlotId = /* @__PURE__ */ new Map();
	for (const interception of interceptions.values()) {
		const existing = interceptionsBySlotId.get(interception.slotId);
		if (existing) existing.push(interception);
		else interceptionsBySlotId.set(interception.slotId, [interception]);
	}
	for (const slotInterceptions of interceptionsBySlotId.values()) slotInterceptions.sort((left, right) => compareStableStrings(left.id, right.id));
	return new Map(Array.from(interceptionsBySlotId.entries()).sort(([left], [right]) => compareStableStrings(left, right)));
}
function splitRouteManifestPatternParts(pattern) {
	return pattern.split("/").filter((part) => part.length > 0);
}
function getRouteManifestSlotBindingState(slot) {
	if (slot.pagePath) return "active";
	if (slot.defaultPath) return "default";
	return "unmatched";
}
function addRouteManifestBoundaryFacts(input) {
	addRouteManifestBoundaryFact(input, "error", input.route.layoutErrorPaths[input.layoutIndex]);
	addRouteManifestBoundaryFact(input, "notFound", input.route.notFoundPaths[input.layoutIndex]);
	addRouteManifestBoundaryFact(input, "forbidden", input.route.forbiddenPaths[input.layoutIndex]);
	addRouteManifestBoundaryFact(input, "unauthorized", input.route.unauthorizedPaths[input.layoutIndex]);
}
function addRouteManifestSegmentErrorBoundaryFacts(input) {
	for (const [index, boundaryPath] of (input.route.errorPaths ?? []).entries()) {
		const treePosition = input.route.errorTreePositions?.[index];
		assertRouteManifestBoundaryTreePosition(input.route, boundaryPath, treePosition);
		const ownerLayoutId = findRouteManifestOwnerLayoutId(input.route, treePosition);
		if (ownerLayoutId !== null) continue;
		const treePath = createAppRouteGraphTreePath(input.route.routeSegments, treePosition);
		addRouteManifestBoundaryFact({
			boundaries: input.boundaries,
			route: input.route,
			layoutId: ownerLayoutId,
			treePath
		}, "error", boundaryPath);
	}
}
function addRouteManifestBoundaryFact(input, outcome, boundaryPath) {
	if (!boundaryPath) return;
	const id = `boundary:${outcome}:${input.treePath}`;
	input.boundaries.set(id, {
		id,
		outcome,
		treePath: input.treePath,
		ownerLayoutId: input.layoutId,
		rootBoundaryId: input.route.ids.rootBoundary
	});
}
function assertRouteManifestTreePosition(kind, route, id, treePosition) {
	if (treePosition !== void 0) return;
	throw new Error(`[vinext] App route graph invariant violated: missing ${kind} tree position for ${id} on ${route.pattern}`);
}
function assertRouteManifestBoundaryTreePosition(route, boundaryPath, treePosition) {
	if (treePosition !== void 0) return;
	throw new Error(`[vinext] App route graph invariant violated: missing boundary tree position for ${boundaryPath} on ${route.pattern}`);
}
function assertRouteManifestRootBoundary(kind, route, id, existingRootBoundaryId) {
	if (existingRootBoundaryId === route.ids.rootBoundary) return;
	throw new Error(`[vinext] App route graph invariant violated: ${kind} ${id} is shared across root boundaries (${existingRootBoundaryId ?? "none"} and ${route.ids.rootBoundary ?? "none"}) on ${route.pattern}`);
}
function createRouteManifestGraphVersion(segmentGraph) {
	const stableShape = {
		routes: sortedMapValues(segmentGraph.routes),
		pages: sortedMapValues(segmentGraph.pages),
		routeHandlers: sortedMapValues(segmentGraph.routeHandlers),
		layouts: sortedMapValues(segmentGraph.layouts),
		templates: sortedMapValues(segmentGraph.templates),
		slots: sortedMapValues(segmentGraph.slots),
		defaults: sortedMapValues(segmentGraph.defaults),
		slotBindings: sortedMapValues(segmentGraph.slotBindings),
		interceptions: sortedMapValues(segmentGraph.interceptions),
		interceptionsBySlotId: sortedMapValues(segmentGraph.interceptionsBySlotId),
		boundaries: sortedMapValues(segmentGraph.boundaries),
		rootBoundaries: sortedMapValues(segmentGraph.rootBoundaries)
	};
	return `graph:${createHash("sha256").update(JSON.stringify(stableShape)).digest("hex")}`;
}
/**
* Build the App Router route graph by scanning `appDir`.
*/
async function buildAppRouteGraph(appDir, matcher) {
	const routes = [];
	const scanMatcher = { ...matcher };
	findFileProbeCache.set(scanMatcher, /* @__PURE__ */ new Map());
	const excludeDir = (name) => name.startsWith("@") && name !== "@children" || name.startsWith("_") || isInterceptionMarkerDir(name);
	for await (const file of scanWithExtensions("**/page", appDir, scanMatcher.extensions, excludeDir)) {
		const route = fileToAppRoute(file, appDir, "page", scanMatcher);
		if (route) routes.push(route);
	}
	for await (const file of scanWithExtensions("**/route", appDir, scanMatcher.extensions, excludeDir)) {
		const route = fileToAppRoute(file, appDir, "route", scanMatcher);
		if (route) routes.push(route);
	}
	const routePatterns = new Set(routes.map((route) => route.pattern));
	const ghostParentRoutes = [];
	for await (const file of scanWithExtensions("**/layout", appDir, scanMatcher.extensions, excludeDir)) {
		const dir = path.dirname(file);
		const routeDir = dir === "." ? appDir : path.join(appDir, dir);
		if (!hasParallelSlotDirectory(routeDir)) continue;
		if (discoverParallelSlots(routeDir, appDir, scanMatcher, true).length === 0) continue;
		const route = directoryToAppRoute(dir, appDir, scanMatcher, null, null, true);
		if (!route) continue;
		if (routes.some((candidate) => candidate.patternParts.length === route.patternParts.length + 1 && candidate.patternParts.at(-1)?.endsWith("*") && patternsStructurallyEquivalent(candidate.patternParts.slice(0, -1), route.patternParts))) {
			ghostParentRoutes.push(route);
			continue;
		}
		if (routePatterns.has(route.pattern)) {
			ghostParentRoutes.push(route);
			continue;
		}
		routes.push(route);
		routePatterns.add(route.pattern);
	}
	const slotSubRoutes = discoverSlotSubRoutes(routes, scanMatcher, ghostParentRoutes);
	routes.push(...slotSubRoutes);
	discoverSiblingInterceptingRoutes(routes, appDir, scanMatcher);
	validatePageRouteConflicts(routes, appDir);
	validateRoutePatterns(routes.map((route) => route.pattern));
	validateRoutePatterns([...new Set(routes.flatMap((route) => [...route.parallelSlots.flatMap((slot) => slot.interceptingRoutes.map((intercept) => intercept.targetPattern)), ...route.siblingIntercepts.map((intercept) => intercept.targetPattern)]))]);
	sortRoutes(routes);
	return {
		routes,
		routeManifest: createRouteManifest(routes)
	};
}
function hasParallelSlotDirectory(dir) {
	try {
		return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => entry.isDirectory() && entry.name.startsWith("@") && entry.name !== "@children");
	} catch {
		return false;
	}
}
function validatePageRouteConflicts(routes, appDir) {
	const byPattern = /* @__PURE__ */ new Map();
	for (const route of routes) {
		const entry = byPattern.get(route.pattern);
		if (!entry) {
			byPattern.set(route.pattern, {
				pagePath: route.pagePath,
				routePath: route.routePath
			});
			continue;
		}
		if (!entry.pagePath && route.pagePath) entry.pagePath = route.pagePath;
		if (!entry.routePath && route.routePath) entry.routePath = route.routePath;
	}
	for (const [pattern, entry] of byPattern) {
		if (!entry.pagePath || !entry.routePath) continue;
		throw new Error(`Conflicting route and page at ${pattern}: route at ${formatAppFilePath(entry.routePath, appDir)} and page at ${formatAppFilePath(entry.pagePath, appDir)}`);
	}
}
function formatAppFilePath(filePath, appDir) {
	const relativePath = path.relative(appDir, filePath);
	const parsedPath = path.parse(relativePath);
	const withoutExtension = path.join(parsedPath.dir, parsedPath.name);
	return withoutExtension.startsWith("/") ? withoutExtension : `/${withoutExtension}`;
}
/**
* Discover sub-routes created by nested pages within parallel slots.
*
* In Next.js, pages nested inside @slot directories create additional URL routes.
* For example, given:
*   app/parallel-routes/@audience/demographics/page.tsx
* This creates a route at /parallel-routes/demographics where:
* - children slot → parent's default.tsx
* - @audience slot → @audience/demographics/page.tsx (matched)
* - other slots → their default.tsx (fallback)
*/
function discoverSlotSubRoutes(routes, matcher, ghostParents = []) {
	const syntheticRoutes = [];
	const routesByPattern = new Map(routes.map((r) => [r.pattern, r]));
	const applySlotSubPages = (route, slotPages, rawSegments) => {
		route.parallelSlots = route.parallelSlots.map((slot) => {
			const subPage = slotPages.get(slot.key);
			if (subPage !== void 0) {
				const configLayoutPaths = findSlotConfigLayoutPaths(slot.ownerDir, subPage, matcher);
				const notFoundBoundary = findSlotNotFoundBoundary(slot.ownerDir, subPage, matcher);
				return {
					...slot,
					pagePath: subPage,
					configLayoutPaths,
					configLayoutTreePositions: findSlotConfigLayoutTreePositions(slot.ownerDir, configLayoutPaths),
					notFoundPath: notFoundBoundary.path,
					notFoundTreePosition: notFoundBoundary.treePosition,
					routeSegments: rawSegments
				};
			}
			return slot;
		});
	};
	const allParents = [...routes, ...ghostParents];
	for (const parentRoute of allParents) {
		if (parentRoute.parallelSlots.length === 0) continue;
		const isLayoutOnlyUiRoute = !parentRoute.pagePath && !parentRoute.routePath && parentRoute.layouts.length > 0;
		if (!parentRoute.pagePath && !isLayoutOnlyUiRoute) continue;
		const parentPageDir = parentRoute.pagePath ? path.dirname(parentRoute.pagePath) : path.dirname(parentRoute.layouts[parentRoute.layouts.length - 1]);
		const subPathMap = /* @__PURE__ */ new Map();
		for (const slot of parentRoute.parallelSlots) {
			if (path.dirname(slot.ownerDir) !== parentPageDir) continue;
			const slotDir = slot.ownerDir;
			if (!fs.existsSync(slotDir)) continue;
			const subPages = findSlotSubPages(slotDir, matcher);
			for (const { relativePath, pagePath } of subPages) {
				const subSegments = relativePath.split(path.sep);
				const convertedSubRoute = convertSegmentsToRouteParts(subSegments);
				if (!convertedSubRoute) continue;
				const { urlSegments } = convertedSubRoute;
				const normalizedSubPath = urlSegments.join("/");
				let subPathEntry = subPathMap.get(normalizedSubPath);
				if (!subPathEntry) {
					subPathEntry = {
						rawSegments: subSegments,
						converted: convertedSubRoute,
						slotPages: /* @__PURE__ */ new Map()
					};
					subPathMap.set(normalizedSubPath, subPathEntry);
				}
				if (subPathEntry.slotPages.get(slot.key)) {
					const pattern = joinRoutePattern(parentRoute.pattern, normalizedSubPath);
					throw new Error(`You cannot have two routes that resolve to the same path ("${pattern}").`);
				}
				subPathEntry.slotPages.set(slot.key, pagePath);
			}
		}
		if (subPathMap.size === 0) continue;
		const childrenOwnerTreePath = parentRoute.parallelSlots.find((slot) => path.dirname(slot.ownerDir) === parentPageDir)?.ownerTreePath;
		if (!childrenOwnerTreePath) throw new Error(`[vinext] App route graph invariant violated: missing children slot owner for ${parentRoute.pattern}`);
		const childrenDefault = findFile(parentPageDir, "default", matcher);
		if (parentRoute.pagePath && !childrenDefault) continue;
		const childrenSlotId = createAppRouteGraphSlotId("children", childrenOwnerTreePath);
		if (parentRoute.pagePath) parentRoute.childrenSlot = {
			id: childrenSlotId,
			ownerTreePath: childrenOwnerTreePath,
			state: "active"
		};
		for (const route of routes) {
			if (!route.pagePath || route === parentRoute) continue;
			const relativePageDir = path.relative(parentPageDir, path.dirname(route.pagePath));
			if (relativePageDir === "" || relativePageDir === ".." || relativePageDir.startsWith(`..${path.sep}`) || path.isAbsolute(relativePageDir)) continue;
			const existingOwnerDepth = route.childrenSlot?.ownerTreePath.split("/").filter(Boolean).length;
			const candidateOwnerDepth = childrenOwnerTreePath.split("/").filter(Boolean).length;
			if (existingOwnerDepth !== void 0 && existingOwnerDepth >= candidateOwnerDepth) continue;
			route.childrenSlot = {
				id: childrenSlotId,
				ownerTreePath: childrenOwnerTreePath,
				state: "active"
			};
		}
		const childrenCatchAll = childrenDefault ? null : findCatchAllPage(parentPageDir, matcher);
		const childrenFallback = childrenDefault ?? childrenCatchAll;
		for (const { rawSegments, converted: convertedSubRoute, slotPages } of subPathMap.values()) {
			const { urlSegments: urlParts, params: subParams, isDynamic: subIsDynamic } = convertedSubRoute;
			const subUrlPath = urlParts.join("/");
			const pattern = joinRoutePattern(parentRoute.pattern, subUrlPath);
			const existingRoute = routesByPattern.get(pattern);
			if (existingRoute) {
				if (existingRoute.routePath && !existingRoute.pagePath) throw new Error(`You cannot have two routes that resolve to the same path ("${pattern}").`);
				if (urlParts.length > 0) applySlotSubPages(existingRoute, slotPages, rawSegments);
				continue;
			}
			const syntheticParts = [...parentRoute.patternParts, ...urlParts];
			if (Array.from(routesByPattern.values()).some((r) => patternsStructurallyEquivalent(r.patternParts, syntheticParts))) continue;
			const subSlots = parentRoute.parallelSlots.map((slot) => {
				const subPage = slotPages.get(slot.key);
				const configLayoutPaths = findSlotConfigLayoutPaths(slot.ownerDir, subPage ?? null, matcher);
				const notFoundBoundary = findSlotNotFoundBoundary(slot.ownerDir, subPage ?? null, matcher);
				return {
					...slot,
					pagePath: subPage || null,
					configLayoutPaths,
					configLayoutTreePositions: findSlotConfigLayoutTreePositions(slot.ownerDir, configLayoutPaths),
					notFoundPath: notFoundBoundary.path,
					notFoundTreePosition: notFoundBoundary.treePosition,
					routeSegments: subPage ? rawSegments : null
				};
			});
			const newRoute = {
				ids: createAppRouteSemanticIds({
					pattern,
					pagePath: childrenFallback,
					routePath: null,
					routeSegments: [...parentRoute.routeSegments, ...rawSegments],
					layoutTreePositions: parentRoute.layoutTreePositions,
					templateTreePositions: parentRoute.templateTreePositions,
					slots: subSlots
				}),
				pattern,
				pagePath: childrenFallback,
				routePath: null,
				layouts: parentRoute.layouts,
				templates: parentRoute.templates,
				parallelSlots: subSlots,
				childrenSlot: {
					id: childrenSlotId,
					ownerTreePath: childrenOwnerTreePath,
					state: childrenDefault ? "default" : childrenCatchAll ? "active" : "unmatched"
				},
				loadingPath: parentRoute.loadingPath,
				errorPath: parentRoute.errorPath,
				layoutErrorPaths: parentRoute.layoutErrorPaths,
				notFoundPath: parentRoute.notFoundPath,
				notFoundTreePosition: parentRoute.notFoundTreePosition,
				notFoundPaths: parentRoute.notFoundPaths,
				forbiddenPaths: parentRoute.forbiddenPaths,
				forbiddenPath: parentRoute.forbiddenPath,
				forbiddenTreePosition: parentRoute.forbiddenTreePosition,
				unauthorizedPath: parentRoute.unauthorizedPath,
				unauthorizedTreePosition: parentRoute.unauthorizedTreePosition,
				unauthorizedPaths: parentRoute.unauthorizedPaths,
				routeSegments: [...parentRoute.routeSegments, ...rawSegments],
				childrenRouteSegments: childrenDefault ? parentRoute.routeSegments : void 0,
				templateTreePositions: parentRoute.templateTreePositions,
				layoutTreePositions: parentRoute.layoutTreePositions,
				isDynamic: parentRoute.isDynamic || subIsDynamic,
				params: [...parentRoute.params, ...subParams],
				rootParamNames: parentRoute.rootParamNames,
				patternParts: [...parentRoute.patternParts, ...urlParts],
				siblingIntercepts: []
			};
			syntheticRoutes.push(newRoute);
			routesByPattern.set(pattern, newRoute);
		}
	}
	return syntheticRoutes;
}
const dirEntriesCache = /* @__PURE__ */ new WeakMap();
function readDirEntriesCached(dir, matcher) {
	let perMatcher = dirEntriesCache.get(matcher);
	if (!perMatcher) {
		perMatcher = /* @__PURE__ */ new Map();
		dirEntriesCache.set(matcher, perMatcher);
	}
	let entries = perMatcher.get(dir);
	if (entries === void 0) {
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch (error) {
			const code = error.code;
			if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
			entries = [];
		}
		perMatcher.set(dir, entries);
	}
	return entries;
}
const findSlotSubPagesCache = /* @__PURE__ */ new WeakMap();
function findSlotSubPages(slotDir, matcher) {
	let perMatcher = findSlotSubPagesCache.get(matcher);
	if (!perMatcher) {
		perMatcher = /* @__PURE__ */ new Map();
		findSlotSubPagesCache.set(matcher, perMatcher);
	}
	const cached = perMatcher.get(slotDir);
	if (cached) return cached;
	const results = [];
	function scan(dir) {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (matchInterceptConvention(entry.name)) continue;
			if (entry.name.startsWith("_")) continue;
			const subDir = path.join(dir, entry.name);
			const page = findFile(subDir, "page", matcher);
			if (page) {
				const relativePath = path.relative(slotDir, subDir);
				results.push({
					relativePath,
					pagePath: page
				});
			}
			scan(subDir);
		}
	}
	scan(slotDir);
	perMatcher.set(slotDir, results);
	return results;
}
function findSlotConfigLayoutPaths(slotDir, pagePath, matcher) {
	if (!pagePath) return [];
	const layouts = [];
	let dir = path.dirname(pagePath);
	while (dir !== slotDir && dir.startsWith(`${slotDir}${path.sep}`)) {
		const layoutPath = findFile(dir, "layout", matcher);
		if (layoutPath) layouts.unshift(layoutPath);
		dir = path.dirname(dir);
	}
	return layouts;
}
function findSlotConfigLayoutTreePositions(slotDir, layoutPaths) {
	return layoutPaths.map((layoutPath) => {
		const relativeDir = path.relative(slotDir, path.dirname(layoutPath));
		return relativeDir ? relativeDir.split(path.sep).filter(Boolean).length : 0;
	});
}
function findSlotNotFoundBoundary(slotDir, pagePath, matcher) {
	let dir = pagePath ? path.dirname(pagePath) : slotDir;
	while (dir === slotDir || dir.startsWith(`${slotDir}${path.sep}`)) {
		const boundaryPath = findFile(dir, "not-found", matcher);
		if (boundaryPath) {
			const relativeDir = path.relative(slotDir, dir);
			return {
				path: boundaryPath,
				treePosition: relativeDir ? relativeDir.split(path.sep).filter(Boolean).length : 0
			};
		}
		if (dir === slotDir) break;
		dir = path.dirname(dir);
	}
	return {
		path: null,
		treePosition: null
	};
}
/**
* Find a sibling catch-all page directly under `dir`, i.e. a `[...slug]` or
* `[[...slug]]` directory that contains a `page` file. Returns the absolute
* page path, or null when no catch-all sibling exists.
*
* Used as the children fallback for slot-only sub-routes (an explicit `@slot`
* sub-page with no corresponding children page or `default.tsx`): Next.js
* serves the children prop from the nearest catch-all, so `/baz` renders
* `[...catchAll]/page.tsx` for children while `@slot/baz/page.tsx` fills the
* slot. Optional catch-alls (`[[...slug]]`) qualify because they also match a
* single extra segment.
*/
function findCatchAllPage(dir, matcher) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return null;
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const name = entry.name;
		if (!(name.startsWith("[...") && name.endsWith("]") || name.startsWith("[[...") && name.endsWith("]]"))) continue;
		const page = findFile(path.join(dir, name), "page", matcher);
		if (page) return page;
	}
	return null;
}
/**
* Convert a file path relative to app/ into an AppRoute.
*/
function fileToAppRoute(file, appDir, type, matcher) {
	let dir = path.dirname(file);
	if (type === "page" && dir !== "." && path.basename(dir) === "@children") {
		const parent = path.dirname(dir);
		dir = parent === "" || parent === "." ? "." : parent;
	}
	return directoryToAppRoute(dir, appDir, matcher, type === "page" ? path.join(appDir, file) : null, type === "route" ? path.join(appDir, file) : null);
}
function directoryToAppRoute(dir, appDir, matcher, pagePath, routePath, includeNestedOnlySlots = false) {
	const segments = dir === "." ? [] : dir.split("/");
	const params = [];
	let isDynamic = false;
	const convertedRoute = convertSegmentsToRouteParts(segments);
	if (!convertedRoute) return null;
	const { urlSegments, params: routeParams, isDynamic: routeIsDynamic } = convertedRoute;
	params.push(...routeParams);
	isDynamic = routeIsDynamic;
	const pattern = "/" + urlSegments.join("/");
	const layouts = discoverLayouts(segments, appDir, matcher);
	const templates = discoverTemplates(segments, appDir, matcher);
	const templateTreePositions = computeLayoutTreePositions(appDir, templates);
	const layoutTreePositions = computeLayoutTreePositions(appDir, layouts);
	const layoutErrorPaths = discoverLayoutAlignedErrors(segments, appDir, matcher);
	const errorEntries = discoverSegmentErrors(segments, appDir, matcher);
	const errorPaths = errorEntries.map((entry) => entry.path);
	const errorTreePositions = errorEntries.map((entry) => entry.treePosition);
	const routeDir = dir === "." ? appDir : path.join(appDir, dir);
	const effectivePagePath = pagePath ?? (routePath ? null : findFile(routeDir, "default", matcher));
	const loadingPath = findFile(routeDir, "loading", matcher);
	const errorPath = findFile(routeDir, "error", matcher);
	const notFoundEntry = discoverBoundaryFileEntry(segments, appDir, "not-found", matcher);
	const notFoundPath = notFoundEntry?.path ?? null;
	const forbiddenEntry = discoverBoundaryFileEntry(segments, appDir, "forbidden", matcher);
	const forbiddenPath = forbiddenEntry?.path ?? null;
	const unauthorizedEntry = discoverBoundaryFileEntry(segments, appDir, "unauthorized", matcher);
	const unauthorizedPath = unauthorizedEntry?.path ?? null;
	const notFoundPaths = discoverBoundaryFilePerLayout(layouts, "not-found", matcher);
	const forbiddenPaths = discoverBoundaryFilePerLayout(layouts, "forbidden", matcher);
	const unauthorizedPaths = discoverBoundaryFilePerLayout(layouts, "unauthorized", matcher);
	const parallelSlots = discoverInheritedParallelSlots(segments, appDir, routeDir, matcher, includeNestedOnlySlots);
	return {
		ids: createAppRouteSemanticIds({
			pattern: pattern === "/" ? "/" : pattern,
			pagePath: effectivePagePath,
			routePath,
			routeSegments: segments,
			layoutTreePositions,
			templateTreePositions,
			slots: parallelSlots
		}),
		pattern: pattern === "/" ? "/" : pattern,
		pagePath: effectivePagePath,
		routePath,
		layouts,
		templates,
		parallelSlots,
		loadingPath,
		errorPath,
		layoutErrorPaths,
		errorPaths,
		errorTreePositions,
		notFoundPath,
		notFoundTreePosition: notFoundEntry?.treePosition ?? null,
		notFoundPaths,
		forbiddenPaths,
		forbiddenPath,
		forbiddenTreePosition: forbiddenEntry?.treePosition ?? null,
		unauthorizedPath,
		unauthorizedTreePosition: unauthorizedEntry?.treePosition ?? null,
		unauthorizedPaths,
		routeSegments: segments,
		templateTreePositions,
		layoutTreePositions,
		isDynamic,
		params,
		rootParamNames: computeRootParamNames(segments, layoutTreePositions),
		patternParts: urlSegments,
		siblingIntercepts: []
	};
}
function dynamicParamNameFromSegment(segment) {
	if (segment.startsWith("[[...") && segment.endsWith("]]")) return segment.slice(5, -2);
	if (segment.startsWith("[...") && segment.endsWith("]")) return segment.slice(4, -1);
	if (segment.startsWith("[") && segment.endsWith("]")) return segment.slice(1, -1);
	return null;
}
function computeRootParamNames(routeSegments, layoutTreePositions) {
	const rootLayoutPosition = layoutTreePositions[0];
	if (rootLayoutPosition == null || rootLayoutPosition <= 0) return [];
	const names = [];
	for (const segment of routeSegments.slice(0, rootLayoutPosition)) {
		const name = dynamicParamNameFromSegment(segment);
		if (name && !names.includes(name)) names.push(name);
	}
	return names;
}
function resolveRootBoundaryId(routeSegments, layoutTreePositions) {
	const rootLayoutPosition = layoutTreePositions[0];
	if (rootLayoutPosition === void 0) return null;
	return createAppRouteGraphRootBoundaryId(createAppRouteGraphTreePath(routeSegments, rootLayoutPosition));
}
function createAppRouteSemanticIds(input) {
	const slots = {};
	for (const slot of input.slots) slots[slot.key] = slot.id;
	return {
		route: createAppRouteGraphRouteId(input.pattern),
		page: input.pagePath ? createAppRouteGraphPageId(input.pattern) : null,
		routeHandler: input.routePath ? createAppRouteGraphRouteHandlerId(input.pattern) : null,
		rootBoundary: resolveRootBoundaryId(input.routeSegments, input.layoutTreePositions),
		layouts: input.layoutTreePositions.map((treePosition) => createAppRouteGraphLayoutId(createAppRouteGraphTreePath(input.routeSegments, treePosition))),
		templates: (input.templateTreePositions ?? []).map((treePosition) => createAppRouteGraphTemplateId(createAppRouteGraphTreePath(input.routeSegments, treePosition))),
		slots
	};
}
function createAppRouteGraphTreePath(routeSegments, treePosition) {
	const treePathSegments = routeSegments.slice(0, treePosition);
	if (treePathSegments.length === 0) return "/";
	return `/${treePathSegments.join("/")}`;
}
function convertTreePathToRouteParts(treePath) {
	if (treePath === "/") return {
		urlSegments: [],
		params: []
	};
	const routeParts = convertSegmentsToRouteParts(treePath.split("/").filter(Boolean));
	if (!routeParts) throw new Error(`Invalid App Router layout tree path "${treePath}".`);
	return {
		urlSegments: routeParts.urlSegments,
		params: routeParts.params
	};
}
/**
* Compute the tree position (directory depth from app root) for each layout.
* Root layout = 0, a layout at app/blog/ = 1, app/blog/(group)/ = 2.
* Counts ALL directory levels including route groups and parallel slots.
*/
function computeLayoutTreePositions(appDir, layouts) {
	return layouts.map((layoutPath) => {
		const layoutDir = path.dirname(layoutPath);
		const relative = path.relative(appDir, layoutDir);
		if (relative === "") return 0;
		return relative.split(path.sep).length;
	});
}
/**
* Discover all layout files from root to the given directory.
* Each level of the directory tree may have a layout.tsx.
*/
function discoverLayouts(segments, appDir, matcher) {
	const layouts = [];
	const rootLayout = findFile(appDir, "layout", matcher);
	if (rootLayout) layouts.push(rootLayout);
	let currentDir = appDir;
	for (const segment of segments) {
		currentDir = path.join(currentDir, segment);
		const layout = findFile(currentDir, "layout", matcher);
		if (layout) layouts.push(layout);
	}
	return layouts;
}
/**
* Discover all template files from root to the given directory.
* Each level of the directory tree may have a template.tsx.
* Templates are like layouts but re-mount on navigation.
*/
function discoverTemplates(segments, appDir, matcher) {
	const templates = [];
	const rootTemplate = findFile(appDir, "template", matcher);
	if (rootTemplate) templates.push(rootTemplate);
	let currentDir = appDir;
	for (const segment of segments) {
		currentDir = path.join(currentDir, segment);
		const template = findFile(currentDir, "template", matcher);
		if (template) templates.push(template);
	}
	return templates;
}
/**
* Discover error.tsx files by segment tree position.
*
* Next.js stores conventions on every loader-tree segment; a route-group
* directory with error.tsx but no sibling layout.tsx must still wrap its
* descendants. Keeping positions explicit avoids conflating segment boundaries
* with layout component ownership.
*/
function discoverSegmentErrors(segments, appDir, matcher) {
	const errors = [];
	const rootError = findFile(appDir, "error", matcher);
	if (rootError) errors.push({
		path: rootError,
		treePosition: 0
	});
	let currentDir = appDir;
	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index];
		currentDir = path.join(currentDir, segment);
		const error = findFile(currentDir, "error", matcher);
		if (error) errors.push({
			path: error,
			treePosition: index + 1
		});
	}
	return errors;
}
/**
* Discover error.tsx files aligned with the layouts array.
*
* Route manifests still model layout-owned boundary facts by layout index.
* Keep this layout-aligned compatibility shape separate from segment-owned
* error boundaries so route-group errors without layouts do not get attributed
* to unrelated layouts.
*/
function discoverLayoutAlignedErrors(segments, appDir, matcher) {
	const errors = [];
	if (findFile(appDir, "layout", matcher)) errors.push(findFile(appDir, "error", matcher));
	let currentDir = appDir;
	for (const segment of segments) {
		currentDir = path.join(currentDir, segment);
		if (findFile(currentDir, "layout", matcher)) errors.push(findFile(currentDir, "error", matcher));
	}
	return errors;
}
/**
* Discover the nearest boundary file (not-found, forbidden, unauthorized)
* by walking from the route's directory up to the app root.
* Returns the first (closest) file found, or null.
*/
function discoverBoundaryFileEntry(segments, appDir, fileName, matcher) {
	const dirs = [];
	let dir = appDir;
	dirs.push(dir);
	for (const segment of segments) {
		dir = path.join(dir, segment);
		dirs.push(dir);
	}
	for (let i = dirs.length - 1; i >= 0; i--) {
		const f = findFile(dirs[i], fileName, matcher);
		if (f) return {
			path: f,
			treePosition: i
		};
	}
	return null;
}
/**
* Discover boundary files (not-found, forbidden, unauthorized) at each layout directory.
* Returns an array aligned with the layouts array, where each entry is the boundary
* file at that layout's directory, or null if none exists there.
*
* This is used for per-layout error boundaries. In Next.js, each layout level
* has its own boundary that wraps the layout's children. When notFound() is thrown
* from a layout, it propagates up to the parent layout's boundary.
*/
function discoverBoundaryFilePerLayout(layouts, fileName, matcher) {
	return layouts.map((layoutPath) => {
		return findFile(path.dirname(layoutPath), fileName, matcher);
	});
}
/**
* Discover parallel slots inherited from ancestor directories.
*
* In Next.js, parallel slots belong to the layout that defines them. When a
* child route is rendered, its parent layout's slots must still be present.
* If the child doesn't have matching content in a slot, the slot's default.tsx
* is rendered instead.
*
* Walk from appDir through each segment to the route's directory. At each level
* that has @slot dirs, collect them. Slots at the route's own directory level
* use page.tsx; slots at ancestor levels use default.tsx only.
*/
function discoverInheritedParallelSlots(segments, appDir, routeDir, matcher, includeNestedOnlySlots = false) {
	const slotMap = /* @__PURE__ */ new Map();
	let currentDir = appDir;
	const dirsToCheck = [];
	let layoutIdx = findFile(appDir, "layout", matcher) ? 0 : -1;
	dirsToCheck.push({
		dir: appDir,
		layoutIdx,
		segmentIndex: 0
	});
	for (let i = 0; i < segments.length; i++) {
		currentDir = path.join(currentDir, segments[i]);
		if (findFile(currentDir, "layout", matcher)) layoutIdx++;
		dirsToCheck.push({
			dir: currentDir,
			layoutIdx,
			segmentIndex: i + 1
		});
	}
	const routeHasLayout = layoutIdx >= 0;
	for (const { dir, layoutIdx: lvlLayoutIdx, segmentIndex } of dirsToCheck) {
		if (lvlLayoutIdx < 0 && routeHasLayout) continue;
		const slotLayoutIdx = Math.max(lvlLayoutIdx, 0);
		const segmentsBelow = segments.slice(segmentIndex);
		const isActiveUrlLevel = dir === routeDir || segmentsBelow.every(isInvisibleSegment);
		const slotsAtLevel = discoverParallelSlots(dir, appDir, matcher, includeNestedOnlySlots && isActiveUrlLevel);
		for (const slot of slotsAtLevel) if (isActiveUrlLevel) {
			slot.layoutIndex = slotLayoutIdx;
			slotMap.set(slot.key, slot);
		} else {
			const mirror = findMirroredSlotPage(slot.ownerDir, segmentsBelow, matcher);
			let slotPatternParts;
			let slotParamNames;
			if (mirror) {
				const ownerUrl = convertSegmentsToRouteParts([...segments.slice(0, segmentIndex)]);
				slotPatternParts = [...ownerUrl?.urlSegments ?? [], ...mirror.slotUrlSegments];
				slotParamNames = [...ownerUrl?.params ?? [], ...mirror.slotParamNames];
			}
			const configLayoutPaths = findSlotConfigLayoutPaths(slot.ownerDir, mirror?.pagePath ?? null, matcher);
			const inheritedSlot = {
				...slot,
				pagePath: mirror?.pagePath ?? null,
				configLayoutPaths,
				configLayoutTreePositions: findSlotConfigLayoutTreePositions(slot.ownerDir, configLayoutPaths),
				layoutIndex: slotLayoutIdx,
				routeSegments: mirror?.segments ?? null,
				slotPatternParts,
				slotParamNames
			};
			slotMap.set(slot.key, inheritedSlot);
		}
	}
	return Array.from(slotMap.values());
}
/**
* Look for a page file inside a parallel slot directory that mirrors the
* route's path below the slot's owner. The match falls through two tiers:
*   1. Literal filesystem path — fast path when route and slot share shape.
*   2. Scored pattern compatibility — enumerate sub-pages, accept those
*      whose URL pattern can match the route's URL space (slot dynamic
*      markers may have different names than the route's, and slot
*      catch-alls may subsume the route), and pick the most-specific via
*      `scoreSlotPattern`. Exact URL-parts equality (e.g. through route
*      groups appearing on only one side, like `(marketing)/about` ↔
*      `@breadcrumbs/about`) naturally wins because all literal segments
*      score highest.
*
* Returns the slot sub-page's absolute path, its raw filesystem segments
* (for `routeSegments`), and its URL parts / param names (for
* `slotPatternParts` / `slotParamNames`). Returns null when no mirror matches.
*/
function findMirroredSlotPage(slotDir, segmentsBelow, matcher) {
	if (segmentsBelow.length === 0) return null;
	const routeUrl = convertSegmentsToRouteParts([...segmentsBelow]);
	const literalPage = findFile(path.join(slotDir, ...segmentsBelow), "page", matcher);
	if (literalPage) return {
		pagePath: literalPage,
		segments: [...segmentsBelow],
		slotUrlSegments: routeUrl?.urlSegments ?? [],
		slotParamNames: routeUrl?.params ?? []
	};
	if (!routeUrl || routeUrl.urlSegments.length === 0) return null;
	let best = null;
	for (const { relativePath, pagePath } of findSlotSubPages(slotDir, matcher)) {
		const slotSegments = relativePath.split(path.sep);
		const slotUrl = convertSegmentsToRouteParts(slotSegments);
		if (!slotUrl) continue;
		if (!patternsCompatible(slotUrl.urlSegments, routeUrl.urlSegments)) continue;
		const score = scoreSlotPattern(slotUrl.urlSegments);
		if (!best || score > best.score) best = {
			pagePath,
			segments: slotSegments,
			slotUrlSegments: slotUrl.urlSegments,
			slotParamNames: slotUrl.params,
			score
		};
	}
	return best;
}
/**
* Whether a slot pattern can match the same URL space as the route's URL
* parts (where the route's parts are themselves a pattern, since a route
* file like `[id]/page.tsx` produces `:id`).
*
* - `:name+` (catch-all) consumes one-or-more remaining segments.
* - `:name*` (optional catch-all) consumes zero-or-more.
* - `:name` (single dynamic) consumes exactly one segment, matching any
*   route segment (literal or dynamic).
* - Literal slot segments must equal the route's segment exactly; a literal
*   slot segment paired with a dynamic route segment is rejected because we
*   can't know statically whether the runtime value will equal the literal.
*   This also means a literal slot sub-page never matches a catch-all route
*   (e.g. slot `about/page.tsx` is not bound to a route `[...slug]`) — the
*   catch-all might or might not resolve to "about" at request time.
*/
function patternsCompatible(slotParts, routeParts) {
	let i = 0;
	let j = 0;
	while (i < slotParts.length) {
		const sp = slotParts[i];
		if (sp.endsWith("+")) return j < routeParts.length;
		if (sp.endsWith("*")) return true;
		if (j >= routeParts.length) return false;
		const rp = routeParts[j];
		if (sp.startsWith(":")) {
			i++;
			j++;
			continue;
		}
		if (rp.startsWith(":")) return false;
		if (sp !== rp) return false;
		i++;
		j++;
	}
	return j === routeParts.length;
}
/**
* Score a slot pattern by specificity so the most-specific match wins:
*   literal > single dynamic > catch-all > optional catch-all.
*
* Required catch-all (`:name+`, ≥1 segment) is more constrained than the
* optional variant (`:name*`, ≥0 segments), so it scores higher.
*/
function scoreSlotPattern(urlSegments) {
	let score = 0;
	for (const seg of urlSegments) if (seg.endsWith("*")) score += 1;
	else if (seg.endsWith("+")) score += 2;
	else if (seg.startsWith(":")) score += 3;
	else score += 4;
	return score;
}
/**
* Map a pattern segment to the tree-node type used by Next.js' route
* validator. Two segments are structurally equivalent iff they share the
* same tree-node type.
*/
function segmentTreeNodeType(seg) {
	if (!seg.startsWith(":")) return `literal:${seg}`;
	if (seg.endsWith("*")) return "optionalCatchAll";
	if (seg.endsWith("+")) return "catchAll";
	return "dynamic";
}
function patternsStructurallyEquivalent(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (segmentTreeNodeType(a[i]) !== segmentTreeNodeType(b[i])) return false;
	return true;
}
/**
* Find a page file at the root URL level of a parallel slot directory, including
* through transparent route-group subdirectories (e.g. `@slot/(group)/page.tsx`
* is equivalent to `@slot/page.tsx` since `(group)` is invisible in the URL).
*
* Returns the absolute page path, or null if no root-level page is found.
*
* Only descends into route-group directories (those whose name starts with `(`
* and ends with `)`). Dynamic segments, regular named dirs, and `@slot` dirs
* are not transparent and are therefore not searched.
*/
function findSlotRootPage(slotDir, matcher) {
	const directPage = findFile(slotDir, "page", matcher);
	if (directPage) return directPage;
	const entries = readDirEntriesCached(slotDir, matcher);
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (!entry.name.startsWith("(") || !entry.name.endsWith(")")) continue;
		const found = findSlotRootPage(path.join(slotDir, entry.name), matcher);
		if (found) return found;
	}
	return null;
}
/**
* Discover parallel route slots (@team, @analytics, etc.) in a directory.
* Returns a ParallelSlot for each @-prefixed subdirectory that has a page,
* default component, intercepting route, or nested page-backed sub-route.
*/
function discoverParallelSlots(dir, appDir, matcher, includeNestedOnlySlots = false) {
	const entries = readDirEntriesCached(dir, matcher);
	const slots = [];
	for (const entry of entries) {
		if (!entry.isDirectory() || !entry.name.startsWith("@")) continue;
		if (entry.name === "@children") continue;
		const slotName = entry.name.slice(1);
		const slotDir = path.join(dir, entry.name);
		const pagePath = findSlotRootPage(slotDir, matcher);
		const defaultPath = findFile(slotDir, "default", matcher);
		const interceptingRoutes = discoverInterceptingRoutes(slotDir, dir, appDir, matcher);
		const hasNestedPages = includeNestedOnlySlots && findSlotSubPages(slotDir, matcher).length > 0;
		if (!pagePath && !defaultPath && interceptingRoutes.length === 0 && !hasNestedPages) continue;
		const ownerSegments = path.relative(appDir, dir).split(path.sep).filter((segment) => segment.length > 0);
		const ownerTreePath = createAppRouteGraphTreePath(ownerSegments, ownerSegments.length);
		const configLayoutPaths = findSlotConfigLayoutPaths(slotDir, pagePath, matcher);
		const notFoundBoundary = findSlotNotFoundBoundary(slotDir, pagePath, matcher);
		slots.push({
			id: createAppRouteGraphSlotId(slotName, ownerTreePath),
			key: `${slotName}@${path.relative(appDir, slotDir)}`,
			name: slotName,
			ownerDir: slotDir,
			ownerTreePath,
			hasPage: pagePath !== null,
			pagePath,
			defaultPath,
			layoutPath: findFile(slotDir, "layout", matcher),
			configLayoutPaths,
			configLayoutTreePositions: findSlotConfigLayoutTreePositions(slotDir, configLayoutPaths),
			loadingPath: findFile(slotDir, "loading", matcher),
			errorPath: findFile(slotDir, "error", matcher),
			notFoundPath: notFoundBoundary.path,
			notFoundTreePosition: notFoundBoundary.treePosition,
			interceptingRoutes,
			layoutIndex: -1,
			routeSegments: pagePath ? [] : null
		});
	}
	return slots;
}
/**
* The interception convention prefix patterns.
* (.) — same level, (..) — one level up, (..)(..)" — two levels up, (...) — root
*/
const INTERCEPT_PATTERNS = [
	{
		prefix: "(...)",
		convention: "..."
	},
	{
		prefix: "(..)(..)",
		convention: "../.."
	},
	{
		prefix: "(..)",
		convention: ".."
	},
	{
		prefix: "(.)",
		convention: "."
	}
];
/**
* Check whether a directory name begins with an interception route marker.
*
* Matches the prefixes listed in {@link INTERCEPT_PATTERNS}: `(.)`, `(..)`,
* `(...)`, `(..)(..)`. The marker is not a real URL segment, so the global
* page/route scanner must skip these directories to avoid materialising
* literal patterns like `/templates/(..)showcase`. Interception target
* registration happens separately via {@link discoverInterceptingRoutes}.
*/
function isInterceptionMarkerDir(name) {
	return matchInterceptConvention(name) !== null;
}
/**
* Discover intercepting routes inside a parallel slot directory.
*
* Intercepting routes use conventions like (.)photo, (..)feed, (...), etc.
* They intercept navigation to another route and render within the slot instead.
*
* @param slotDir - The parallel slot directory (e.g. app/feed/@modal)
* @param routeDir - The directory of the route that owns this slot (e.g. app/feed)
* @param appDir - The root app directory
*/
function discoverInterceptingRoutes(slotDir, routeDir, appDir, matcher) {
	if (!fs.existsSync(slotDir)) return [];
	const results = [];
	scanForInterceptingPages(slotDir, slotDir, routeDir, appDir, results, matcher);
	return results;
}
/**
* Discover sibling-style interception markers — interception marker directories
* (e.g. `(..)showcase`, `(..)(..)hoge`) that are NOT wrapped inside an `@slot`
* directory. Mutates each matching route's `siblingIntercepts` array.
*
* Sibling intercepts use the same conventions and target-computation logic as
* slot intercepts, but their intercepting page replaces the full page response
* (not a slot) during soft navigation.
*/
function discoverSiblingInterceptingRoutes(routes, appDir, matcher) {
	const routesByDir = /* @__PURE__ */ new Map();
	for (const route of routes) {
		const filePath = route.pagePath ?? route.routePath;
		if (!filePath) continue;
		const routeDir = path.dirname(filePath);
		if (!routesByDir.has(routeDir)) routesByDir.set(routeDir, route);
	}
	function walk(dir) {
		let entries;
		try {
			entries = fs.readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (entry.name.startsWith("_")) continue;
			if (entry.name.startsWith("@")) continue;
			const childDir = path.join(dir, entry.name);
			const marker = matchInterceptConvention(entry.name);
			if (marker) {
				const restOfName = entry.name.slice(marker.prefix.length);
				const parentDir = dir;
				const results = [];
				collectInterceptingPages(childDir, childDir, marker.convention, restOfName, parentDir, appDir, parentDir, null, results, matcher);
				for (const ir of results) {
					ir.slotId = createAppRouteGraphSiblingInterceptSlotId(ir.sourceMatchPattern);
					const owner = findOwnerRouteForDir(parentDir, appDir, routes, routesByDir);
					if (owner) owner.siblingIntercepts.push(ir);
				}
				continue;
			}
			walk(childDir);
		}
	}
	walk(appDir);
}
/**
* Find the best route to attach a sibling intercept to, given the directory
* that contains the interception marker.
*
* 1. Exact hit: a route whose page/handler lives directly in `dir`.
* 2. Subtree hit: shallowest route whose page lives anywhere under `dir`
*    (handles catch-all routes like `/templates/:catchAll+`).
* 3. Ancestor walk: walk up the directory tree toward `appDir` looking for
*    any of the above. This handles the case where the marker directory has
*    no sibling pages at all (e.g. `deep/path/(...)target` with no
*    `deep/path/page.tsx`).
*
* Comparisons happen in forward-slash space — inputs go through `toSlash` so
* callers still holding native-separator paths hit the `current === appDir`
* termination instead of overshooting the app root.
*
* Exported for tests.
*/
function findOwnerRouteForDir(dir, appDir, routes, routesByDir) {
	const appRoot = toSlash(appDir);
	let current = toSlash(dir);
	while (true) {
		const exact = routesByDir.get(current);
		if (exact) return exact;
		const currentWithSep = current + "/";
		let best = null;
		for (const route of routes) {
			const filePath = route.pagePath ?? route.routePath;
			if (!filePath) continue;
			if (!toSlash(filePath).startsWith(currentWithSep)) continue;
			if (!best || route.patternParts.length < best.patternParts.length) best = route;
		}
		if (best) return best;
		if (current === appRoot) break;
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}
/**
* Recursively scan a directory tree for page.tsx files that are inside
* intercepting route directories.
*/
function scanForInterceptingPages(currentDir, slotRootDir, routeDir, appDir, results, matcher) {
	if (!fs.existsSync(currentDir)) return;
	const entries = fs.readdirSync(currentDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith("_")) continue;
		const interceptMatch = matchInterceptConvention(entry.name);
		const interceptDir = path.join(currentDir, entry.name);
		if (interceptMatch) {
			const restOfName = entry.name.slice(interceptMatch.prefix.length);
			collectInterceptingPages(interceptDir, interceptDir, interceptMatch.convention, restOfName, routeDir, appDir, currentDir, slotRootDir, results, matcher);
		} else scanForInterceptingPages(interceptDir, slotRootDir, routeDir, appDir, results, matcher);
	}
}
/**
* Match a directory name against interception convention prefixes.
*/
function matchInterceptConvention(name) {
	for (const pattern of INTERCEPT_PATTERNS) if (name.startsWith(pattern.prefix)) return pattern;
	return null;
}
/**
* Collect page.tsx files inside an intercepting route directory tree
* and compute their target URL patterns.
*/
function collectInterceptingPages(currentDir, interceptRoot, convention, interceptSegment, routeDir, appDir, interceptParentDir, slotRootDir, results, matcher, parentLayoutPaths = []) {
	const currentLayoutPath = findFile(currentDir, "layout", matcher);
	const layoutPaths = currentLayoutPath ? [...parentLayoutPaths, currentLayoutPath] : parentLayoutPaths;
	const page = findFile(currentDir, "page", matcher);
	if (page) {
		const targetPattern = computeInterceptTarget(convention, interceptSegment, currentDir, interceptRoot, routeDir, appDir);
		if (targetPattern) {
			const sourceMatchPattern = computeInterceptSourceMatchPattern(interceptParentDir, appDir);
			const notFoundBoundary = findSlotNotFoundBoundary(slotRootDir ?? interceptRoot, page, matcher);
			const branchSegments = [interceptSegment, ...path.relative(interceptRoot, path.dirname(page)).split(path.sep).filter(Boolean)];
			const slotParentSegments = slotRootDir ? path.relative(slotRootDir, interceptParentDir).split(path.sep).filter(Boolean) : [];
			results.push({
				branchSegments,
				convention,
				layoutPaths: [...layoutPaths],
				layoutSegments: layoutPaths.map((layoutPath) => {
					return [interceptSegment, ...path.relative(interceptRoot, path.dirname(layoutPath)).split(path.sep).filter(Boolean)];
				}),
				notFoundBranchSegments: [...slotParentSegments, ...branchSegments],
				notFoundPath: notFoundBoundary.path,
				notFoundTreePosition: notFoundBoundary.treePosition === null ? null : slotRootDir ? notFoundBoundary.treePosition : notFoundBoundary.treePosition + 1,
				targetPattern: targetPattern.pattern,
				sourceMatchPattern,
				pagePath: page,
				sourcePageSegments: path.relative(appDir, path.dirname(page)).split("/").filter(Boolean),
				params: targetPattern.params
			});
		}
	}
	if (!fs.existsSync(currentDir)) return;
	const entries = fs.readdirSync(currentDir, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith("_")) continue;
		collectInterceptingPages(path.join(currentDir, entry.name), interceptRoot, convention, interceptSegment, routeDir, appDir, interceptParentDir, slotRootDir, results, matcher, layoutPaths);
	}
}
/**
* Compute the URL pattern for the *intercepting route* — the path that
* owns the slot containing the interception marker. Route groups (`(name)`)
* and parallel slots (`@slot`) are stripped because Next.js'
* `normalizeAppPath` treats them as invisible in the URL.
*
* Mirrors Next.js' computation in `extractInterceptionRouteInformation`:
* `interceptingRoute = normalizeAppPath(path.split(marker, 2)[0])`.
*
* Returns `/` for the app root.
*
* @see https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/interception-routes.ts
*/
function computeInterceptSourceMatchPattern(interceptParentDir, appDir) {
	const segments = path.relative(appDir, interceptParentDir).split(path.sep).filter(Boolean);
	const converted = convertSegmentsToRouteParts(segments);
	const urlSegments = converted ? converted.urlSegments : segments.filter((segment) => !isInvisibleSegment(segment));
	if (urlSegments.length === 0) return "/";
	return "/" + urlSegments.join("/");
}
/**
* Compute the target URL pattern for an intercepting route.
*
* Interception conventions (..), (..)(..)" climb by *visible route segments*
* (not filesystem directories). Route groups like (marketing) and parallel
* slots like @modal are invisible and must be skipped when counting levels.
*
* - (.) same level: resolve relative to routeDir
* - (..) one level up: climb 1 visible segment
* - (..)(..) two levels up: climb 2 visible segments
* - (...) root: resolve from appDir
*/
function computeInterceptTarget(convention, interceptSegment, currentDir, interceptRoot, routeDir, appDir) {
	const routeSegments = path.relative(appDir, routeDir).split(path.sep).filter(Boolean);
	let baseParts;
	switch (convention) {
		case ".": {
			const interceptParentDir = path.dirname(interceptRoot);
			baseParts = path.relative(appDir, interceptParentDir).split(path.sep).filter(Boolean);
			break;
		}
		case "..":
		case "../..": {
			const levelsToClimb = convention === ".." ? 1 : 2;
			let climbed = 0;
			let cutIndex = routeSegments.length;
			while (cutIndex > 0 && climbed < levelsToClimb) {
				cutIndex--;
				if (!isInvisibleSegment(routeSegments[cutIndex])) climbed++;
			}
			if (climbed < levelsToClimb) {
				const interceptionRoute = formatInterceptionRoutePath(routeSegments, convention, interceptSegment, path.relative(interceptRoot, currentDir).split(path.sep).filter(Boolean));
				if (convention === "..") throw new Error(`Invalid interception route: ${interceptionRoute}. Cannot use (..) marker at the root level, use (.) instead.`);
				throw new Error(`Invalid interception route: ${interceptionRoute}. Cannot use (..)(..) marker at the root level or one level up.`);
			}
			baseParts = routeSegments.slice(0, cutIndex);
			break;
		}
		case "...":
			baseParts = [];
			break;
		default: return null;
	}
	const nestedParts = path.relative(interceptRoot, currentDir).split(path.sep).filter(Boolean);
	const convertedTarget = convertSegmentsToRouteParts([
		...baseParts,
		interceptSegment,
		...nestedParts
	]);
	if (!convertedTarget) return null;
	const { urlSegments, params } = convertedTarget;
	const pattern = "/" + urlSegments.join("/");
	return {
		pattern: pattern === "/" ? "/" : pattern,
		params
	};
}
function formatInterceptionRoutePath(routeSegments, convention, interceptSegment, nestedParts) {
	const marker = markerForInterceptionConvention(convention);
	const convertedRoute = convertSegmentsToRouteParts(routeSegments);
	const routePath = [
		...convertedRoute ? convertedRoute.urlSegments : routeSegments.filter((segment) => !isInvisibleSegment(segment)),
		`${marker}${interceptSegment}`,
		...nestedParts
	].filter(Boolean).join("/");
	return routePath ? `/${routePath}` : "/";
}
function markerForInterceptionConvention(convention) {
	switch (convention) {
		case ".": return "(.)";
		case "..": return "(..)";
		case "../..": return "(..)(..)";
		case "...": return "(...)";
		default: return "";
	}
}
/**
* Scan-scoped cache of convention-file probes, keyed by the per-scan matcher
* created in `buildAppRouteGraph`. A single scan walks the appDir→leaf chain
* separately for every route (layouts, templates, errors, boundaries, slots),
* so shared ancestor directories — the `app/` root above all — get re-probed
* once per descendant route. The probe result is deterministic within one scan
* (the filesystem does not change mid-build), so memoizing it removes the
* dominant cross-route redundancy.
*
* Keyed by matcher so the cache lifetime is exactly one `buildAppRouteGraph`
* call: the scan registers a fresh matcher clone, and the entry is unreachable
* (and GC-eligible) once the scan returns. A fresh key per scan is also what
* makes this concurrency-safe — overlapping builds never share probe state.
*/
const findFileProbeCache = /* @__PURE__ */ new WeakMap();
/**
* Find a file by name (without extension) in a directory, checking configured
* pageExtensions. Memoizes through `findFileProbeCache` when the matcher has a
* registered per-scan cache; otherwise falls back to a direct probe (identical
* result). The `null` "not found" outcome is cached too, so repeated misses on
* shared ancestors cost a single set of `existsSync` calls per scan.
*/
function findFile(dir, name, matcher) {
	const cache = findFileProbeCache.get(matcher);
	if (!cache) return findFileWithExts(dir, name, matcher);
	const key = `${dir}\0${name}`;
	const cached = cache.get(key);
	if (cached !== void 0) return cached;
	const result = findFileWithExts(dir, name, matcher);
	cache.set(key, result);
	return result;
}
/**
* Convert filesystem path segments to URL route parts, skipping invisible segments
* (route groups, @slots, ".") and converting dynamic segment syntax to Express-style
* patterns (e.g. "[id]" → ":id", "[...slug]" → ":slug+").
*/
function convertSegmentsToRouteParts(segments) {
	const urlSegments = [];
	const params = [];
	let isDynamic = false;
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		if (isInvisibleSegment(segment)) continue;
		const catchAllMatch = segment.match(/^\[\.\.\.([^\]]+)\]$/);
		if (catchAllMatch) {
			if (hasRemainingVisibleSegments(segments, i + 1)) return null;
			if (catchAllMatch[1].endsWith("+") || catchAllMatch[1].endsWith("*")) return null;
			isDynamic = true;
			params.push(catchAllMatch[1]);
			urlSegments.push(`:${catchAllMatch[1]}+`);
			continue;
		}
		const optionalCatchAllMatch = segment.match(/^\[\[\.\.\.([^\]]+)\]\]$/);
		if (optionalCatchAllMatch) {
			if (hasRemainingVisibleSegments(segments, i + 1)) return null;
			if (optionalCatchAllMatch[1].endsWith("+") || optionalCatchAllMatch[1].endsWith("*")) return null;
			isDynamic = true;
			params.push(optionalCatchAllMatch[1]);
			urlSegments.push(`:${optionalCatchAllMatch[1]}*`);
			continue;
		}
		const dynamicMatch = segment.match(/^\[([^\]]+)\]$/);
		if (dynamicMatch) {
			if (dynamicMatch[1].endsWith("+") || dynamicMatch[1].endsWith("*")) return null;
			isDynamic = true;
			params.push(dynamicMatch[1]);
			urlSegments.push(`:${dynamicMatch[1]}`);
			continue;
		}
		urlSegments.push(decodeRouteSegment(segment));
	}
	return {
		urlSegments,
		params,
		isDynamic
	};
}
function hasRemainingVisibleSegments(segments, startIndex) {
	for (let i = startIndex; i < segments.length; i++) if (!isInvisibleSegment(segments[i])) return true;
	return false;
}
function joinRoutePattern(basePattern, subPath) {
	if (!subPath) return basePattern;
	return basePattern === "/" ? `/${subPath}` : `${basePattern}/${subPath}`;
}
/**
* Returns the unique static sibling segment names at each dynamic URL level
* of the matched route. Mirrors Next.js's `getStaticSiblingSegments` from
* the next-app-loader: for `/products/[id]` with a sibling route at
* `/products/sale`, the dynamic `[id]` segment has `staticSiblings: ['sale']`.
*
* The returned list flattens siblings across all dynamic positions and is
* intended for the RSC payload — the client router uses it to determine if
* a cached dynamic-route prefetch can be reused when navigating to a static
* sibling URL.
*
* Ported from Next.js: packages/next/src/build/webpack/loaders/next-app-loader/index.ts
* (getStaticSiblingSegments).
*
* Route group segments and parallel-route slot segments are part of the
* filesystem tree but not the URL namespace — sibling computation is done on
* the URL-level `patternParts`, so they are correctly transparent here.
*/
function computeAppRouteStaticSiblings(allRoutes, matchedRoute) {
	const siblings = /* @__PURE__ */ new Set();
	const parts = matchedRoute.patternParts;
	if (!parts) return [];
	for (let level = 0; level < parts.length; level++) {
		const segmentAtLevel = parts[level];
		if (!segmentAtLevel.startsWith(":")) continue;
		for (const otherRoute of allRoutes) {
			const otherParts = otherRoute.patternParts;
			if (!otherParts || otherParts.length <= level) continue;
			let prefixMatches = true;
			for (let i = 0; i < level; i++) if (parts[i] !== otherParts[i]) {
				prefixMatches = false;
				break;
			}
			if (!prefixMatches) continue;
			const otherSegmentAtLevel = otherParts[level];
			if (otherSegmentAtLevel === segmentAtLevel) continue;
			if (otherSegmentAtLevel.startsWith(":")) continue;
			siblings.add(otherSegmentAtLevel);
		}
	}
	return Array.from(siblings);
}
//#endregion
export { buildAppRouteGraph, computeAppRouteStaticSiblings, computeRootParamNames, convertSegmentsToRouteParts, findOwnerRouteForDir, isInvisibleSegment };
