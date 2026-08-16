import { notFoundResponse } from "./http-error-responses.js";
import { runWithFetchDedupe } from "../shims/fetch-cache.js";
import { matchRoutePattern } from "../routing/route-pattern.js";
import { getAppPageSegmentParamName } from "./app-page-params.js";
import { loadAppInterceptLayouts } from "./app-route-module-loader.js";
//#region src/server/app-page-request.ts
function pickRouteParams(matchedParams, routeParamNames) {
	const params = {};
	for (const paramName of routeParamNames) {
		const value = matchedParams[paramName];
		if (value !== void 0) params[paramName] = value;
	}
	return params;
}
function remapRouteParams(matchedParams, source) {
	if (source.paramPatternParts && source.routePatternParts) {
		const urlParts = [];
		for (const part of source.routePatternParts) {
			if (!part.startsWith(":")) {
				urlParts.push(part);
				continue;
			}
			const value = matchedParams[part.slice(1).replace(/[+*]$/, "")];
			if (Array.isArray(value)) urlParts.push(...value.map(encodeURIComponent));
			else if (value !== void 0) urlParts.push(encodeURIComponent(value));
		}
		const slotParams = matchRoutePattern(urlParts, source.paramPatternParts);
		if (slotParams) return slotParams;
	}
	if (!source.paramAliases) return matchedParams;
	const params = { ...matchedParams };
	for (const [routeParamName, sourceParamName] of Object.entries(source.paramAliases)) {
		const value = matchedParams[routeParamName];
		if (value === void 0) continue;
		delete params[routeParamName];
		params[sourceParamName] = value;
	}
	return params;
}
function collectParentParamNames(routeSegments, boundaryPosition) {
	const limit = Math.max(0, Math.min(boundaryPosition, routeSegments.length));
	const names = [];
	for (const segment of routeSegments.slice(0, limit)) {
		const name = getAppPageSegmentParamName(segment);
		if (name && !names.includes(name)) names.push(name);
	}
	return names;
}
function getLayoutGenerateStaticParamsBoundary(routeSegments, layoutTreePosition) {
	let boundary = Math.min((layoutTreePosition ?? 0) - 1, routeSegments.length - 1);
	while (boundary >= 0) {
		const segment = routeSegments[boundary];
		if (!segment.startsWith("@") && !(segment.startsWith("(") && segment.endsWith(")"))) break;
		boundary -= 1;
	}
	return boundary;
}
function getParallelParentParamNames(routeParamNames, branch, boundaryPosition) {
	const slotParamNames = branch.paramNames ?? routeParamNames;
	const branchParamNames = collectParentParamNames(branch.routeSegments ?? [], boundaryPosition);
	const branchParamNameSet = new Set((branch.routeSegments ?? []).flatMap((segment) => {
		const name = getAppPageSegmentParamName(segment);
		return name ? [name] : [];
	}));
	const ownerParamNames = slotParamNames.filter((name) => !branchParamNameSet.has(name));
	return [.../* @__PURE__ */ new Set([...ownerParamNames, ...branchParamNames])];
}
function resolveAppPageGenerateStaticParamsSources(options) {
	const sources = [];
	options.layouts?.forEach((layout, index) => {
		if (typeof layout?.generateStaticParams !== "function") return;
		sources.push({
			chained: true,
			generateStaticParams: layout.generateStaticParams,
			parentParamNames: collectParentParamNames(options.routeSegments, getLayoutGenerateStaticParamsBoundary(options.routeSegments, options.layoutTreePositions?.[index]))
		});
	});
	if (typeof options.page?.generateStaticParams === "function") sources.push({
		chained: true,
		generateStaticParams: options.page.generateStaticParams,
		parentParamNames: collectParentParamNames(options.routeSegments, Math.max(0, options.routeSegments.length - 1))
	});
	const routeParamNames = options.routeSegments.flatMap((segment) => {
		const name = getAppPageSegmentParamName(segment);
		return name ? [name] : [];
	});
	for (const [independentChain, parallelBranch] of (options.parallelBranches ?? []).entries()) {
		if (!parallelBranch) continue;
		const slotParamNames = parallelBranch.paramNames ?? routeParamNames;
		const paramAliases = Object.fromEntries(routeParamNames.flatMap((routeParamName, index) => {
			const slotParamName = slotParamNames[index];
			return slotParamName && slotParamName !== routeParamName ? [[routeParamName, slotParamName]] : [];
		}));
		const addParallelSource = (module, boundaryPosition) => {
			if (typeof module?.generateStaticParams !== "function") return;
			sources.push({
				generateStaticParams: module.generateStaticParams,
				independentChain,
				...Object.keys(paramAliases).length > 0 ? { paramAliases } : {},
				...parallelBranch.patternParts ? { paramPatternParts: parallelBranch.patternParts } : {},
				...options.routePatternParts ? { routePatternParts: options.routePatternParts } : {},
				parentParamNames: getParallelParentParamNames(routeParamNames, parallelBranch, boundaryPosition)
			});
		};
		addParallelSource(parallelBranch.layout, -1);
		parallelBranch.configLayouts?.forEach((layout, index) => {
			addParallelSource(layout, getLayoutGenerateStaticParamsBoundary(parallelBranch.routeSegments ?? [], parallelBranch.configLayoutTreePositions?.[index]));
		});
		addParallelSource(parallelBranch.page, Math.max(0, (parallelBranch.routeSegments?.length ?? 0) - 1));
	}
	return sources;
}
function areStaticParamsAllowed(params, staticParams, allowMissingValues = false) {
	const paramKeys = Object.keys(params);
	const stringParamMatches = (value, staticValue) => value === encodeURIComponent(staticValue);
	return staticParams.some((staticParamSet) => paramKeys.every((key) => {
		const value = params[key];
		const staticValue = staticParamSet[key];
		if (!Object.hasOwn(staticParamSet, key)) return allowMissingValues;
		if (Array.isArray(value)) return Array.isArray(staticValue) && value.length === staticValue.length && value.every((part, index) => typeof staticValue[index] === "string" ? stringParamMatches(part, staticValue[index]) : part === staticValue[index]);
		if (typeof staticValue === "string") return stringParamMatches(value, staticValue);
		if (typeof staticValue === "number" || typeof staticValue === "boolean") return String(value) === String(staticValue);
		return JSON.stringify(value) === JSON.stringify(staticValue);
	}));
}
function remapStaticParamsToRouteParams(staticParams, source) {
	if (!source.paramAliases) return [...staticParams];
	const routeParamNamesBySourceName = new Map(Object.entries(source.paramAliases).map(([routeParamName, sourceParamName]) => [sourceParamName, routeParamName]));
	return staticParams.map((params) => Object.fromEntries(Object.entries(params).map(([name, value]) => [routeParamNamesBySourceName.get(name) ?? name, value])));
}
async function generateIndependentStaticParams(sources, primaryParams, requestParams) {
	let rows = (primaryParams ?? []).map((params) => ({
		params,
		branchParams: {}
	}));
	let hasParentParams = rows.length > 0;
	let validated = false;
	for (const source of sources) {
		const parents = hasParentParams ? rows : [{
			params: {},
			branchParams: {}
		}];
		const nextRows = [];
		for (const parent of parents) {
			const sourceParams = remapRouteParams({
				...requestParams,
				...parent.params
			}, source);
			const branchParams = remapRouteParams(parent.branchParams, source);
			const result = await runWithFetchDedupe(() => source.generateStaticParams({ params: {
				...pickRouteParams(sourceParams, source.parentParamNames),
				...branchParams
			} }));
			if (!Array.isArray(result)) {
				if (hasParentParams) nextRows.push(parent);
				continue;
			}
			validated = true;
			const routeResults = remapStaticParamsToRouteParams(result, source);
			if (routeResults.length === 0) {
				if (hasParentParams) nextRows.push(parent);
				continue;
			}
			for (const routeResult of routeResults) nextRows.push({
				params: {
					...parent.params,
					...routeResult
				},
				branchParams: {
					...parent.branchParams,
					...routeResult
				}
			});
		}
		rows = nextRows;
		hasParentParams = rows.length > 0;
	}
	return {
		staticParams: rows.map((row) => row.params),
		validated
	};
}
async function generateChainedStaticParams(sources) {
	let generatedParams = [];
	for (const source of sources) {
		const hasParentParams = generatedParams.length > 0;
		const parents = hasParentParams ? generatedParams : [{}];
		const nextParams = [];
		for (const parentParams of parents) {
			const result = await runWithFetchDedupe(() => source.generateStaticParams({ params: parentParams }));
			if (Array.isArray(result) && result.length > 0) {
				for (const item of result) if (item !== null && typeof item === "object" && !Array.isArray(item)) nextParams.push({
					...parentParams,
					...item
				});
			} else if (hasParentParams) nextParams.push(parentParams);
		}
		generatedParams = nextParams;
	}
	return generatedParams;
}
function normalizeGenerateStaticParams(generateStaticParams) {
	return (Array.isArray(generateStaticParams) ? generateStaticParams : [generateStaticParams]).flatMap((source) => {
		if (typeof source === "function") return [{
			generateStaticParams: source,
			parentParamNames: []
		}];
		if (typeof source?.generateStaticParams === "function") return [source];
		return [];
	});
}
async function validateAppPageDynamicParams(options) {
	if (!options.enforceStaticParamsOnly || !options.isDynamicRoute) return null;
	const generateStaticParamsSources = normalizeGenerateStaticParams(options.generateStaticParams);
	if (generateStaticParamsSources.length === 0) {
		options.clearRequestContext();
		return notFoundResponse();
	}
	const chainedSources = generateStaticParamsSources.filter((source) => source.chained);
	let chainedStaticParams = null;
	if (chainedSources.length > 0) chainedStaticParams = await generateChainedStaticParams(chainedSources);
	const independentChains = /* @__PURE__ */ new Map();
	for (const source of generateStaticParamsSources.filter((source) => !source.chained)) {
		const chain = independentChains.get(source.independentChain ?? source) ?? [];
		chain.push(source);
		independentChains.set(source.independentChain ?? source, chain);
	}
	let validatedIndependentResults = false;
	for (const sources of independentChains.values()) {
		const result = await generateIndependentStaticParams(sources, chainedStaticParams, options.params);
		if (result.validated) {
			validatedIndependentResults = true;
			if (!areStaticParamsAllowed(options.params, result.staticParams, true)) {
				options.clearRequestContext();
				return notFoundResponse();
			}
		}
	}
	if (chainedStaticParams && !validatedIndependentResults) {
		if (!areStaticParamsAllowed(options.params, chainedStaticParams)) {
			options.clearRequestContext();
			return notFoundResponse();
		}
	}
	return null;
}
/**
* Pure: decides whether the incoming request should re-render an intercepted
* source-route tree, and if so returns the source route, the source-route's
* param slice, the full matched param set (the URL params the client sees),
* and an opaque `interceptOpts` bag for the caller's render pipeline.
*
* Returns `null` in three decision-fallthrough cases:
*   - non-RSC requests (server rendering the direct page for a full HTML load)
*   - no intercepting route matches the path
*   - the match's source route IS the current route (the same branch today
*     returns `interceptOpts` for the direct render)
*
* Shared by both the GET path (resolveAppPageIntercept, which layers on
* `setNavigationContext` + element build + Response wrap) and the server-action
* POST path (entries/app-rsc-entry.ts), which runs its own response pipeline.
*/
async function resolveAppPageInterceptMatch(options) {
	const interceptState = await resolveAppPageInterceptState(options);
	if (interceptState.kind !== "source-route") return null;
	return {
		interceptOpts: options.toInterceptOpts(interceptState.intercept),
		matchedParams: interceptState.intercept.matchedParams,
		sourceParams: pickRouteParams(interceptState.intercept.sourceMatchedParams ?? interceptState.intercept.matchedParams, options.getRouteParamNames(interceptState.sourceRoute)),
		sourceRoute: interceptState.sourceRoute
	};
}
async function resolveAppPageInterceptState(options) {
	if (!options.isRscRequest) return { kind: "none" };
	const intercept = options.findIntercept(options.cleanPathname);
	if (!intercept) return { kind: "none" };
	const loadState = intercept.__loadState;
	if (loadState?.page != null) intercept.page = loadState.page;
	if (intercept.__pageLoader && intercept.page == null) {
		const loading = loadState?.pageLoading ?? intercept.__pageLoader().then((page) => {
			intercept.page = page;
			if (loadState) {
				loadState.page = page;
				loadState.pageLoading = null;
			}
			return page;
		}).catch((error) => {
			if (loadState) loadState.pageLoading = null;
			throw error;
		});
		if (loadState) loadState.pageLoading = loading;
		await loading;
	}
	if (loadState?.notFound != null) intercept.notFound = loadState.notFound;
	if (intercept.__loadNotFound && intercept.notFound == null) {
		const loading = loadState?.notFoundLoading ?? intercept.__loadNotFound().then((notFound) => {
			intercept.notFound = notFound;
			if (loadState) {
				loadState.notFound = notFound;
				loadState.notFoundLoading = null;
			}
			return notFound;
		}).catch((error) => {
			if (loadState) loadState.notFoundLoading = null;
			throw error;
		});
		if (loadState) loadState.notFoundLoading = loading;
		await loading;
	}
	if (intercept.__loadInterceptLayouts) await loadAppInterceptLayouts(intercept);
	const sourceRoute = await options.getSourceRoute(intercept.sourceRouteIndex);
	if (!sourceRoute) return { kind: "none" };
	if (sourceRoute === options.currentRoute) return {
		kind: "current-route",
		intercept
	};
	return {
		kind: "source-route",
		intercept,
		sourceRoute
	};
}
async function resolveAppPageInterceptionRerenderTarget(options) {
	const interceptState = await resolveAppPageInterceptState({
		cleanPathname: options.cleanPathname,
		currentRoute: options.currentRoute,
		findIntercept: options.findIntercept,
		getRouteParamNames: options.getRouteParamNames,
		getSourceRoute: options.getSourceRoute,
		isRscRequest: options.isRscRequest,
		toInterceptOpts: options.toInterceptOpts
	});
	if (interceptState.kind === "source-route") {
		const sourceMatchedParams = interceptState.intercept.sourceMatchedParams ?? interceptState.intercept.matchedParams;
		return {
			interceptOpts: options.toInterceptOpts(interceptState.intercept),
			navigationParams: {
				...sourceMatchedParams,
				...interceptState.intercept.matchedParams
			},
			params: pickRouteParams(sourceMatchedParams, options.getRouteParamNames(interceptState.sourceRoute)),
			route: interceptState.sourceRoute
		};
	}
	return {
		interceptOpts: interceptState.kind === "current-route" ? options.toInterceptOpts(interceptState.intercept) : void 0,
		navigationParams: options.currentParams,
		params: options.currentParams,
		route: options.currentRoute
	};
}
function resolveAppPageActionRerenderTarget(options) {
	return resolveAppPageInterceptionRerenderTarget(options);
}
async function resolveAppPageIntercept(options) {
	const interceptState = await resolveAppPageInterceptState({
		cleanPathname: options.cleanPathname,
		currentRoute: options.currentRoute,
		findIntercept: options.findIntercept,
		getRouteParamNames: options.getRouteParamNames,
		getSourceRoute: options.getSourceRoute,
		isRscRequest: options.isRscRequest,
		toInterceptOpts: options.toInterceptOpts
	});
	if (interceptState.kind === "source-route") {
		const renderRoute = interceptState.sourceRoute;
		const interceptOpts = options.toInterceptOpts(interceptState.intercept);
		const sourceMatchedParams = interceptState.intercept.sourceMatchedParams ?? interceptState.intercept.matchedParams;
		const navigationParams = {
			...sourceMatchedParams,
			...interceptState.intercept.matchedParams
		};
		const renderSearchParams = options.resolveSearchParams ? await options.resolveSearchParams(renderRoute, options.searchParams) : options.searchParams;
		const renderParams = pickRouteParams(sourceMatchedParams, options.getRouteParamNames(interceptState.sourceRoute));
		options.setNavigationContext({
			params: options.resolveNavigationParams(renderRoute, navigationParams, options.cleanPathname, interceptOpts),
			pathname: options.cleanPathname,
			searchParams: renderSearchParams
		});
		const interceptElement = await options.buildPageElement(renderRoute, renderParams, interceptOpts, renderSearchParams, options.layoutParamAccess);
		return {
			interceptOpts: void 0,
			response: await options.renderInterceptResponse(renderRoute, interceptElement)
		};
	}
	return {
		interceptOpts: interceptState.kind === "current-route" ? options.toInterceptOpts(interceptState.intercept) : void 0,
		response: null
	};
}
async function buildAppPageElement(options) {
	try {
		return {
			element: await options.buildPageElement(),
			response: null
		};
	} catch (error) {
		const buildSpecialError = options.resolveSpecialError(error);
		const specialError = (buildSpecialError ? await options.probePageSpecialError?.() : null) ?? buildSpecialError;
		if (specialError) return {
			element: null,
			response: await options.renderSpecialError(specialError)
		};
		const errorBoundaryResponse = await options.renderErrorBoundaryPage(error);
		if (errorBoundaryResponse) return {
			element: null,
			response: errorBoundaryResponse
		};
		throw error;
	}
}
//#endregion
export { buildAppPageElement, resolveAppPageActionRerenderTarget, resolveAppPageGenerateStaticParamsSources, resolveAppPageIntercept, resolveAppPageInterceptMatch, resolveAppPageInterceptionRerenderTarget, validateAppPageDynamicParams };
