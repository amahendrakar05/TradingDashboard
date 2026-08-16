import { isUnknownRecord } from "../utils/record.js";
//#region src/client/navigation-runtime.ts
const NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION = "vinext.navigationRuntime";
const NAVIGATION_RUNTIME_KEY = Symbol.for(NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION);
const ROUTE_MANIFEST_SEGMENT_GRAPH_MAP_KEYS = [
	"boundaries",
	"defaults",
	"interceptions",
	"interceptionsBySlotId",
	"layouts",
	"pages",
	"rootBoundaries",
	"routeHandlers",
	"routes",
	"slotBindings",
	"slots",
	"templates"
];
function createNavigationRuntime() {
	return {
		bootstrap: {
			routeManifest: null,
			rsc: void 0
		},
		functions: {}
	};
}
function readRuntimeWindow() {
	if (typeof window === "undefined") return null;
	return window;
}
function isNavigationRuntimeFunctions(value) {
	if (!isUnknownRecord(value)) return false;
	return isOptionalRuntimeFunction(Reflect.get(value, "clearNavigationCaches")) && isOptionalRuntimeFunction(Reflect.get(value, "commitHashNavigation")) && isOptionalRuntimeFunction(Reflect.get(value, "navigateExternal")) && isOptionalRuntimeFunction(Reflect.get(value, "navigate")) && isOptionalRuntimeFunction(Reflect.get(value, "notifyLinkNavigationStart")) && isOptionalRuntimeFunction(Reflect.get(value, "pingVisibleLinks"));
}
function isNavigationRuntimeRscChunk(value) {
	if (typeof value === "string") return true;
	return Array.isArray(value) && value.length === 2 && value[0] === 3 && typeof value[1] === "string";
}
function isNavigationRuntimeSnapshot(value) {
	if (!isUnknownRecord(value)) return false;
	const pathname = Reflect.get(value, "pathname");
	const searchParams = Reflect.get(value, "searchParams");
	return typeof pathname === "string" && Array.isArray(searchParams) && searchParams.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string");
}
function isNavigationRuntimeParams(value) {
	if (!isUnknownRecord(value)) return false;
	return Object.values(value).every((entry) => typeof entry === "string" || Array.isArray(entry) && entry.every((part) => typeof part === "string"));
}
function isNavigationRuntimeRscBootstrap(value) {
	if (!isUnknownRecord(value)) return false;
	const done = Reflect.get(value, "done");
	const dynamicStaleTimeSeconds = Reflect.get(value, "dynamicStaleTimeSeconds");
	const initialCacheKind = Reflect.get(value, "initialCacheKind");
	const nav = Reflect.get(value, "nav");
	const params = Reflect.get(value, "params");
	const rsc = Reflect.get(value, "rsc");
	return (done === void 0 || typeof done === "boolean") && (dynamicStaleTimeSeconds === void 0 || typeof dynamicStaleTimeSeconds === "number" && Number.isFinite(dynamicStaleTimeSeconds) && dynamicStaleTimeSeconds >= 0) && (initialCacheKind === void 0 || initialCacheKind === "dynamic" || initialCacheKind === "static") && (nav === void 0 || isNavigationRuntimeSnapshot(nav)) && (params === void 0 || isNavigationRuntimeParams(params)) && Array.isArray(rsc) && rsc.every(isNavigationRuntimeRscChunk);
}
function isReadonlyStringArray(value) {
	return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isNullableString(value) {
	return value === null || typeof value === "string";
}
function isNavigationRuntimeInterception(value) {
	if (!isUnknownRecord(value)) return false;
	return typeof value.id === "string" && typeof value.sourcePattern === "string" && isReadonlyStringArray(value.sourcePatternParts) && typeof value.targetPattern === "string" && isReadonlyStringArray(value.targetPatternParts) && typeof value.slotId === "string" && isNullableString(value.ownerLayoutId) && isNullableString(value.interceptingRouteId) && isNullableString(value.targetRouteId);
}
function isNavigationRuntimeInterceptionArray(value) {
	return Array.isArray(value) && value.every(isNavigationRuntimeInterception);
}
function isNavigationRuntimeRouteManifest(value) {
	if (!isUnknownRecord(value)) return false;
	const graphVersion = Reflect.get(value, "graphVersion");
	const segmentGraph = Reflect.get(value, "segmentGraph");
	if (typeof graphVersion !== "string" || !isUnknownRecord(segmentGraph)) return false;
	const interceptions = Reflect.get(segmentGraph, "interceptions");
	const interceptionsBySlotId = Reflect.get(segmentGraph, "interceptionsBySlotId");
	if (!ROUTE_MANIFEST_SEGMENT_GRAPH_MAP_KEYS.every((key) => Reflect.get(segmentGraph, key) instanceof Map) || !(interceptions instanceof Map) || !(interceptionsBySlotId instanceof Map)) return false;
	for (const interception of interceptions.values()) if (!isNavigationRuntimeInterception(interception)) return false;
	for (const slotInterceptions of interceptionsBySlotId.values()) if (!isNavigationRuntimeInterceptionArray(slotInterceptions)) return false;
	return true;
}
function isNavigationRuntimeBootstrap(value) {
	if (!isUnknownRecord(value)) return false;
	const routeManifest = Reflect.get(value, "routeManifest");
	const rsc = Reflect.get(value, "rsc");
	return (routeManifest === null || isNavigationRuntimeRouteManifest(routeManifest)) && (rsc === void 0 || isNavigationRuntimeRscBootstrap(rsc));
}
function isNavigationRuntime(value) {
	if (!isUnknownRecord(value)) return false;
	if (!("bootstrap" in value) || !("functions" in value)) return false;
	const { bootstrap, functions } = value;
	return isNavigationRuntimeBootstrap(bootstrap) && isNavigationRuntimeFunctions(functions);
}
function isOptionalRuntimeFunction(value) {
	return value === void 0 || typeof value === "function";
}
function getNavigationRuntime() {
	const runtimeWindow = readRuntimeWindow();
	if (runtimeWindow === null) return null;
	const runtime = Reflect.get(runtimeWindow, NAVIGATION_RUNTIME_KEY);
	return isNavigationRuntime(runtime) ? runtime : null;
}
/**
* Returns the registered browser runtime, creating it when a window exists.
* Without a window, callers receive a detached runtime and must retain the
* returned reference themselves; server calls are intentionally not global.
*/
function ensureNavigationRuntime() {
	const runtimeWindow = readRuntimeWindow();
	if (runtimeWindow === null) return createNavigationRuntime();
	const existingRuntime = Reflect.get(runtimeWindow, NAVIGATION_RUNTIME_KEY);
	const runtime = isNavigationRuntime(existingRuntime) ? existingRuntime : createNavigationRuntime();
	Reflect.set(runtimeWindow, NAVIGATION_RUNTIME_KEY, runtime);
	return runtime;
}
function registerNavigationRuntimeBootstrap(bootstrap) {
	const runtime = ensureNavigationRuntime();
	runtime.bootstrap = {
		...runtime.bootstrap,
		...bootstrap
	};
	return runtime;
}
function registerNavigationRuntimeFunctions(functions) {
	const runtime = ensureNavigationRuntime();
	runtime.functions = {
		...runtime.functions,
		...functions
	};
	return runtime;
}
function ensureNavigationRuntimeRscBootstrap() {
	return ensureNavigationRuntimeRscBootstrapForRuntime(ensureNavigationRuntime());
}
function ensureNavigationRuntimeRscBootstrapForRuntime(runtime) {
	const rscBootstrap = runtime.bootstrap.rsc;
	if (rscBootstrap === void 0) {
		const nextRscBootstrap = { rsc: [] };
		runtime.bootstrap.rsc = nextRscBootstrap;
		return nextRscBootstrap;
	}
	return rscBootstrap;
}
function subscribeNavigationRuntimeRscChunk(chunk) {
	const runtime = ensureNavigationRuntime();
	ensureNavigationRuntimeRscBootstrapForRuntime(runtime).rsc.push(chunk);
	return runtime;
}
function hasAppNavigationRuntime() {
	return typeof getNavigationRuntime()?.functions.navigate === "function";
}
/**
* True when the App Router has installed its runtime bootstrap on `window`,
* which the inline runtime-metadata script does synchronously in `<head>`.
*
* This is a stronger early-life signal than `hasAppNavigationRuntime()` — the
* latter checks for the fully-wired `navigate` function and so returns false
* during the brief window between HTML parse and the bootstrap module
* finishing initialization. Code that needs to differentiate App Router from
* Pages Router *during hydration* (e.g. the Script shim deciding whether the
* server-side pre-head splice already emitted the inline beforeInteractive
* tag) should call this instead.
*/
function hasAppNavigationRuntimeBootstrap() {
	return getNavigationRuntime() !== null;
}
//#endregion
export { NAVIGATION_RUNTIME_KEY, NAVIGATION_RUNTIME_SYMBOL_DESCRIPTION, ensureNavigationRuntimeRscBootstrap, getNavigationRuntime, hasAppNavigationRuntime, hasAppNavigationRuntimeBootstrap, registerNavigationRuntimeBootstrap, registerNavigationRuntimeFunctions, subscribeNavigationRuntimeRscChunk };
