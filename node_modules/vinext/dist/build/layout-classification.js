import { classifyLayoutSegmentConfig } from "./report.js";
import { AppElementsWire } from "../server/app-elements-wire.js";
import "../server/app-elements.js";
import { createAppPageTreePath } from "../server/app-page-route-wiring.js";
//#region src/build/layout-classification.ts
/**
* Layout classification — determines whether each layout in an App Router
* route tree is static or dynamic via two complementary detection layers:
*
*   Layer 1: Segment config (`export const dynamic`, `export const revalidate`)
*   Layer 2: Module graph traversal (checks for transitive dynamic shim imports)
*
* Layer 3 (probe-based runtime detection) is handled separately in
* `app-page-execution.ts` at request time.
*
* Every result is carried as a `LayoutBuildClassification` tagged variant so
* operators can trace which layer produced a decision via the structured
* `ClassificationReason` sidecar without that metadata leaking onto the wire.
*/
/**
* BFS traversal of a layout's dependency tree. If any transitive import
* resolves to a dynamic shim path (headers, cache, server), the layout
* cannot be proven static at build time and needs a runtime probe.
*
* The returned object carries the classification plus the first matching
* shim module ID (when any). Operators use the shim ID via the debug
* channel to trace why a layout was flagged for probing.
*/
function classifyLayoutByModuleGraph(layoutModuleId, dynamicShimPaths, moduleInfo) {
	const visited = /* @__PURE__ */ new Set();
	const queue = [layoutModuleId];
	let head = 0;
	while (head < queue.length) {
		const currentId = queue[head++];
		if (visited.has(currentId)) continue;
		visited.add(currentId);
		if (dynamicShimPaths.has(currentId)) return {
			result: "needs-probe",
			firstShimMatch: currentId
		};
		const info = moduleInfo.getModuleInfo(currentId);
		if (!info) continue;
		for (const importedId of info.importedIds) if (!visited.has(importedId)) queue.push(importedId);
		for (const dynamicId of info.dynamicImportedIds) if (!visited.has(dynamicId)) queue.push(dynamicId);
	}
	return { result: "static" };
}
function moduleGraphReason(graphResult) {
	if (graphResult.firstShimMatch === void 0) return {
		layer: "module-graph",
		result: graphResult.result
	};
	return {
		layer: "module-graph",
		result: graphResult.result,
		firstShimMatch: graphResult.firstShimMatch
	};
}
function isStaticModuleGraphResult(graphResult) {
	return graphResult.result === "static";
}
/**
* Classifies all layouts across all routes using a two-layer strategy:
*
* 1. Segment config (Layer 1) — short-circuits to "static" or "dynamic"
* 2. Module graph (Layer 2) — BFS for dynamic shim imports → "static" or "needs-probe"
*
* Shared layouts (same file appearing in multiple routes) are classified once
* and deduplicated by layout ID.
*
* @internal Not called by production code. The `renderChunk` hook in
* `index.ts` calls `classifyLayoutByModuleGraph` directly and composes
* via the numeric-index manifest in `route-classification-manifest.ts`.
* Used only by `tests/layout-classification.test.ts`.
*/
function classifyAllRouteLayouts(routes, dynamicShimPaths, moduleInfo) {
	const result = /* @__PURE__ */ new Map();
	for (const route of routes) for (const layout of route.layouts) {
		const layoutId = AppElementsWire.encodeLayoutId(createAppPageTreePath(route.routeSegments, layout.treePosition));
		if (result.has(layoutId)) continue;
		if (layout.segmentConfig) {
			const configResult = classifyLayoutSegmentConfig(layout.segmentConfig.code);
			if (configResult.kind !== "absent") {
				result.set(layoutId, configResult);
				continue;
			}
		}
		const graphResult = classifyLayoutByModuleGraph(layout.moduleId, dynamicShimPaths, moduleInfo);
		const reason = moduleGraphReason(graphResult);
		result.set(layoutId, {
			kind: graphResult.result,
			reason
		});
	}
	return result;
}
//#endregion
export { classifyAllRouteLayouts, classifyLayoutByModuleGraph, isStaticModuleGraphResult, moduleGraphReason };
