import { countConsumedPathnameSegments, isInvisibleSegment, normalizePathnameForRouteMatch, splitPathSegments } from "../routing/utils.js";
import { normalizePath } from "./normalize-path.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import "./app-bfcache-id.js";
//#region src/server/app-bfcache-identity.ts
let nextBfcacheId = 0;
function rememberBfcacheId(value) {
	const match = /^_b_(\d+)_$/.exec(value);
	if (!match) return;
	nextBfcacheId = Math.max(nextBfcacheId, Number(match[1]));
}
function mintBfcacheId() {
	nextBfcacheId += 1;
	return `_b_${nextBfcacheId}_`;
}
function getVisibleTreePathSegments(treePath) {
	return splitPathSegments(treePath).filter((segment) => !isInvisibleSegment(segment));
}
function getTreePathIdentityPrefix(pathname, treePath) {
	const pathnameSegments = splitPathSegments(pathname);
	const consumedPathnameSegments = countConsumedPathnameSegments(getVisibleTreePathSegments(treePath), pathnameSegments.length);
	if (consumedPathnameSegments === 0) return "/";
	return `/${pathnameSegments.slice(0, consumedPathnameSegments).join("/")}`;
}
function indexAppElementsMetadata(metadata) {
	const slotBindingsBySlotId = /* @__PURE__ */ new Map();
	for (const binding of metadata.slotBindings) slotBindingsBySlotId.set(binding.slotId, binding);
	return {
		metadata,
		slotBindingsBySlotId
	};
}
function readAppElementsMetadata(elements) {
	let metadata;
	try {
		metadata = AppElementsWire.readMetadata(elements);
	} catch {
		return null;
	}
	return indexAppElementsMetadata(metadata);
}
function parseBfcacheSegmentKey(id) {
	const parsed = AppElementsWire.parseElementKey(id);
	return parsed !== null && parsed.kind !== "route" ? parsed : null;
}
function createActiveSlotIdentity(id, parsed) {
	const activeSlotBinding = parsed?.slotBindingsBySlotId.get(id);
	if (activeSlotBinding?.activeRouteId != null) return `${id}@${activeSlotBinding.activeRouteId}`;
	const interception = parsed?.metadata.interception;
	if (interception?.slotId !== id) return null;
	return `${id}@${interception.targetRouteId}`;
}
/**
* Derive BFCache identity from AppElements wire keys. Keep wire-key parsing
* contained here until vinext has a route-manifest authority equivalent to
* Next.js CacheNode or segment-cache state.
*/
function createBfcacheSegmentIdentity(id, parsed, options) {
	if (parsed.kind === "page") return `${id}@${options.pathname}`;
	if (parsed.kind === "slot") {
		const activeSlotIdentity = createActiveSlotIdentity(id, options.metadata);
		if (activeSlotIdentity !== null) return activeSlotIdentity;
		return `${id}@${getTreePathIdentityPrefix(options.pathname, parsed.treePath)}`;
	}
	if (parsed.kind === "layout" || parsed.kind === "template") return `${id}@${getTreePathIdentityPrefix(options.pathname, parsed.treePath)}`;
	return null;
}
function collectBfcacheSegmentIdCandidates(elements, metadata = readAppElementsMetadata(elements)) {
	const ids = new Set(Object.keys(elements));
	for (const layoutId of metadata?.metadata.layoutIds ?? []) ids.add(layoutId);
	return ids;
}
function createInitialBfcacheIdMap(elements) {
	const bfcacheIds = {};
	for (const id of collectBfcacheSegmentIdCandidates(elements)) if (parseBfcacheSegmentKey(id) !== null) bfcacheIds[id] = "0";
	return bfcacheIds;
}
function normalizeBfcachePathname(pathname) {
	const normalized = normalizePath(normalizePathnameForRouteMatch(pathname));
	return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}
function createBfcacheSegmentStateKeyMap(options) {
	const metadata = readAppElementsMetadata(options.elements);
	const normalizedPathname = normalizeBfcachePathname(options.pathname);
	const stateKeys = {};
	for (const id of collectBfcacheSegmentIdCandidates(options.elements, metadata)) {
		const parsed = parseBfcacheSegmentKey(id);
		if (parsed === null) continue;
		const stateKey = createBfcacheSegmentIdentity(id, parsed, {
			metadata,
			pathname: normalizedPathname
		});
		if (stateKey !== null) stateKeys[id] = stateKey;
	}
	return stateKeys;
}
function createInitialBfcacheMaps(options) {
	const metadata = indexAppElementsMetadata(options.metadata);
	const ids = collectBfcacheSegmentIdCandidates(options.elements, metadata);
	const normalizedPathname = normalizeBfcachePathname(options.pathname);
	const bfcacheIds = {};
	const stateKeys = {};
	for (const id of ids) {
		const parsed = parseBfcacheSegmentKey(id);
		if (parsed === null) continue;
		bfcacheIds[id] = "0";
		const stateKey = createBfcacheSegmentIdentity(id, parsed, {
			metadata,
			pathname: normalizedPathname
		});
		if (stateKey !== null) stateKeys[id] = stateKey;
	}
	return {
		bfcacheIds,
		stateKeys
	};
}
function createNextBfcacheIdMap(options) {
	const current = options.reuseCurrent === false ? {} : options.current;
	for (const value of Object.values(current)) rememberBfcacheId(value);
	for (const value of Object.values(options.restored ?? {})) rememberBfcacheId(value);
	const currentMetadata = readAppElementsMetadata(options.currentElements);
	const nextMetadata = readAppElementsMetadata(options.elements);
	const currentPathname = normalizeBfcachePathname(options.currentPathname);
	const nextPathname = normalizeBfcachePathname(options.nextPathname);
	const ids = {};
	for (const id of collectBfcacheSegmentIdCandidates(options.elements, nextMetadata)) {
		const parsed = parseBfcacheSegmentKey(id);
		if (parsed === null) continue;
		const currentValue = createBfcacheSegmentIdentity(id, parsed, {
			metadata: currentMetadata,
			pathname: currentPathname
		}) === createBfcacheSegmentIdentity(id, parsed, {
			metadata: nextMetadata,
			pathname: nextPathname
		}) ? current[id] : void 0;
		const value = options.restored?.[id] ?? currentValue ?? mintBfcacheId();
		ids[id] = value;
		rememberBfcacheId(value);
	}
	return ids;
}
function preserveBfcacheIdsForMergedElements(options) {
	const ids = {};
	for (const id of collectBfcacheSegmentIdCandidates(options.elements)) {
		if (parseBfcacheSegmentKey(id) === null) continue;
		const value = options.next[id] ?? options.previous[id];
		if (value === void 0) continue;
		ids[id] = value;
		rememberBfcacheId(value);
	}
	return ids;
}
//#endregion
export { createBfcacheSegmentStateKeyMap, createInitialBfcacheIdMap, createInitialBfcacheMaps, createNextBfcacheIdMap, preserveBfcacheIdsForMergedElements };
