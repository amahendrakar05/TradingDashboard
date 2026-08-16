import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { computeAppRouteStaticSiblings, convertSegmentsToRouteParts } from "../routing/app-route-graph.js";
import "../routing/app-router.js";
import { createMetadataRouteEntriesSource } from "../server/metadata-route-build-data.js";
//#region src/entries/app-rsc-manifest.ts
function findRootBoundaryRoute(routes) {
	return routes.find((route) => route.pattern === "/") ?? routes.find((route) => route.layouts.length > 0 && route.layoutTreePositions.length > 0);
}
function rootRouteLayoutPaths(route) {
	if (!route) return [];
	if (route.pattern === "/") return route.layouts;
	const rootPosition = route.layoutTreePositions[0];
	return route.layouts.filter((_, index) => route.layoutTreePositions[index] === rootPosition);
}
function rootRouteBoundaryPath(route, boundaryPaths, fallbackPath) {
	if (!route) return null;
	if (route.pattern === "/") return fallbackPath ?? null;
	return boundaryPaths?.[0] ?? fallbackPath ?? null;
}
function createImportAllocator() {
	const imports = [];
	const importMap = /* @__PURE__ */ new Map();
	const lazyMap = /* @__PURE__ */ new Map();
	let importIdx = 0;
	let lazyIdx = 0;
	return {
		importMap,
		imports,
		getImportVar(filePath) {
			const existing = importMap.get(filePath);
			if (existing) return existing;
			const varName = `mod_${importIdx++}`;
			const absPath = toSlash(filePath);
			imports.push(`import * as ${varName} from ${JSON.stringify(absPath)};`);
			importMap.set(filePath, varName);
			return varName;
		},
		getLazyLoaderVar(filePath) {
			const existing = lazyMap.get(filePath);
			if (existing) return existing;
			const varName = `load_${lazyIdx++}`;
			const absPath = toSlash(filePath);
			imports.push(`const ${varName} = () => import(${JSON.stringify(absPath)});`);
			lazyMap.set(filePath, varName);
			return varName;
		}
	};
}
function registerRouteModules(routes, imports) {
	for (const route of routes) {
		if (route.pagePath) imports.getLazyLoaderVar(route.pagePath);
		if (route.routePath) imports.getLazyLoaderVar(route.routePath);
		for (const layout of route.layouts) imports.getLazyLoaderVar(layout);
		for (const tmpl of route.templates) imports.getLazyLoaderVar(tmpl);
		if (route.loadingPath) imports.getLazyLoaderVar(route.loadingPath);
		if (route.errorPath) imports.getLazyLoaderVar(route.errorPath);
		if (route.layoutErrorPaths) {
			for (const ep of route.layoutErrorPaths) if (ep) imports.getLazyLoaderVar(ep);
		}
		if (route.errorPaths) for (const ep of route.errorPaths) imports.getLazyLoaderVar(ep);
		if (route.notFoundPath) imports.getLazyLoaderVar(route.notFoundPath);
		if (route.notFoundPaths) {
			for (const nfp of route.notFoundPaths) if (nfp) imports.getLazyLoaderVar(nfp);
		}
		if (route.forbiddenPath) imports.getLazyLoaderVar(route.forbiddenPath);
		if (route.forbiddenPaths) {
			for (const fp of route.forbiddenPaths) if (fp) imports.getLazyLoaderVar(fp);
		}
		if (route.unauthorizedPath) imports.getLazyLoaderVar(route.unauthorizedPath);
		if (route.unauthorizedPaths) {
			for (const up of route.unauthorizedPaths) if (up) imports.getLazyLoaderVar(up);
		}
		for (const slot of route.parallelSlots) {
			if (slot.pagePath) imports.getLazyLoaderVar(slot.pagePath);
			if (slot.defaultPath) imports.getLazyLoaderVar(slot.defaultPath);
			if (slot.layoutPath) imports.getLazyLoaderVar(slot.layoutPath);
			for (const layoutPath of slot.configLayoutPaths ?? []) imports.getLazyLoaderVar(layoutPath);
			if (slot.loadingPath) imports.getLazyLoaderVar(slot.loadingPath);
			if (slot.errorPath) imports.getLazyLoaderVar(slot.errorPath);
			if (slot.notFoundPath) imports.getLazyLoaderVar(slot.notFoundPath);
			for (const ir of slot.interceptingRoutes) {
				imports.getLazyLoaderVar(ir.pagePath);
				if (ir.notFoundPath) imports.getLazyLoaderVar(ir.notFoundPath);
				for (const layoutPath of ir.layoutPaths) imports.getLazyLoaderVar(layoutPath);
			}
		}
		for (const ir of route.siblingIntercepts ?? []) {
			imports.getLazyLoaderVar(ir.pagePath);
			if (ir.notFoundPath) imports.getLazyLoaderVar(ir.notFoundPath);
			for (const layoutPath of ir.layoutPaths) imports.getLazyLoaderVar(layoutPath);
		}
	}
}
function moduleArray(length) {
	return `[${Array.from({ length }, () => "null").join(", ")}]`;
}
function lazyLoaderArray(filePaths, imports) {
	return `[${filePaths.map((filePath) => filePath ? imports.getLazyLoaderVar(filePath) : "null").join(", ")}]`;
}
function buildRouteEntries(routes, imports) {
	return routes.map((route, routeIdx) => {
		const staticSiblings = route.isDynamic ? computeAppRouteStaticSiblings(routes, route) : [];
		const layoutLoaders = lazyLoaderArray(route.layouts, imports);
		const templateLoaders = lazyLoaderArray(route.templates, imports);
		const notFoundPaths = route.notFoundPaths ?? [];
		const forbiddenPaths = route.forbiddenPaths ?? [];
		const unauthorizedPaths = route.unauthorizedPaths ?? [];
		const notFoundLoaders = lazyLoaderArray(notFoundPaths, imports);
		const forbiddenLoaders = lazyLoaderArray(forbiddenPaths, imports);
		const unauthorizedLoaders = lazyLoaderArray(unauthorizedPaths, imports);
		const siblingInterceptEntries = (route.siblingIntercepts ?? []).map((ir) => `    {
      convention: ${JSON.stringify(ir.convention)},
      targetPattern: ${JSON.stringify(ir.targetPattern)},
      sourceMatchPattern: ${JSON.stringify(ir.sourceMatchPattern)},
      sourcePageSegments: ${JSON.stringify(ir.sourcePageSegments)},
      slotId: ${JSON.stringify(ir.slotId ?? null)},
      interceptLayouts: ${moduleArray(ir.layoutPaths.length)},
      __loadInterceptLayouts: ${lazyLoaderArray(ir.layoutPaths, imports)},
      interceptLayoutSegments: ${JSON.stringify(ir.layoutSegments ?? [])},
      interceptBranchSegments: ${JSON.stringify(ir.branchSegments ?? [])},
      interceptNotFoundBranchSegments: ${JSON.stringify(ir.notFoundBranchSegments ?? ir.branchSegments ?? [])},
      page: null,
      __pageLoader: ${imports.getLazyLoaderVar(ir.pagePath)},
      notFound: null,
      __loadNotFound: ${ir.notFoundPath ? imports.getLazyLoaderVar(ir.notFoundPath) : "null"},
      notFoundTreePosition: ${ir.notFoundTreePosition ?? "null"},
      params: ${JSON.stringify(ir.params)},
    }`);
		const slotEntries = route.parallelSlots.map((slot) => {
			const interceptEntries = slot.interceptingRoutes.map((ir) => `        {
          convention: ${JSON.stringify(ir.convention)},
          targetPattern: ${JSON.stringify(ir.targetPattern)},
          sourceMatchPattern: ${JSON.stringify(ir.sourceMatchPattern)},
          sourcePageSegments: ${JSON.stringify(ir.sourcePageSegments)},
          interceptLayouts: ${moduleArray(ir.layoutPaths.length)},
          __loadInterceptLayouts: ${lazyLoaderArray(ir.layoutPaths, imports)},
          interceptLayoutSegments: ${JSON.stringify(ir.layoutSegments ?? [])},
          interceptBranchSegments: ${JSON.stringify(ir.branchSegments ?? [])},
          interceptNotFoundBranchSegments: ${JSON.stringify(ir.notFoundBranchSegments ?? ir.branchSegments ?? [])},
          page: null,
          __pageLoader: ${imports.getLazyLoaderVar(ir.pagePath)},
          notFound: null,
          __loadNotFound: ${ir.notFoundPath ? imports.getLazyLoaderVar(ir.notFoundPath) : "null"},
          notFoundTreePosition: ${ir.notFoundTreePosition ?? "null"},
          params: ${JSON.stringify(ir.params)},
        }`);
			return `      ${JSON.stringify(slot.key)}: {
        id: ${JSON.stringify(slot.id ?? null)},
        name: ${JSON.stringify(slot.name)},
        page: null,
        __loadPage: ${slot.pagePath ? imports.getLazyLoaderVar(slot.pagePath) : "null"},
        default: null,
        __loadDefault: ${slot.defaultPath ? imports.getLazyLoaderVar(slot.defaultPath) : "null"},
        layout: null,
        __loadLayout: ${slot.layoutPath ? imports.getLazyLoaderVar(slot.layoutPath) : "null"},
        configLayouts: ${moduleArray(slot.configLayoutPaths?.length ?? 0)},
        __loadConfigLayouts: ${lazyLoaderArray(slot.configLayoutPaths ?? [], imports)},
        configLayoutTreePositions: ${JSON.stringify(slot.configLayoutTreePositions ?? [])},
        loading: null,
        __loadLoading: ${slot.loadingPath ? imports.getLazyLoaderVar(slot.loadingPath) : "null"},
        error: null,
        __loadError: ${slot.errorPath ? imports.getLazyLoaderVar(slot.errorPath) : "null"},
        notFound: null,
        __loadNotFound: ${slot.notFoundPath ? imports.getLazyLoaderVar(slot.notFoundPath) : "null"},
        notFoundTreePosition: ${slot.notFoundTreePosition ?? "null"},
        layoutIndex: ${slot.layoutIndex},
        routeSegments: ${JSON.stringify(slot.routeSegments)},
        slotPatternParts: ${slot.slotPatternParts ? JSON.stringify(slot.slotPatternParts) : "null"},
        slotParamNames: ${slot.slotParamNames ? JSON.stringify(slot.slotParamNames) : "null"},
        intercepts: [
${interceptEntries.join(",\n")}
        ],
      }`;
		});
		const layoutErrorPaths = route.layoutErrorPaths ?? [];
		const errorPaths = route.errorPaths ?? [];
		const layoutErrorLoaders = lazyLoaderArray(layoutErrorPaths, imports);
		const errorLoaders = lazyLoaderArray(errorPaths, imports);
		const loadPageField = route.pagePath ? imports.getLazyLoaderVar(route.pagePath) : "null";
		const loadRouteHandlerField = route.routePath ? imports.getLazyLoaderVar(route.routePath) : "null";
		return `  {
    __buildTimeClassifications: __VINEXT_CLASS(${routeIdx}), // evaluated once at module load
    __buildTimeReasons: __classDebug ? __VINEXT_CLASS_REASONS(${routeIdx}) : null,
    ids: ${JSON.stringify(route.ids ?? null)},
    pattern: ${JSON.stringify(route.pattern)},
    patternParts: ${JSON.stringify(route.patternParts)},
    isDynamic: ${route.isDynamic},
    params: ${JSON.stringify(route.params)},
    staticSiblings: ${JSON.stringify(staticSiblings)},
    rootParamNames: ${JSON.stringify(route.rootParamNames ?? [])},
    page: null,
    __loadPage: ${loadPageField},
    routeHandler: null,
    __loadRouteHandler: ${loadRouteHandlerField},
    layouts: ${moduleArray(route.layouts.length)},
    __loadLayouts: ${layoutLoaders},
    routeSegments: ${JSON.stringify(route.routeSegments)},
    childrenRouteSegments: ${JSON.stringify(route.childrenRouteSegments ?? null)},
    templateTreePositions: ${JSON.stringify(route.templateTreePositions)},
    layoutTreePositions: ${JSON.stringify(route.layoutTreePositions)},
    templates: ${moduleArray(route.templates.length)},
    __loadTemplates: ${templateLoaders},
    errors: ${moduleArray(layoutErrorPaths.length)},
    __loadErrors: ${layoutErrorLoaders},
    errorPaths: ${moduleArray(errorPaths.length)},
    __loadErrorPaths: ${errorLoaders},
    errorTreePositions: ${JSON.stringify(route.errorTreePositions ?? null)},
    slots: {
${slotEntries.join(",\n")}
    },
    childrenSlot: ${JSON.stringify(route.childrenSlot ?? null)},
    siblingIntercepts: [
${siblingInterceptEntries.join(",\n")}
    ],
    loading: null,
    __loadLoading: ${route.loadingPath ? imports.getLazyLoaderVar(route.loadingPath) : "null"},
    error: null,
    __loadError: ${route.errorPath ? imports.getLazyLoaderVar(route.errorPath) : "null"},
    notFound: null,
    __loadNotFound: ${route.notFoundPath ? imports.getLazyLoaderVar(route.notFoundPath) : "null"},
    notFoundTreePosition: ${route.notFoundTreePosition ?? "null"},
    notFounds: ${moduleArray(notFoundPaths.length)},
    __loadNotFounds: ${notFoundLoaders},
    forbidden: null,
    __loadForbidden: ${route.forbiddenPath ? imports.getLazyLoaderVar(route.forbiddenPath) : "null"},
    forbiddenTreePosition: ${route.forbiddenTreePosition ?? "null"},
    forbiddens: ${moduleArray(forbiddenPaths.length)},
    __loadForbiddens: ${forbiddenLoaders},
    unauthorized: null,
    __loadUnauthorized: ${route.unauthorizedPath ? imports.getLazyLoaderVar(route.unauthorizedPath) : "null"},
    unauthorizedTreePosition: ${route.unauthorizedTreePosition ?? "null"},
    unauthorizeds: ${moduleArray(unauthorizedPaths.length)},
    __loadUnauthorizeds: ${unauthorizedLoaders},
  }`;
	});
}
function createRoutePatternPrefix(routeSegments, treePosition) {
	const limit = Math.min(treePosition, routeSegments.length);
	const converted = convertSegmentsToRouteParts(routeSegments.slice(0, limit));
	if (!converted) return null;
	return {
		pattern: converted.urlSegments.length === 0 ? "/" : `/${converted.urlSegments.join("/")}`,
		paramNames: converted.params
	};
}
function appendStaticParamSource(sourcesByPattern, pattern, sourceVar) {
	if (!pattern || pattern === "/" || !pattern.includes(":")) return;
	const sources = sourcesByPattern.get(pattern) ?? [];
	if (!sources.includes(sourceVar)) sources.push(sourceVar);
	sourcesByPattern.set(pattern, sources);
}
function buildRootParamNamesByPattern(routes) {
	const namesByPattern = /* @__PURE__ */ new Map();
	function append(pattern, rootParamNames, paramNames) {
		if (!pattern || pattern === "/" || !pattern.includes(":")) return;
		const patternParams = new Set(paramNames);
		const names = (rootParamNames ?? []).filter((name) => patternParams.has(name));
		if (names.length === 0) return;
		const existing = namesByPattern.get(pattern) ?? [];
		for (const name of names) if (!existing.includes(name)) existing.push(name);
		namesByPattern.set(pattern, existing);
	}
	for (const route of routes) {
		if (!route.isDynamic) continue;
		append(route.pattern, route.rootParamNames, route.params);
		for (const treePosition of route.layoutTreePositions) {
			const prefix = createRoutePatternPrefix(route.routeSegments, treePosition);
			append(prefix?.pattern ?? null, route.rootParamNames, prefix?.paramNames ?? []);
		}
	}
	return namesByPattern;
}
function buildGenerateStaticParamsEntries(routes, imports, namesByPattern) {
	const sourcesByPattern = /* @__PURE__ */ new Map();
	for (const route of routes) {
		if (!route.isDynamic) continue;
		for (const [index, layoutPath] of route.layouts.entries()) appendStaticParamSource(sourcesByPattern, createRoutePatternPrefix(route.routeSegments, route.layoutTreePositions[index] ?? 0)?.pattern ?? null, `{ load: ${imports.getLazyLoaderVar(layoutPath)} }`);
		if (route.pagePath) appendStaticParamSource(sourcesByPattern, route.pattern, `{ load: ${imports.getLazyLoaderVar(route.pagePath)} }`);
	}
	return Array.from(sourcesByPattern.entries()).map(([pattern, sources]) => {
		const rootParamNames = namesByPattern.get(pattern) ?? [];
		return `  ${JSON.stringify(pattern)}: __createAppPrerenderStaticParamsResolver([${sources.join(", ")}], ${JSON.stringify(rootParamNames)}),`;
	});
}
function buildRootParamNameEntries(namesByPattern) {
	return Array.from(namesByPattern.entries()).map(([pattern, names]) => `  ${JSON.stringify(pattern)}: ${JSON.stringify(names)},`);
}
function buildAppRscManifestCode(options) {
	const imports = createImportAllocator();
	const metadataRoutes = options.metadataRoutes ?? [];
	registerRouteModules(options.routes, imports);
	const routeEntries = buildRouteEntries(options.routes, imports);
	const rootRoute = findRootBoundaryRoute(options.routes);
	const rootNotFoundPath = rootRouteBoundaryPath(rootRoute, rootRoute?.notFoundPaths, rootRoute?.notFoundPath);
	const rootForbiddenPath = rootRouteBoundaryPath(rootRoute, rootRoute?.forbiddenPaths, rootRoute?.forbiddenPath);
	const rootUnauthorizedPath = rootRouteBoundaryPath(rootRoute, rootRoute?.unauthorizedPaths, rootRoute?.unauthorizedPath);
	const rootNotFoundVar = rootNotFoundPath ? imports.getImportVar(rootNotFoundPath) : null;
	const rootForbiddenVar = rootForbiddenPath ? imports.getImportVar(rootForbiddenPath) : null;
	const rootUnauthorizedVar = rootUnauthorizedPath ? imports.getImportVar(rootUnauthorizedPath) : null;
	const rootLayoutVars = rootRouteLayoutPaths(rootRoute).map((layoutPath) => imports.getImportVar(layoutPath));
	const globalErrorVar = options.globalErrorPath ? imports.getImportVar(options.globalErrorPath) : null;
	const globalNotFoundImportSpecifier = options.globalNotFoundPath ? JSON.stringify(toSlash(options.globalNotFoundPath)) : null;
	const dynamicMetadataRoutes = metadataRoutes.filter((r) => r.isDynamic);
	for (const route of dynamicMetadataRoutes) imports.getImportVar(route.filePath);
	const namesByPattern = buildRootParamNamesByPattern(options.routes);
	return {
		imports: imports.imports,
		routeEntries,
		metaRouteEntries: createMetadataRouteEntriesSource(metadataRoutes, imports.importMap),
		generateStaticParamsEntries: buildGenerateStaticParamsEntries(options.routes, imports, namesByPattern),
		rootParamNameEntries: buildRootParamNameEntries(namesByPattern),
		rootNotFoundVar,
		rootForbiddenVar,
		rootUnauthorizedVar,
		rootLayoutVars,
		globalErrorVar,
		globalNotFoundImportSpecifier
	};
}
//#endregion
export { buildAppRscManifestCode };
