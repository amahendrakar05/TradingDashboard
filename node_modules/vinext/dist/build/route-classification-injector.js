import { buildClassificationReplacement, buildReasonsReplacement } from "./route-classification-manifest.js";
import { classifyLayoutByModuleGraph, isStaticModuleGraphResult, moduleGraphReason } from "./layout-classification.js";
//#region src/build/route-classification-injector.ts
const CLASS_STUB_RE = /function __VINEXT_CLASS\(routeIdx\)\s*\{\s*return null;?\s*\}/;
const REASONS_STUB_RE = /function __VINEXT_CLASS_REASONS\(routeIdx\)\s*\{\s*return null;?\s*\}/;
function identityPath(path) {
	return path;
}
function findClassificationChunk(chunks) {
	const chunksMentioningStub = chunks.filter((chunk) => chunk.code.includes("__VINEXT_CLASS"));
	const chunksWithStubBody = chunksMentioningStub.filter((chunk) => CLASS_STUB_RE.test(chunk.code));
	const chunkWithStubBody = chunksWithStubBody[0];
	if (chunksMentioningStub.length === 0) return null;
	if (chunkWithStubBody === void 0) throw new Error(`vinext: build-time classification — __VINEXT_CLASS is referenced in ${chunksMentioningStub.map((chunk) => chunk.fileName).join(", ")} but no chunk contains the stub body. The generator and the classification injector have drifted.`);
	if (chunksWithStubBody.length > 1) throw new Error(`vinext: build-time classification — expected __VINEXT_CLASS stub in exactly one RSC chunk, found ${chunksWithStubBody.length}`);
	return chunkWithStubBody;
}
function buildLayer2Classifications(options) {
	const canonicalizeLayoutPath = options.canonicalizeLayoutPath ?? identityPath;
	const layer2PerRoute = /* @__PURE__ */ new Map();
	const graphCache = /* @__PURE__ */ new Map();
	for (let routeIdx = 0; routeIdx < options.manifest.routes.length; routeIdx++) {
		const route = options.manifest.routes[routeIdx];
		const perRoute = /* @__PURE__ */ new Map();
		for (let layoutIdx = 0; layoutIdx < route.layoutPaths.length; layoutIdx++) {
			if (route.layer1.has(layoutIdx)) continue;
			const layoutModuleId = canonicalizeLayoutPath(route.layoutPaths[layoutIdx]);
			if (!options.moduleInfo.getModuleInfo(layoutModuleId)) continue;
			let graphResult = graphCache.get(layoutModuleId);
			if (graphResult === void 0) {
				graphResult = classifyLayoutByModuleGraph(layoutModuleId, options.dynamicShimPaths, options.moduleInfo);
				graphCache.set(layoutModuleId, graphResult);
			}
			if (isStaticModuleGraphResult(graphResult)) perRoute.set(layoutIdx, moduleGraphReason(graphResult));
		}
		if (perRoute.size > 0) layer2PerRoute.set(routeIdx, perRoute);
	}
	return layer2PerRoute;
}
function planRouteClassificationInjection(options) {
	const target = findClassificationChunk(options.chunks);
	if (!target) return { kind: "skip" };
	if (options.enableDebugReasons && !REASONS_STUB_RE.test(target.code)) throw new Error("vinext: build-time classification — __VINEXT_CLASS_REASONS stub is missing alongside __VINEXT_CLASS. The generator and the classification injector have drifted.");
	const layer2PerRoute = buildLayer2Classifications(options);
	const patchedBody = `function __VINEXT_CLASS(routeIdx) { return (${buildClassificationReplacement(options.manifest, layer2PerRoute)})(routeIdx); }`;
	let code = target.code.replace(CLASS_STUB_RE, patchedBody);
	if (options.enableDebugReasons) {
		const patchedReasonsBody = `function __VINEXT_CLASS_REASONS(routeIdx) { return (${buildReasonsReplacement(options.manifest, layer2PerRoute)})(routeIdx); }`;
		code = code.replace(REASONS_STUB_RE, patchedReasonsBody);
	}
	return {
		code,
		fileName: target.fileName,
		kind: "patch",
		map: null
	};
}
//#endregion
export { planRouteClassificationInjection };
