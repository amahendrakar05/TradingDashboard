//#region src/server/app-page-params.ts
function getAppPageSegmentParamName(segment) {
	if (segment.startsWith("[[...") && segment.endsWith("]]") && segment.length > 7) return segment.slice(5, -2);
	if (segment.startsWith("[...") && segment.endsWith("]") && segment.length > 5) return segment.slice(4, -1);
	if (segment.startsWith("[") && segment.endsWith("]") && !segment.includes(".") && segment.length > 2) return segment.slice(1, -1);
	return null;
}
function isEmptyOptionalCatchAll(segment, paramValue) {
	return segment.startsWith("[[...") && Array.isArray(paramValue) && paramValue.length === 0;
}
function resolveAppPageSegmentParamScopeKeys(routeSegments, treePosition) {
	const paramNames = [];
	const seen = /* @__PURE__ */ new Set();
	const segments = routeSegments ?? [];
	const end = Math.min(Math.max(treePosition, 0), segments.length);
	for (let index = 0; index < end; index++) {
		const paramName = getAppPageSegmentParamName(segments[index]);
		if (!paramName || seen.has(paramName)) continue;
		seen.add(paramName);
		paramNames.push(paramName);
	}
	return paramNames;
}
function resolveAppPageSegmentParams(routeSegments, treePosition, matchedParams) {
	const segmentParams = {};
	const segments = routeSegments ?? [];
	const end = Math.min(Math.max(treePosition, 0), segments.length);
	for (let index = 0; index < end; index++) {
		const segment = segments[index];
		const paramName = getAppPageSegmentParamName(segment);
		if (!paramName) continue;
		const paramValue = matchedParams[paramName];
		if (paramValue === void 0 || isEmptyOptionalCatchAll(segment, paramValue)) continue;
		segmentParams[paramName] = paramValue;
	}
	return segmentParams;
}
function resolveAppPageBranchParams(branchSegments, treePosition, matchedParams, scopedSegments = branchSegments) {
	const branchParamNames = new Set(branchSegments.map(getAppPageSegmentParamName).filter((name) => name !== null));
	const scopedParams = {};
	for (const [name, value] of Object.entries(matchedParams)) if (!branchParamNames.has(name)) scopedParams[name] = value;
	Object.assign(scopedParams, resolveAppPageSegmentParams(scopedSegments, treePosition, matchedParams));
	return scopedParams;
}
//#endregion
export { getAppPageSegmentParamName, resolveAppPageBranchParams, resolveAppPageSegmentParamScopeKeys, resolveAppPageSegmentParams };
