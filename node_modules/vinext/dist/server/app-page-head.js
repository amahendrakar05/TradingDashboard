import { runWithFetchDedupe } from "../shims/fetch-cache.js";
import { mergeMetadataEntries, mergeViewport, postProcessMetadata, resolveModuleMetadata as resolveModuleMetadata$1, resolveModuleViewport } from "../shims/metadata.js";
import { resolveAppPageBranchParams, resolveAppPageSegmentParams } from "./app-page-params.js";
import { tagAppPageMetadataError } from "./app-page-execution.js";
//#region src/server/app-page-head.ts
/**
* Wrapped {@link _resolveModuleMetadata} that tags any thrown error with the
* `APP_PAGE_METADATA_ERROR_MARKER` symbol. The marker lets downstream special-
* error handling distinguish a `generateMetadata()` redirect/notFound from a
* page-component redirect/notFound, which matters because metadata is
* suspended/streamed in Next.js. Its redirects no longer become a plain
* HTTP 307: RSC navigation rides inside the flight payload (200), streaming
* document SSR gets an HTML refresh meta tag (200), and html-limited bots
* get a blocking 307 — whereas page redirects still emit a 307 for SSR.
* See https://github.com/cloudflare/vinext/issues/1347
* and Next.js test/e2e/app-dir/metadata-streaming.
*/
async function resolveModuleMetadata(...args) {
	try {
		return await resolveModuleMetadata$1(...args);
	} catch (error) {
		throw tagAppPageMetadataError(error);
	}
}
function resolveActiveParallelRouteHeadInputs(options) {
	return Object.entries(options.slots ?? {}).map(([slotKey, slot]) => {
		const ownerTreePosition = options.layoutTreePositions?.[slot.layoutIndex ?? 0] ?? 0;
		const ownerParams = resolveAppPageSegmentParams(options.routeSegments, ownerTreePosition, options.params);
		const slotParams = options.slotParams?.[slotKey] ?? options.params;
		const notFoundParams = slot.notFound ? {
			...ownerParams,
			...resolveParallelLayoutParams(slot.routeSegments ?? options.routeSegments, slot.notFoundTreePosition ?? 0, slotParams)
		} : null;
		if (options.interceptSlotKey === slotKey && options.interceptPage) {
			const interceptLayouts = options.interceptLayouts ?? [];
			const inheritedSlotNotFound = slot.notFoundTreePosition === 0 ? slot.notFound ?? null : null;
			const interceptNotFound = options.interceptNotFound ?? inheritedSlotNotFound;
			const interceptNotFoundParams = interceptNotFound ? {
				...ownerParams,
				...resolveParallelLayoutParams(options.interceptNotFoundBranchSegments ?? options.interceptBranchSegments ?? options.routeSegments, options.interceptNotFound ? options.interceptNotFoundTreePosition ?? 0 : slot.notFoundTreePosition ?? 0, options.interceptParams ?? options.params)
			} : null;
			return {
				head: {
					layoutModules: [slot.layout, ...interceptLayouts].filter(isPresent),
					layoutParams: [...slot.layout ? [ownerParams] : [], ...interceptLayouts.filter(isPresent).map((_, index) => {
						const segments = options.interceptLayoutSegments?.[index] ?? [];
						return {
							...ownerParams,
							...resolveParallelLayoutParams(options.interceptBranchSegments ?? segments, segments.length, options.interceptParams ?? options.params)
						};
					})],
					layoutTreePositions: [...slot.layout ? [0] : [], ...interceptLayouts.filter(isPresent).map(() => options.routeSegments.length)],
					pageModule: options.interceptPage,
					params: options.interceptParams ?? options.params,
					routeSegments: options.interceptSourcePageSegments ?? options.routeSegments
				},
				...interceptNotFound ? {
					notFoundModule: interceptNotFound,
					notFoundParams: interceptNotFoundParams
				} : {},
				ownerTreePosition
			};
		}
		return {
			head: {
				layoutModules: [slot.layout, ...slot.configLayouts ?? []].filter(isPresent),
				layoutParams: [...slot.layout ? [ownerParams] : [], ...(slot.configLayoutTreePositions ?? []).map((treePosition) => ({
					...ownerParams,
					...resolveParallelLayoutParams(slot.routeSegments ?? options.routeSegments, treePosition, options.slotParams?.[slotKey] ?? options.params)
				}))],
				layoutTreePositions: [...slot.layout ? [0] : [], ...slot.configLayoutTreePositions ?? []],
				pageModule: slot.page,
				params: slotParams,
				routeSegments: slot.routeSegments ?? options.routeSegments
			},
			...slot.notFound ? {
				notFoundModule: slot.notFound,
				notFoundParams
			} : {},
			ownerTreePosition
		};
	});
}
function isPresent(value) {
	return value !== null && value !== void 0;
}
function resolveParallelLayoutParams(routeSegments, treePosition, params) {
	return resolveAppPageBranchParams(routeSegments, treePosition, params);
}
function hasGenerateMetadata(module) {
	return typeof module?.generateMetadata === "function";
}
function collectAppPageSearchParams(searchParams) {
	const pageSearchParams = Object.create(null);
	let hasSearchParams = false;
	searchParams?.forEach((value, key) => {
		hasSearchParams = true;
		const currentValue = pageSearchParams[key];
		if (Array.isArray(currentValue)) {
			pageSearchParams[key] = [...currentValue, value];
			return;
		}
		if (currentValue !== void 0) {
			pageSearchParams[key] = [currentValue, value];
			return;
		}
		pageSearchParams[key] = value;
	});
	return {
		hasSearchParams,
		pageSearchParams
	};
}
function createMetadataSources(metadataResults, routeSegments, layoutTreePositions, pageMetadata, includePageSource) {
	const metadataSources = metadataResults.map((metadata, index) => ({
		routeSegments: routeSegments.slice(0, layoutTreePositions[index] ?? 0),
		metadata
	}));
	if (includePageSource) metadataSources.push({
		routeSegments,
		metadata: pageMetadata
	});
	return metadataSources;
}
async function finalizeAppPageMetadata(metadata, metadataSources, options) {
	let resolvedMetadata = metadata;
	if (options.applyFileBasedMetadata && options.metadataRoutes.length > 0) try {
		resolvedMetadata = await options.applyFileBasedMetadata(metadata, options.routePath, options.params, options.metadataRoutes, {
			routeSegments: options.routeSegments ?? [],
			metadataSources,
			basePath: options.basePath ?? ""
		});
	} catch (error) {
		if (!options.fallbackOnFileMetadataError) throw error;
		console.error(`[vinext] File-based metadata resolution failed while rendering error boundary for ${options.routePath}:`, error);
	}
	return resolvedMetadata ? postProcessMetadata(resolvedMetadata) : null;
}
function createLayoutInputs(layoutModules, layoutTreePositions) {
	const layoutInputs = [];
	for (let index = 0; index < layoutModules.length; index++) {
		const layoutModule = layoutModules[index];
		if (!isPresent(layoutModule)) continue;
		layoutInputs.push({
			module: layoutModule,
			treePosition: layoutTreePositions[index] ?? 0
		});
	}
	return layoutInputs;
}
async function resolveLayoutMetadata(layoutInputs, params, routeSegments) {
	const layoutMetadataPromises = [];
	let accumulatedMetadata = Promise.resolve({});
	for (const layoutInput of layoutInputs) {
		const parentForLayout = accumulatedMetadata;
		const layoutParams = resolveAppPageSegmentParams(routeSegments, layoutInput.treePosition, params);
		const metadataPromise = resolveModuleMetadata(layoutInput.module, layoutParams, void 0, parentForLayout);
		layoutMetadataPromises.push(metadataPromise);
		metadataPromise.catch(() => null);
		accumulatedMetadata = metadataPromise.then(async (metadataResult) => {
			if (metadataResult) return mergeMetadataEntries([{ metadata: await parentForLayout }, { metadata: metadataResult }]);
			return parentForLayout;
		});
		accumulatedMetadata.catch(() => null);
	}
	return Promise.all(layoutMetadataPromises);
}
async function resolveLayoutViewport(layoutInputs, params, routeSegments) {
	return Promise.all(layoutInputs.map((layoutInput) => {
		const layoutParams = resolveAppPageSegmentParams(routeSegments, layoutInput.treePosition, params);
		return resolveModuleViewport(layoutInput.module, layoutParams);
	}));
}
function getParallelRouteModules(parallelRoute) {
	return [...parallelRoute.layoutModules ?? [], parallelRoute.layoutModule].filter(isPresent);
}
function parallelRouteHasDynamicMetadata(parallelRoute) {
	return getParallelRouteModules(parallelRoute).some(hasGenerateMetadata) || hasGenerateMetadata(parallelRoute.pageModule);
}
async function resolveParallelRouteMetadata(parallelRoute, fallbackParams, fallbackRouteSegments, pageSearchParams, parent, searchParamsObserver) {
	const params = parallelRoute.params ?? fallbackParams;
	const routeSegments = parallelRoute.routeSegments ?? fallbackRouteSegments;
	const metadataResults = [];
	const metadataSources = [];
	let accumulatedMetadata = parent;
	const layoutModules = getParallelRouteModules(parallelRoute);
	const layoutTreePositions = parallelRoute.layoutTreePositions ?? [];
	const layoutParams = parallelRoute.layoutParams ?? [];
	for (const [index, layoutModule] of layoutModules.entries()) {
		const layoutMetadata = await resolveModuleMetadata(layoutModule, layoutParams[index] ?? resolveParallelLayoutParams(routeSegments, layoutTreePositions[index] ?? 0, params), void 0, accumulatedMetadata);
		metadataResults.push(layoutMetadata);
		metadataSources.push({
			metadata: layoutMetadata,
			routeSegments
		});
		if (layoutMetadata) {
			accumulatedMetadata = accumulatedMetadata.then(async (parentMetadata) => mergeMetadataEntries([{ metadata: parentMetadata }, { metadata: layoutMetadata }]));
			accumulatedMetadata.catch(() => null);
		}
	}
	if (parallelRoute.pageModule) {
		const pageMetadata = await resolveModuleMetadata(parallelRoute.pageModule, params, pageSearchParams, accumulatedMetadata, searchParamsObserver);
		metadataResults.push(pageMetadata);
		metadataSources.push({
			metadata: pageMetadata,
			routeSegments
		});
	}
	return {
		metadataResults,
		metadataSources
	};
}
async function resolveParallelRouteViewport(parallelRoute, fallbackParams, fallbackRouteSegments, pageSearchParams, searchParamsObserver) {
	const params = parallelRoute.params ?? fallbackParams;
	const routeSegments = parallelRoute.routeSegments ?? fallbackRouteSegments;
	const layoutModules = getParallelRouteModules(parallelRoute);
	const layoutTreePositions = parallelRoute.layoutTreePositions ?? [];
	const layoutParams = parallelRoute.layoutParams ?? [];
	const layoutViewportPromise = Promise.all(layoutModules.map((layoutModule, index) => resolveModuleViewport(layoutModule, layoutParams[index] ?? resolveParallelLayoutParams(routeSegments, layoutTreePositions[index] ?? 0, params))));
	const pageViewportPromise = parallelRoute.pageModule ? resolveModuleViewport(parallelRoute.pageModule, params, pageSearchParams, searchParamsObserver) : Promise.resolve(null);
	const [layoutViewports, pageViewport] = await Promise.all([layoutViewportPromise, pageViewportPromise]);
	return parallelRoute.pageModule ? [...layoutViewports, pageViewport] : layoutViewports;
}
/**
* Resolve an explicit metadata-source sequence.
*
* Route-specific conventions own source selection and ordering. This resolver
* only supplies each source with its accumulated parent, merges the results,
* and applies file-based metadata at the end.
*/
function resolveOrderedAppPageMetadata(options) {
	return runWithFetchDedupe(async () => {
		const metadataPromises = [];
		let accumulatedEntriesPromise = Promise.resolve([]);
		for (const source of options.sources) {
			const parentPromise = accumulatedEntriesPromise.then((entries) => entries.length > 0 ? mergeMetadataEntries(entries) : {});
			const metadataPromise = resolveModuleMetadata(source.module, source.params, source.searchParams, parentPromise, source.searchParamsObserver);
			metadataPromises.push(metadataPromise);
			metadataPromise.catch(() => null);
			accumulatedEntriesPromise = Promise.all([accumulatedEntriesPromise, metadataPromise]).then(([entries, metadata]) => metadata ? [...entries, { metadata }] : entries);
			accumulatedEntriesPromise.catch(() => null);
		}
		const [metadataEntries, metadataResults] = await Promise.all([accumulatedEntriesPromise, Promise.all(metadataPromises)]);
		const metadataSources = options.sources.flatMap((source, index) => {
			const metadata = metadataResults[index] ?? null;
			return metadata || source.includeWhenEmpty ? [{
				metadata,
				routeSegments: source.routeSegments
			}] : [];
		});
		return finalizeAppPageMetadata(metadataEntries.length > 0 ? mergeMetadataEntries(metadataEntries) : null, metadataSources, options);
	});
}
async function resolveAppPageHead(options) {
	const prepared = prepareAppPageHead(options);
	const [metadata, viewport] = await Promise.all([prepared.metadata, prepared.viewport]);
	return {
		...prepared,
		metadata,
		viewport
	};
}
/**
* Start metadata and viewport resolution without coupling their completion.
*
* Live document renders can place the metadata promise behind Suspense while
* still waiting for viewport tags before the shell is emitted. Blocking
* callers use {@link resolveAppPageHead} and observe the same result as before.
*/
function prepareAppPageHead(options) {
	return runWithFetchDedupe(() => prepareAppPageHeadInner(options));
}
function prepareAppPageHeadInner(options) {
	const routeSegments = options.routeSegments ?? [];
	const layoutTreePositions = options.layoutTreePositions ?? [];
	const layoutInputs = createLayoutInputs(options.layoutModules, layoutTreePositions);
	const layoutSourcePositions = layoutInputs.map((input) => input.treePosition);
	const primaryHasDynamicMetadata = layoutInputs.some((input) => hasGenerateMetadata(input.module)) || hasGenerateMetadata(options.pageModule);
	const { hasSearchParams, pageSearchParams } = collectAppPageSearchParams(options.searchParams);
	const layoutMetadataPromise = resolveLayoutMetadata(layoutInputs, options.params, routeSegments);
	const layoutViewportPromise = resolveLayoutViewport(layoutInputs, options.params, routeSegments);
	const layoutMetadataResultsForParent = layoutMetadataPromise.then((metadataResults) => metadataResults.filter(isPresent));
	layoutMetadataResultsForParent.catch(() => null);
	const pageParentPromise = layoutMetadataResultsForParent.then((metadataResults) => metadataResults.length > 0 ? mergeMetadataEntries(metadataResults.map((metadata) => ({ metadata }))) : {});
	pageParentPromise.catch(() => null);
	const pageMetadataPromise = options.pageModule ? resolveModuleMetadata(options.pageModule, options.params, pageSearchParams, pageParentPromise, options.searchParamsObserver) : Promise.resolve(null);
	const pageViewportPromise = options.pageModule ? resolveModuleViewport(options.pageModule, options.params, pageSearchParams, options.searchParamsObserver) : Promise.resolve(null);
	const parallelRoutes = options.parallelRoutes ?? [];
	const parallelRouteMetadataPromise = Promise.all(parallelRoutes.map((parallelRoute) => resolveParallelRouteMetadata(parallelRoute, options.params, routeSegments, pageSearchParams, pageParentPromise, options.searchParamsObserver)));
	const parallelRouteViewportPromise = Promise.all(parallelRoutes.map((parallelRoute) => resolveParallelRouteViewport(parallelRoute, options.params, routeSegments, pageSearchParams, options.searchParamsObserver)));
	const hasDynamicMetadata = primaryHasDynamicMetadata || parallelRoutes.some(parallelRouteHasDynamicMetadata);
	const metadata = Promise.all([
		layoutMetadataPromise,
		pageMetadataPromise,
		parallelRouteMetadataPromise
	]).then(async ([layoutMetadataResults, pageMetadata, parallelRouteMetadata]) => {
		const parallelMetadataResults = parallelRouteMetadata.flatMap((head) => head.metadataResults);
		const parallelMetadataSources = parallelRouteMetadata.flatMap((head) => head.metadataSources);
		const primaryPageHasTitle = pageMetadata != null && pageMetadata.title !== void 0;
		const metadataEntries = [
			...layoutMetadataResults.filter(isPresent).map((entry) => ({ metadata: entry })),
			...pageMetadata ? [{
				isPage: true,
				metadata: pageMetadata
			}] : [],
			...parallelMetadataResults.filter(isPresent).map((entry) => ({
				contributesTitle: !primaryPageHasTitle,
				metadata: entry
			}))
		];
		const resolvedMetadataBase = metadataEntries.length > 0 ? mergeMetadataEntries(metadataEntries) : null;
		const metadataSources = createMetadataSources(layoutMetadataResults, routeSegments, layoutSourcePositions, pageMetadata, Boolean(options.pageModule));
		metadataSources.push(...parallelMetadataSources);
		return finalizeAppPageMetadata(resolvedMetadataBase, metadataSources, options);
	});
	const viewport = Promise.all([
		layoutViewportPromise,
		pageViewportPromise,
		parallelRouteViewportPromise
	]).then(([layoutViewportResults, pageViewport, parallelRouteViewports]) => mergeViewport([
		...layoutViewportResults.filter(isPresent),
		...pageViewport ? [pageViewport] : [],
		...parallelRouteViewports.flat().filter(isPresent)
	]));
	metadata.catch(() => null);
	viewport.catch(() => null);
	return {
		hasDynamicMetadata,
		hasSearchParams,
		metadata,
		pageSearchParams,
		viewport
	};
}
//#endregion
export { collectAppPageSearchParams, prepareAppPageHead, resolveActiveParallelRouteHeadInputs, resolveAppPageHead, resolveOrderedAppPageMetadata };
