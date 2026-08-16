import { NEXTJS_DEPLOYMENT_ID_HEADER } from "./headers.js";
import { getDeploymentId } from "../utils/deployment-id.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader } from "./app-rsc-cache-busting.js";
//#region src/server/app-route-tree-prefetch.ts
const PARENT_INLINED_INTO_SELF = 32;
const INLINED_INTO_CHILD = 64;
const HEAD_INLINED_INTO_SELF = 128;
const PAGE_SEGMENT = "__PAGE__";
const SLOT_SEGMENT = "(__SLOT__)";
const SEGMENT_INLINE_SIZE = 1;
const SEGMENT_OUTLINE_SIZE = 4096;
const DEFAULT_SEGMENT_INLINE_THRESHOLD = 2048;
const HEAD_INLINE_SIZE = 1;
const DEFAULT_MAX_INLINE_BUNDLE_SIZE = 10240;
const NEXT_DID_POSTPONE_HEADER = "x-nextjs-postponed";
function isRouteTreePrefetchRequest(request) {
	return request.headers.get("RSC") === "1" && request.headers.get("Next-Router-Prefetch") === "1" && request.headers.get("Next-Router-Segment-Prefetch") === "/_tree";
}
function createNode(segment, module) {
	const { name, param } = routeTreeSegment(segment);
	return {
		name,
		param,
		prefetchSize: estimatePrefetchSize(module) ?? ((module === null || module === void 0) && segment !== PAGE_SEGMENT ? SEGMENT_INLINE_SIZE : null),
		prefetchHints: 0,
		slots: null
	};
}
function ensureSlots(node) {
	if (node.slots === null) node.slots = {};
	return node.slots;
}
function addChild(node, key, child) {
	ensureSlots(node)[key] = child;
}
function routeTreeSegment(segment) {
	if (segment.startsWith(":")) {
		const rest = segment.slice(1);
		if (rest.endsWith("+")) return dynamicRouteTreeSegment(rest.slice(0, -1), "c");
		if (rest.endsWith("*")) return dynamicRouteTreeSegment(rest.slice(0, -1), "oc");
		return dynamicRouteTreeSegment(rest, "d");
	}
	if (segment.startsWith("[[...") && segment.endsWith("]]")) return dynamicRouteTreeSegment(segment.slice(5, -2), "oc");
	if (segment.startsWith("[...") && segment.endsWith("]")) return dynamicRouteTreeSegment(segment.slice(4, -1), "c");
	if (segment.startsWith("[") && segment.endsWith("]")) return dynamicRouteTreeSegment(segment.slice(1, -1), "d");
	return {
		name: segment,
		param: null
	};
}
function dynamicRouteTreeSegment(name, type) {
	return {
		name,
		param: {
			key: null,
			siblings: null,
			type
		}
	};
}
function explicitPrefetchSize(module) {
	if (typeof module !== "object" || module === null) return null;
	const value = module.prefetchSize;
	if (value === "large") return SEGMENT_OUTLINE_SIZE;
	if (value === "small") return SEGMENT_INLINE_SIZE;
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function estimatePrefetchSize(module) {
	const explicitSize = explicitPrefetchSize(module);
	if (explicitSize !== null) return explicitSize;
	if (typeof module !== "object" || module === null) return null;
	return typeof module.default === "function" ? SEGMENT_INLINE_SIZE : null;
}
function layoutModuleByTreePosition(route) {
	const layouts = route.layouts ?? [];
	const positions = route.layoutTreePositions ?? [];
	const byPosition = /* @__PURE__ */ new Map();
	for (const [index, position] of positions.entries()) byPosition.set(position, layouts[index]);
	return byPosition;
}
function modulesByTreePosition(modules, positions) {
	const byPosition = /* @__PURE__ */ new Map();
	for (const [index, position] of (positions ?? []).entries()) byPosition.set(position, modules?.[index]);
	return byPosition;
}
async function buildTree(route) {
	const layoutsByPosition = layoutModuleByTreePosition(route);
	const root = createNode("", layoutsByPosition.get(0));
	const nodesByPosition = /* @__PURE__ */ new Map([[0, root]]);
	let current = root;
	for (const [index, segment] of route.routeSegments.entries()) {
		const position = index + 1;
		const child = createNode(segment, layoutsByPosition.get(position));
		addChild(current, "children", child);
		nodesByPosition.set(position, child);
		current = child;
	}
	addChild(current, "children", createNode(PAGE_SEGMENT, route.page));
	for (const slot of Object.values(route.slots ?? {})) {
		const ownerPosition = slot.layoutIndex === void 0 || slot.layoutIndex < 0 ? route.routeSegments.length : route.layoutTreePositions?.[slot.layoutIndex] ?? route.routeSegments.length;
		const owner = nodesByPosition.get(ownerPosition) ?? current;
		const slotRoot = createNode(SLOT_SEGMENT, slot.layout);
		let slotCurrent = slotRoot;
		const slotConfigLayoutsByPosition = modulesByTreePosition(slot.configLayouts, slot.configLayoutTreePositions);
		const slotRouteSegments = slot.routeSegments ?? [];
		for (const [index, segment] of slotRouteSegments.entries()) {
			const position = index + 1;
			const child = createNode(segment, slotConfigLayoutsByPosition.get(position));
			addChild(slotCurrent, "children", child);
			slotCurrent = child;
		}
		addChild(slotCurrent, "children", createNode(PAGE_SEGMENT, slot.page ?? slot.default));
		addChild(owner, slot.name, slotRoot);
	}
	return root;
}
function computePrefetchHints(node, parentGzipSize, headInlineState, config) {
	const currentGzipSize = node.prefetchSize;
	const sizeToInline = currentGzipSize !== null && currentGzipSize < config.maxSize ? currentGzipSize : null;
	let didInlineIntoChild = false;
	let acceptingChildInlinedBytes = 0;
	let smallestChildInlinedBytes = Number.POSITIVE_INFINITY;
	let hasChildren = false;
	for (const child of Object.values(node.slots ?? {})) {
		hasChildren = true;
		const childInlinedBytes = computePrefetchHints(child, didInlineIntoChild ? null : sizeToInline, headInlineState, config);
		if ((child.prefetchHints & PARENT_INLINED_INTO_SELF) !== 0) {
			didInlineIntoChild = true;
			acceptingChildInlinedBytes = childInlinedBytes;
		} else if (!didInlineIntoChild && childInlinedBytes < smallestChildInlinedBytes) smallestChildInlinedBytes = childInlinedBytes;
	}
	if (!hasChildren) smallestChildInlinedBytes = 0;
	let hints = node.prefetchHints;
	if (didInlineIntoChild) hints |= INLINED_INTO_CHILD;
	let inlinedBytes = didInlineIntoChild ? acceptingChildInlinedBytes : smallestChildInlinedBytes;
	const isBundleTerminal = !didInlineIntoChild;
	if (!headInlineState.inlined && isBundleTerminal && node.name === PAGE_SEGMENT && inlinedBytes + HEAD_INLINE_SIZE < config.maxBundleSize) {
		hints |= HEAD_INLINED_INTO_SELF;
		inlinedBytes += HEAD_INLINE_SIZE;
		headInlineState.inlined = true;
	}
	if (parentGzipSize !== null) {
		if (inlinedBytes + parentGzipSize < config.maxBundleSize) {
			hints |= PARENT_INLINED_INTO_SELF;
			inlinedBytes += parentGzipSize;
		}
	}
	node.prefetchHints = hints;
	return inlinedBytes;
}
function stripMutableFields(node) {
	const slots = node.slots === null ? null : Object.fromEntries(Object.entries(node.slots).map(([key, child]) => [key, stripMutableFields(child)]));
	return {
		name: node.name,
		param: node.param,
		prefetchHints: node.prefetchHints,
		slots
	};
}
function resolvePrefetchInliningConfig(config) {
	if (config) return config;
	return {
		maxBundleSize: DEFAULT_MAX_INLINE_BUNDLE_SIZE,
		maxSize: DEFAULT_SEGMENT_INLINE_THRESHOLD
	};
}
async function createRouteTreePrefetchResponse(route, options = {}) {
	const tree = await buildTree(route);
	computePrefetchHints(tree, null, { inlined: false }, resolvePrefetchInliningConfig(options.prefetchInlining));
	const headers = new Headers({
		"Cache-Control": "no-store",
		"Content-Type": VINEXT_RSC_CONTENT_TYPE,
		[NEXT_DID_POSTPONE_HEADER]: "2",
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyRscCompatibilityIdHeader(headers);
	const deploymentId = options.deploymentId ?? getDeploymentId();
	if (deploymentId) headers.set(NEXTJS_DEPLOYMENT_ID_HEADER, deploymentId);
	const payload = {
		tree: stripMutableFields(tree),
		staleTime: -1
	};
	if (options.buildId) payload.buildId = options.buildId;
	return new Response(`0:${JSON.stringify(payload)}\n`, { headers });
}
//#endregion
export { createRouteTreePrefetchResponse, isRouteTreePrefetchRequest };
