import { mergeViewport, resolveModuleViewport } from "../shims/metadata.js";
import { resolveAppPageBranchParams, resolveAppPageSegmentParams } from "./app-page-params.js";
import { resolveOrderedAppPageMetadata } from "./app-page-head.js";
//#region src/server/app-page-http-access-fallback-metadata.ts
function isPresent(value) {
	return value !== null && value !== void 0;
}
/**
* Translate HTTP-access boundary semantics into the exact metadata source
* order used by Next.js's loader-tree walk.
*
* The not-found convention is appended at every active leaf. A sibling
* intercept is the primary leaf and therefore precedes the ordinary slot
* branches; otherwise the convention also represents the primary page leaf.
*/
function createHttpAccessFallbackPlan(options, fallbackLeafMode) {
	const routeSegments = options.routeSegments ?? [];
	const plan = [];
	for (const [index, layoutModule] of options.layoutModules.entries()) {
		if (!isPresent(layoutModule)) continue;
		const treePosition = options.layoutTreePositions?.[index] ?? 0;
		plan.push({
			kind: "source",
			source: {
				includeWhenEmpty: true,
				module: layoutModule,
				params: resolveAppPageSegmentParams(routeSegments, treePosition, options.params),
				routeSegments: routeSegments.slice(0, treePosition)
			}
		});
	}
	let activeBoundaryModule = options.boundaryModule;
	let activeBoundaryParams = options.boundaryParams;
	let activeBoundaryRouteSegments = routeSegments;
	const appendFallbackLeaf = () => {
		if (fallbackLeafMode === "final") {
			plan.push({ kind: "fallback-leaf" });
			return;
		}
		if (!activeBoundaryModule) return;
		plan.push({
			kind: "source",
			source: {
				includeWhenEmpty: true,
				module: activeBoundaryModule,
				params: activeBoundaryParams,
				routeSegments: activeBoundaryRouteSegments
			}
		});
	};
	if (!options.primaryParallelBranch) appendFallbackLeaf();
	const parallelBranches = [...options.primaryParallelBranch ? [options.primaryParallelBranch] : [], ...[...options.parallelBranches ?? []].sort((left, right) => right.ownerTreePosition - left.ownerTreePosition)];
	for (const branch of parallelBranches) {
		const parallelRoute = branch.head;
		const parallelParams = parallelRoute.params ?? options.params;
		const parallelRouteSegments = parallelRoute.routeSegments ?? routeSegments;
		const layoutModules = [...parallelRoute.layoutModules ?? [], parallelRoute.layoutModule].filter(isPresent);
		const layoutTreePositions = parallelRoute.layoutTreePositions ?? [];
		const layoutParams = parallelRoute.layoutParams ?? [];
		for (const [index, layoutModule] of layoutModules.entries()) plan.push({
			kind: "source",
			source: {
				includeWhenEmpty: true,
				module: layoutModule,
				params: layoutParams[index] ?? resolveAppPageBranchParams(parallelRouteSegments, layoutTreePositions[index] ?? 0, parallelParams),
				routeSegments: parallelRouteSegments
			}
		});
		if (options.branchNotFoundConventions !== false && branch.notFoundModule) {
			activeBoundaryModule = branch.notFoundModule;
			activeBoundaryParams = branch.notFoundParams ?? parallelParams;
			activeBoundaryRouteSegments = parallelRouteSegments;
		}
		appendFallbackLeaf();
	}
	return plan.flatMap((item) => {
		if (item.kind === "source") return [item.source];
		if (!activeBoundaryModule) return [];
		return [{
			includeWhenEmpty: true,
			module: activeBoundaryModule,
			params: activeBoundaryParams,
			routeSegments: activeBoundaryRouteSegments
		}];
	});
}
function createHttpAccessFallbackMetadataPlan(options) {
	return createHttpAccessFallbackPlan(options, "final");
}
function resolveHttpAccessFallbackMetadata(options) {
	return resolveOrderedAppPageMetadata({
		applyFileBasedMetadata: options.applyFileBasedMetadata,
		basePath: options.basePath,
		fallbackOnFileMetadataError: options.fallbackOnFileMetadataError,
		metadataRoutes: options.metadataRoutes,
		params: options.params,
		routePath: options.routePath,
		routeSegments: options.routeSegments,
		sources: createHttpAccessFallbackMetadataPlan(options)
	});
}
async function resolveHttpAccessFallbackViewport(options) {
	return mergeViewport((await Promise.all(createHttpAccessFallbackPlan(options, "snapshot").map((source) => resolveModuleViewport(source.module, source.params)))).filter(isPresent));
}
//#endregion
export { createHttpAccessFallbackMetadataPlan, resolveHttpAccessFallbackMetadata, resolveHttpAccessFallbackViewport };
