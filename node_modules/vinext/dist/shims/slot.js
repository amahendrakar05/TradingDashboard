"use client";
import { AppElementsWire, UNMATCHED_SLOT } from "../server/app-elements-wire.js";
import "../server/app-elements.js";
import { getBfcacheIdMapContext, getBfcacheSegmentIdContext } from "./navigation-context-state.js";
import { notFound } from "./navigation-errors.js";
import "./navigation-server.js";
import * as React$1 from "react";
import { Fragment as Fragment$1, jsx } from "react/jsx-runtime";
//#region src/shims/slot.tsx
const EMPTY_ELEMENTS = Object.freeze({});
const warnedMissingEntryIds = /* @__PURE__ */ new Set();
const warnedTransportMetadataEntryIds = /* @__PURE__ */ new Set();
/**
* Holds resolved AppElements (not a Promise). React 19's use(Promise) during
* hydration triggers "async Client Component" for native Promises that lack
* React's internal .status property. Storing resolved values sidesteps this.
*/
const ElementsContext = React$1.createContext(EMPTY_ELEMENTS);
const ChildrenContext = React$1.createContext(null);
const ParallelSlotsContext = React$1.createContext(null);
const BfcacheIdMapContext = getBfcacheIdMapContext();
const BfcacheSegmentIdContext = getBfcacheSegmentIdContext();
const EMPTY_BFCACHE_STATE_KEYS = Object.freeze({});
const MAX_BFCACHE_SLOT_ENTRIES_WITH_CACHE_COMPONENTS = 3;
const MAX_BFCACHE_SLOT_ENTRIES_WITHOUT_CACHE_COMPONENTS = 1;
const BfcacheStateKeyMapContext = React$1.createContext(EMPTY_BFCACHE_STATE_KEYS);
function isCacheComponentsEnabled() {
	return String(process.env.__NEXT_CACHE_COMPONENTS) === "true";
}
function getBfcacheSlotEntryLimit() {
	return isCacheComponentsEnabled() ? MAX_BFCACHE_SLOT_ENTRIES_WITH_CACHE_COMPONENTS : MAX_BFCACHE_SLOT_ENTRIES_WITHOUT_CACHE_COMPONENTS;
}
function normalizeBfcacheSlotEntryLimit(maxEntries) {
	if (!Number.isFinite(maxEntries)) return 1;
	return Math.max(1, Math.trunc(maxEntries));
}
function updateBfcacheSlotEntryOrder(previousOrder, activeStateKey, maxEntries = getBfcacheSlotEntryLimit()) {
	const entryLimit = normalizeBfcacheSlotEntryLimit(maxEntries);
	const nextOrder = [activeStateKey];
	for (const stateKey of previousOrder) {
		if (nextOrder.length >= entryLimit) break;
		if (stateKey === activeStateKey) continue;
		nextOrder.push(stateKey);
	}
	return nextOrder;
}
function pruneBfcacheSlotEntrySnapshots(snapshotsByStateKey, retainedOrder) {
	const retainedKeys = new Set(retainedOrder);
	for (const stateKey of snapshotsByStateKey.keys()) if (!retainedKeys.has(stateKey)) snapshotsByStateKey.delete(stateKey);
}
function haveSameBfcacheSlotEntryOrder(left, right) {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return false;
	return true;
}
function isLayoutFlagsValue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const entries = Object.values(value);
	return entries.length > 0 && entries.every((entry) => entry === "s" || entry === "d");
}
function isArtifactCompatibilityEnvelopeValue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return "schemaVersion" in value && "appElementsSchemaVersion" in value && "rscPayloadSchemaVersion" in value && "graphVersion" in value && "deploymentVersion" in value && "rootBoundaryId" in value && "renderEpoch" in value;
}
function isSlotBindingValue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return "ownerLayoutId" in value && "slotId" in value && "state" in value;
}
function isSlotBindingListValue(value) {
	return Array.isArray(value) && value.length > 0 && value.every(isSlotBindingValue);
}
function isSkippedLayoutIdsMetadataValue(id, value) {
	return id === "__skippedLayoutIds" && Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isInterceptionMetadataValue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return "sourceMatchedUrl" in value && typeof value.sourceMatchedUrl === "string" && "sourceRouteId" in value && typeof value.sourceRouteId === "string" && "slotId" in value && typeof value.slotId === "string" && "targetMatchedUrl" in value && typeof value.targetMatchedUrl === "string" && "targetRouteId" in value && typeof value.targetRouteId === "string";
}
function isCacheEntryReuseProofValue(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	return "kind" in value && value.kind === "runtime-cache-entry" && "decision" in value;
}
function isTransportMetadataValue(id, value) {
	return isLayoutFlagsValue(value) || isArtifactCompatibilityEnvelopeValue(value) || isCacheEntryReuseProofValue(value) || isInterceptionMetadataValue(value) || isSkippedLayoutIdsMetadataValue(id, value) || isSlotBindingListValue(value);
}
function warnTransportMetadataEntry(id) {
	if (process.env.NODE_ENV === "production") return;
	if (warnedTransportMetadataEntryIds.has(id)) return;
	warnedTransportMetadataEntryIds.add(id);
	console.warn("[vinext] Transport metadata value found under App Router render entry: " + id);
}
/**
* Provider stack for Activity-retained BFCache entries. Each retained entry
* re-provides the elements, state-key map, and segment id it was captured with,
* falling back to the live boundary values for entries that predate per-entry
* capture.
*/
function BfcacheEntryProviders({ entry, fallbackElements, fallbackSegmentId, fallbackStateKeyMap, SegmentContext }) {
	return /* @__PURE__ */ jsx(BfcacheStateKeyMapContext.Provider, {
		value: entry.stateKeyMap ?? fallbackStateKeyMap,
		children: /* @__PURE__ */ jsx(ElementsContext.Provider, {
			value: entry.elements ?? fallbackElements,
			children: /* @__PURE__ */ jsx(SegmentContext.Provider, {
				value: entry.segmentId ?? fallbackSegmentId,
				children: entry.content
			})
		})
	});
}
function useBfcacheSlotEntries(activeEntry) {
	const snapshotsByStateKey = React$1.useRef(/* @__PURE__ */ new Map());
	const [entryOrder, setEntryOrder] = React$1.useState(() => [activeEntry.stateKey]);
	snapshotsByStateKey.current.set(activeEntry.stateKey, activeEntry);
	const nextOrder = updateBfcacheSlotEntryOrder(entryOrder, activeEntry.stateKey);
	const orderChanged = !haveSameBfcacheSlotEntryOrder(entryOrder, nextOrder);
	const renderOrder = orderChanged ? nextOrder : entryOrder;
	pruneBfcacheSlotEntrySnapshots(snapshotsByStateKey.current, renderOrder);
	if (process.env.NODE_ENV !== "production" && !snapshotsByStateKey.current.has(activeEntry.stateKey)) throw new Error("BFCache Activity slot is missing the active entry snapshot");
	if (orderChanged) setEntryOrder(nextOrder);
	return renderOrder.map((stateKey) => snapshotsByStateKey.current.get(stateKey)).filter((entry) => entry !== void 0);
}
function BfcacheActivitySlotBoundary({ activeStateKey, content, elements, id, SegmentContext, stateKeyMap }) {
	return /* @__PURE__ */ jsx(Fragment$1, { children: useBfcacheSlotEntries({
		content,
		elements,
		segmentId: id,
		stateKey: activeStateKey,
		stateKeyMap
	}).map((entry) => /* @__PURE__ */ jsx(React$1.Activity, {
		mode: entry.stateKey === activeStateKey ? "visible" : "hidden",
		children: /* @__PURE__ */ jsx(BfcacheEntryProviders, {
			entry,
			fallbackElements: elements,
			fallbackSegmentId: id,
			fallbackStateKeyMap: stateKeyMap,
			SegmentContext
		})
	}, entry.stateKey)) });
}
function BfcacheSlotBoundary({ content, id }) {
	const SegmentContext = BfcacheSegmentIdContext;
	const elements = React$1.useContext(ElementsContext);
	const stateKeyMap = React$1.useContext(BfcacheStateKeyMapContext);
	const activeStateKey = stateKeyMap[id];
	if (!SegmentContext) return /* @__PURE__ */ jsx(Fragment$1, { children: content });
	if (activeStateKey === void 0) return /* @__PURE__ */ jsx(SegmentContext.Provider, {
		value: id,
		children: content
	});
	if (!isCacheComponentsEnabled()) return /* @__PURE__ */ jsx(SegmentContext.Provider, {
		value: id,
		children: content
	});
	return /* @__PURE__ */ jsx(BfcacheActivitySlotBoundary, {
		activeStateKey,
		content,
		elements,
		id,
		SegmentContext,
		stateKeyMap
	});
}
function mergeElements(prev, next, options = {}) {
	const clearAbsentSlots = typeof options === "boolean" ? options : options.clearAbsentSlots ?? false;
	const preserveAbsentSlots = typeof options === "boolean" ? !options : options.preserveAbsentSlots ?? true;
	const preserveElementIds = typeof options === "boolean" ? [] : options.preserveElementIds ?? [];
	const preservePreviousSlotIds = typeof options === "boolean" ? [] : options.preservePreviousSlotIds ?? [];
	const merged = { ...next };
	for (const id of preserveElementIds) if (Object.hasOwn(prev, id)) {
		const value = prev[id];
		if (value !== void 0) merged[id] = value;
	}
	const slotKeys = new Set([...Object.keys(prev), ...Object.keys(next)].filter((key) => AppElementsWire.isSlotId(key)));
	if (clearAbsentSlots) {
		for (const key of slotKeys) if (!Object.hasOwn(next, key)) delete merged[key];
	} else if (preserveAbsentSlots) {
		for (const key of slotKeys) if (!Object.hasOwn(merged, key) && Object.hasOwn(prev, key)) {
			const value = prev[key];
			if (value !== void 0) merged[key] = value;
		}
	}
	for (const id of preservePreviousSlotIds) {
		if (!AppElementsWire.isSlotId(id)) continue;
		if (!Object.hasOwn(prev, id)) continue;
		const value = prev[id];
		if (value !== void 0 && value !== UNMATCHED_SLOT) merged[id] = value;
	}
	return merged;
}
function Slot({ id, children, parallelSlots }) {
	const elements = React$1.useContext(ElementsContext);
	if (!Object.hasOwn(elements, id)) {
		if (process.env.NODE_ENV !== "production" && !AppElementsWire.isSlotId(id)) {
			if (!warnedMissingEntryIds.has(id)) {
				warnedMissingEntryIds.add(id);
				console.warn("[vinext] Missing App Router element entry during render: " + id);
			}
		}
		return null;
	}
	const element = elements[id];
	if (isTransportMetadataValue(id, element)) {
		warnTransportMetadataEntry(id);
		return null;
	}
	if (element === UNMATCHED_SLOT) notFound();
	if (element === null) return null;
	const content = /* @__PURE__ */ jsx(ParallelSlotsContext.Provider, {
		value: parallelSlots ?? null,
		children: /* @__PURE__ */ jsx(ChildrenContext.Provider, {
			value: children ?? null,
			children: element
		})
	});
	return BfcacheIdMapContext && BfcacheSegmentIdContext ? /* @__PURE__ */ jsx(BfcacheSlotBoundary, {
		id,
		content
	}) : content;
}
function Children() {
	return React$1.useContext(ChildrenContext);
}
function ParallelSlot({ name }) {
	return React$1.useContext(ParallelSlotsContext)?.[name] ?? null;
}
//#endregion
export { BfcacheStateKeyMapContext, Children, ChildrenContext, ElementsContext, ParallelSlot, ParallelSlotsContext, Slot, UNMATCHED_SLOT, mergeElements, updateBfcacheSlotEntryOrder };
