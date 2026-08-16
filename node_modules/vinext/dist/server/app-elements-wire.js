import { isInterceptionMatchedUrlPath } from "./normalize-path.js";
import { compareStrings } from "../utils/compare.js";
import { isUnknownRecord } from "../utils/record.js";
import { createArtifactCompatibilityEnvelope, parseArtifactCompatibilityEnvelope } from "./artifact-compatibility.js";
import { releaseAppElementRenderDependency } from "./app-render-dependency.js";
import { isValidElement } from "react";
//#region src/server/app-elements-wire.ts
const APP_INTERCEPTION_SEPARATOR = "\0";
const APP_ARTIFACT_COMPATIBILITY_KEY = "__artifactCompatibility";
const APP_CACHE_ENTRY_REUSE_PROOF_KEY = "__cacheEntryReuseProof";
const APP_DYNAMIC_STALE_TIME_KEY = "__dynamicStaleTime";
const APP_INTERCEPTION_KEY = "__interception";
const APP_INTERCEPTION_CONTEXT_KEY = "__interceptionContext";
const APP_LAYOUT_IDS_KEY = "__layoutIds";
const APP_LAYOUT_FLAGS_KEY = "__layoutFlags";
const APP_RENDER_OBSERVATION_KEY = "__renderObservation";
const APP_ROUTE_KEY = "__route";
const APP_ROOT_LAYOUT_KEY = "__rootLayout";
const APP_SKIPPED_LAYOUT_IDS_KEY = "__skippedLayoutIds";
const APP_SOURCE_PAGE_KEY = "__sourcePage";
const APP_SLOT_BINDINGS_KEY = "__slotBindings";
/**
* Static sibling segment names for the matched route, surfaced so the client
* router can determine if a cached prefetch of a dynamic route can be reused
* when navigating to a static sibling URL.
*
* Mirrors Next.js's `staticSiblings` tuple element on the loader-tree dynamic
* segments (issue cloudflare/vinext#1525).
*/
const APP_STATIC_SIBLINGS_KEY = "__staticSiblings";
const APP_UNMATCHED_SLOT_WIRE_VALUE = "__VINEXT_UNMATCHED_SLOT__";
const UNMATCHED_SLOT = Symbol.for("vinext.unmatchedSlot");
const EMPTY_SKIPPED_LAYOUT_IDS = /* @__PURE__ */ new Set();
function createCacheProofRejectionCodeSet(codes) {
	return new Set(codes);
}
const CACHE_PROOF_REJECTION_CODES = createCacheProofRejectionCodeSet([
	"CP_CACHE_ENTRY_PROOF_MISSING",
	"CP_MODEL_DISABLED",
	"CP_ARTIFACT_COMPATIBILITY_INCOMPATIBLE",
	"CP_ARTIFACT_COMPATIBILITY_UNKNOWN",
	"CP_DIMENSION_COUNT_EXCEEDED",
	"CP_DIMENSION_NAME_MISSING",
	"CP_DIMENSION_NAME_TOO_LONG",
	"CP_DIMENSION_VALUE_COUNT_EXCEEDED",
	"CP_DIMENSION_VALUE_TOO_LONG",
	"CP_DIMENSION_VALUES_MISSING",
	"CP_ENCODED_VARIANT_TOO_LONG",
	"CP_INVALID_VARIANT_BUDGET",
	"CP_ROUTE_VARIANT_BUDGET_ROUTE_MISMATCH",
	"CP_ROUTE_VARIANT_CEILING_EXCEEDED",
	"CP_UNSAFE_PUBLIC_DIMENSION",
	"CP_BOUNDARY_OUTCOME_MISMATCH",
	"CP_BOUNDARY_OUTCOME_UNKNOWN",
	"CP_PRIVATE_DYNAMIC_DOWNGRADE",
	"CP_STATIC_LAYOUT_CANDIDATE_OUTPUT_KIND",
	"CP_STATIC_LAYOUT_CURRENT_OUTPUT_KIND",
	"CP_STATIC_LAYOUT_ID_MISMATCH",
	"CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_KIND",
	"CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_MISMATCH",
	"CP_STATIC_LAYOUT_PRIVATE_DYNAMIC_DOWNGRADE",
	"CP_STATIC_LAYOUT_REQUEST_API_OBSERVED",
	"CP_STATIC_LAYOUT_REQUEST_API_UNKNOWN",
	"CP_STATIC_LAYOUT_ROOT_BOUNDARY_MISMATCH",
	"CP_STATIC_LAYOUT_ROOT_BOUNDARY_UNKNOWN",
	"CP_STATIC_LAYOUT_VARIANT_DIMENSION_UNPROVEN"
]);
const compareAppElementsSlotIds = compareStrings;
function compareAppElementsSlotBindingsBySlotId(left, right) {
	return compareAppElementsSlotIds(left.slotId, right.slotId);
}
function normalizeAppElementsSlotBindings(slotBindings, options = {}) {
	const ownerLayoutIds = options.layoutIds ? new Set(options.layoutIds) : null;
	const seenSlotIds = /* @__PURE__ */ new Set();
	const normalized = [];
	for (const binding of slotBindings) {
		if (seenSlotIds.has(binding.slotId)) throw new Error("[vinext] Invalid __slotBindings in App Router payload: duplicate slot id");
		seenSlotIds.add(binding.slotId);
		if (ownerLayoutIds && binding.ownerLayoutId !== null && !ownerLayoutIds.has(binding.ownerLayoutId)) throw new Error("[vinext] Invalid __slotBindings in App Router payload: owner layout id missing from __layoutIds");
		normalized.push({ ...binding });
	}
	return normalized.sort(compareAppElementsSlotBindingsBySlotId);
}
function appendInterceptionContext(identity, interceptionContext) {
	return interceptionContext === null ? identity : `${identity}${APP_INTERCEPTION_SEPARATOR}${interceptionContext}`;
}
function createAppPayloadRouteId(routePath, interceptionContext) {
	return appendInterceptionContext(`route:${routePath}`, interceptionContext);
}
function createAppPayloadPageId(routePath, interceptionContext) {
	return appendInterceptionContext(`page:${routePath}`, interceptionContext);
}
function createAppPayloadLayoutId(treePath) {
	return `layout:${treePath}`;
}
function createAppPayloadTemplateId(treePath) {
	return `template:${treePath}`;
}
function createAppPayloadSlotId(slotName, treePath) {
	return `slot:${slotName}:${treePath}`;
}
function createAppPayloadCacheKey(rscUrl, interceptionContext) {
	return appendInterceptionContext(rscUrl, interceptionContext);
}
function parsePathWithInterception(input) {
	const separatorIndex = input.indexOf(APP_INTERCEPTION_SEPARATOR);
	const path = separatorIndex === -1 ? input : input.slice(0, separatorIndex);
	if (!path.startsWith("/")) return null;
	return {
		interceptionContext: separatorIndex === -1 ? null : input.slice(separatorIndex + 1),
		path
	};
}
/**
* AppElements tree paths are absolute route-tree paths on the wire.
* Bare segment names are not valid layout/template/slot tree identities.
*/
function parseTreePath(input) {
	return input.startsWith("/") ? input : null;
}
function parseAppElementsWireElementKey(key) {
	if (key.startsWith("route:")) {
		const parsed = parsePathWithInterception(key.slice(6));
		if (!parsed) return null;
		return {
			interceptionContext: parsed.interceptionContext,
			kind: "route",
			path: parsed.path
		};
	}
	if (key.startsWith("page:")) {
		const parsed = parsePathWithInterception(key.slice(5));
		if (!parsed) return null;
		return {
			interceptionContext: parsed.interceptionContext,
			kind: "page",
			path: parsed.path
		};
	}
	if (key.startsWith("layout:")) {
		const treePath = parseTreePath(key.slice(7));
		return treePath ? {
			kind: "layout",
			treePath
		} : null;
	}
	if (key.startsWith("template:")) {
		const treePath = parseTreePath(key.slice(9));
		return treePath ? {
			kind: "template",
			treePath
		} : null;
	}
	if (key.startsWith("slot:")) {
		const body = key.slice(5);
		const separatorIndex = body.indexOf(":");
		if (separatorIndex <= 0) return null;
		const name = body.slice(0, separatorIndex);
		const treePath = parseTreePath(body.slice(separatorIndex + 1));
		return treePath ? {
			kind: "slot",
			name,
			treePath
		} : null;
	}
	return null;
}
function isAppElementsWireSlotId(key) {
	if (!key.startsWith("slot:")) return false;
	const body = key.slice(5);
	const separatorIndex = body.indexOf(":");
	return separatorIndex > 0 && body.charCodeAt(separatorIndex + 1) === 47;
}
function createAppElementsWireMetadataEntries(input) {
	const layoutIds = [...input.layoutIds ?? []];
	const entries = {
		[APP_ROUTE_KEY]: input.routeId,
		[APP_INTERCEPTION_CONTEXT_KEY]: input.interceptionContext,
		[APP_LAYOUT_IDS_KEY]: layoutIds,
		[APP_ROOT_LAYOUT_KEY]: input.rootLayoutTreePath,
		...input.dynamicStaleTimeSeconds === void 0 ? {} : { [APP_DYNAMIC_STALE_TIME_KEY]: input.dynamicStaleTimeSeconds },
		...input.sourcePage === null || input.sourcePage === void 0 ? {} : { [APP_SOURCE_PAGE_KEY]: input.sourcePage }
	};
	const entriesWithInterception = input.interception ? {
		...entries,
		[APP_INTERCEPTION_KEY]: input.interception
	} : entries;
	if (input.slotBindings && input.slotBindings.length > 0) return {
		...entriesWithInterception,
		[APP_SLOT_BINDINGS_KEY]: normalizeAppElementsSlotBindings(input.slotBindings, { layoutIds })
	};
	return entriesWithInterception;
}
function normalizeAppElements(elements) {
	let needsNormalization = false;
	for (const [key, value] of Object.entries(elements)) if (isAppElementsWireSlotId(key) && value === "__VINEXT_UNMATCHED_SLOT__") {
		needsNormalization = true;
		break;
	}
	if (!needsNormalization) return elements;
	const normalized = {};
	for (const [key, value] of Object.entries(elements)) normalized[key] = isAppElementsWireSlotId(key) && value === "__VINEXT_UNMATCHED_SLOT__" ? UNMATCHED_SLOT : value;
	return normalized;
}
function isLayoutFlagsRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	for (const v of Object.values(value)) if (v !== "s" && v !== "d") return false;
	return true;
}
function parseLayoutFlags(value) {
	if (isLayoutFlagsRecord(value)) return value;
	return {};
}
function parseLayoutIdList(value, fieldName) {
	if (value === void 0) return [];
	if (!Array.isArray(value)) throw new Error(`[vinext] Invalid ${fieldName} in App Router payload: expected layout id string[]`);
	const layoutIds = [];
	for (const entry of value) {
		if (typeof entry !== "string") throw new Error(`[vinext] Invalid ${fieldName} in App Router payload: expected layout id string[]`);
		if (parseAppElementsWireElementKey(entry)?.kind !== "layout") throw new Error(`[vinext] Invalid ${fieldName} in App Router payload: expected layout ids`);
		layoutIds.push(entry);
	}
	return layoutIds;
}
function parseLayoutIds(value) {
	return parseLayoutIdList(value, APP_LAYOUT_IDS_KEY);
}
function parseSkippedLayoutIds(value) {
	return parseLayoutIdList(value, APP_SKIPPED_LAYOUT_IDS_KEY);
}
function isSlotBindingState(value) {
	return value === "active" || value === "default" || value === "unmatched";
}
function parseSlotBindings(value, options = {}) {
	if (value === void 0) return [];
	if (!Array.isArray(value)) throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected array");
	const slotBindings = [];
	for (const entry of value) {
		if (!isUnknownRecord(entry)) throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected objects");
		const slotId = entry.slotId;
		if (typeof slotId !== "string" || parseAppElementsWireElementKey(slotId)?.kind !== "slot") throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected slot ids");
		const ownerLayoutId = entry.ownerLayoutId;
		if (ownerLayoutId !== null && (typeof ownerLayoutId !== "string" || parseAppElementsWireElementKey(ownerLayoutId)?.kind !== "layout")) throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected owner layout ids");
		const state = entry.state;
		if (!isSlotBindingState(state)) throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected state");
		const activeRouteId = entry.activeRouteId;
		if (activeRouteId !== void 0 && activeRouteId !== null && (typeof activeRouteId !== "string" || parseAppElementsWireElementKey(activeRouteId)?.kind !== "route")) throw new Error("[vinext] Invalid __slotBindings in App Router payload: expected route ids");
		slotBindings.push({
			...activeRouteId !== void 0 ? { activeRouteId } : {},
			ownerLayoutId,
			slotId,
			state
		});
	}
	return normalizeAppElementsSlotBindings(slotBindings, options);
}
function readRequiredInterceptionString(entry, fieldName) {
	const value = entry[fieldName];
	if (typeof value !== "string") throw new Error("[vinext] Invalid __interception in App Router payload: expected strings");
	return value;
}
function parseInterceptionMatchedUrl(value) {
	if (!isInterceptionMatchedUrlPath(value)) throw new Error("[vinext] Invalid __interception in App Router payload: expected path URLs");
	return value;
}
function parseInterceptionRouteId(value, matchedUrl) {
	const parsed = parseAppElementsWireElementKey(value);
	if (parsed?.kind !== "route" || parsed.path !== matchedUrl || parsed.interceptionContext !== null) throw new Error("[vinext] Invalid __interception in App Router payload: expected route ids");
	return value;
}
function parseInterceptionSlotId(value) {
	if (parseAppElementsWireElementKey(value)?.kind !== "slot") throw new Error("[vinext] Invalid __interception in App Router payload: expected slot id");
	return value;
}
function parseInterceptionMetadata(value) {
	if (value === void 0 || value === null) return null;
	if (!isUnknownRecord(value)) throw new Error("[vinext] Invalid __interception in App Router payload: expected object");
	const sourceMatchedUrl = parseInterceptionMatchedUrl(readRequiredInterceptionString(value, "sourceMatchedUrl"));
	const targetMatchedUrl = parseInterceptionMatchedUrl(readRequiredInterceptionString(value, "targetMatchedUrl"));
	return {
		sourceMatchedUrl,
		sourceRouteId: parseInterceptionRouteId(readRequiredInterceptionString(value, "sourceRouteId"), sourceMatchedUrl),
		slotId: parseInterceptionSlotId(readRequiredInterceptionString(value, "slotId")),
		targetMatchedUrl,
		targetRouteId: parseInterceptionRouteId(readRequiredInterceptionString(value, "targetRouteId"), targetMatchedUrl)
	};
}
/**
* Type predicate for a plain (non-null, non-array) record of app payload values.
* Used to distinguish the App Router payload object from bare React elements at
* the render boundary. Narrows to `Readonly<Record<string, unknown>>` because
* the outgoing payload carries heterogeneous values (ReactNodes for the rendered
* tree, plus metadata like `__layoutFlags` which is a plain object). Delegates
* to React's canonical `isValidElement` so we don't depend on React's internal
* `$$typeof` marker scheme.
*/
function isAppElementsRecord(value) {
	if (typeof value !== "object" || value === null) return false;
	if (Array.isArray(value)) return false;
	if (isValidElement(value)) return false;
	return true;
}
function withLayoutFlags(elements, layoutFlags) {
	return {
		...elements,
		[APP_LAYOUT_FLAGS_KEY]: layoutFlags
	};
}
function buildOutgoingAppPayload(input) {
	if (!isAppElementsRecord(input.element)) return input.element;
	const skippedLayoutIds = createSkippedLayoutIds(input.skipDisposition);
	const payload = {};
	for (const [key, value] of Object.entries(input.element)) {
		if (skippedLayoutIds.has(key)) {
			releaseAppElementRenderDependency(input.element, key);
			continue;
		}
		payload[key] = value === UNMATCHED_SLOT ? APP_UNMATCHED_SLOT_WIRE_VALUE : value;
	}
	payload[APP_LAYOUT_FLAGS_KEY] = input.layoutFlags;
	if (skippedLayoutIds.size > 0) payload[APP_SKIPPED_LAYOUT_IDS_KEY] = [...skippedLayoutIds];
	payload[APP_ARTIFACT_COMPATIBILITY_KEY] = input.artifactCompatibility ?? createArtifactCompatibilityEnvelope();
	if (input.cacheEntryReuseProof) payload[APP_CACHE_ENTRY_REUSE_PROOF_KEY] = input.cacheEntryReuseProof;
	if (input.dynamicStaleTimeSeconds !== void 0) payload[APP_DYNAMIC_STALE_TIME_KEY] = input.dynamicStaleTimeSeconds;
	if (input.renderObservation) payload[APP_RENDER_OBSERVATION_KEY] = input.renderObservation;
	return payload;
}
function createSkippedLayoutIds(skipDisposition) {
	if (skipDisposition?.enabled !== true) return EMPTY_SKIPPED_LAYOUT_IDS;
	const skippedLayoutIds = /* @__PURE__ */ new Set();
	for (const id of skipDisposition.skippedEntryIds) if (parseAppElementsWireElementKey(id)?.kind === "layout") skippedLayoutIds.add(id);
	return skippedLayoutIds;
}
function readArtifactCompatibilityMetadata(value) {
	if (value === void 0) return createArtifactCompatibilityEnvelope();
	return parseArtifactCompatibilityEnvelope(value) ?? createArtifactCompatibilityEnvelope();
}
function readSourcePageMetadata(value) {
	if (value === void 0 || value === null) return null;
	if (typeof value !== "string" || !value.startsWith("/")) return null;
	return value;
}
function createMissingCacheEntryReuseProof() {
	return {
		kind: "runtime-cache-entry",
		decision: null
	};
}
function isCacheProofRejectionCode(value) {
	return typeof value === "string" && CACHE_PROOF_REJECTION_CODES.has(value);
}
function isCacheProofFallbackMode(value) {
	return value === "renderFresh" || value === "privateUncacheable";
}
function isCacheProofFallbackScope(value) {
	return value === "affectedOutput" || value === "route";
}
function parseCacheEntryReuseProofMetadata(value) {
	if (value === void 0) return null;
	if (!isUnknownRecord(value) || value.kind !== "runtime-cache-entry") return createMissingCacheEntryReuseProof();
	const decision = value.decision;
	if (decision === null) return createMissingCacheEntryReuseProof();
	if (!isUnknownRecord(decision)) return createMissingCacheEntryReuseProof();
	if (decision.kind === "reuse" && decision.canReuse === true && decision.code === "CP_STATIC_LAYOUT_REUSE_PROVEN" && decision.reuseClass === "static-layout") return {
		kind: "runtime-cache-entry",
		decision: {
			canReuse: true,
			code: decision.code,
			kind: "reuse",
			reuseClass: decision.reuseClass
		}
	};
	if (decision.kind === "reject" && decision.canReuse === false && isCacheProofRejectionCode(decision.code) && isCacheProofFallbackMode(decision.mode) && isCacheProofFallbackScope(decision.scope)) return {
		kind: "runtime-cache-entry",
		decision: {
			canReuse: false,
			code: decision.code,
			kind: "reject",
			mode: decision.mode,
			scope: decision.scope
		}
	};
	return createMissingCacheEntryReuseProof();
}
function readAppElementsMetadata(elements) {
	const routeId = elements[APP_ROUTE_KEY];
	if (typeof routeId !== "string") throw new Error("[vinext] Missing __route string in App Router payload");
	const interceptionContext = elements[APP_INTERCEPTION_CONTEXT_KEY];
	if (interceptionContext !== void 0 && interceptionContext !== null && typeof interceptionContext !== "string") throw new Error("[vinext] Invalid __interceptionContext in App Router payload");
	const rootLayoutTreePath = elements[APP_ROOT_LAYOUT_KEY];
	if (rootLayoutTreePath === void 0) throw new Error("[vinext] Missing __rootLayout key in App Router payload");
	if (rootLayoutTreePath !== null && typeof rootLayoutTreePath !== "string") throw new Error("[vinext] Invalid __rootLayout in App Router payload: expected string or null");
	const layoutFlags = parseLayoutFlags(elements[APP_LAYOUT_FLAGS_KEY]);
	const layoutIds = parseLayoutIds(elements[APP_LAYOUT_IDS_KEY]);
	const skippedLayoutIds = parseSkippedLayoutIds(elements[APP_SKIPPED_LAYOUT_IDS_KEY]);
	const slotBindings = parseSlotBindings(elements[APP_SLOT_BINDINGS_KEY], { layoutIds });
	const interception = parseInterceptionMetadata(elements[APP_INTERCEPTION_KEY]);
	const artifactCompatibility = readArtifactCompatibilityMetadata(elements[APP_ARTIFACT_COMPATIBILITY_KEY]);
	const cacheEntryReuseProof = parseCacheEntryReuseProofMetadata(elements[APP_CACHE_ENTRY_REUSE_PROOF_KEY]);
	const dynamicStaleTime = elements[APP_DYNAMIC_STALE_TIME_KEY];
	const dynamicStaleTimeSeconds = typeof dynamicStaleTime === "number" && Number.isFinite(dynamicStaleTime) && dynamicStaleTime >= 0 ? dynamicStaleTime : void 0;
	const sourcePage = readSourcePageMetadata(elements[APP_SOURCE_PAGE_KEY]);
	return {
		artifactCompatibility,
		...cacheEntryReuseProof ? { cacheEntryReuseProof } : {},
		...dynamicStaleTimeSeconds === void 0 ? {} : { dynamicStaleTimeSeconds },
		interception,
		interceptionContext: interceptionContext ?? null,
		layoutIds,
		layoutFlags,
		routeId,
		rootLayoutTreePath,
		skippedLayoutIds,
		slotBindings,
		sourcePage
	};
}
const AppElementsWire = {
	keys: {
		artifactCompatibility: APP_ARTIFACT_COMPATIBILITY_KEY,
		cacheEntryReuseProof: APP_CACHE_ENTRY_REUSE_PROOF_KEY,
		dynamicStaleTime: APP_DYNAMIC_STALE_TIME_KEY,
		interception: APP_INTERCEPTION_KEY,
		interceptionContext: APP_INTERCEPTION_CONTEXT_KEY,
		layoutIds: APP_LAYOUT_IDS_KEY,
		layoutFlags: APP_LAYOUT_FLAGS_KEY,
		renderObservation: APP_RENDER_OBSERVATION_KEY,
		rootLayout: APP_ROOT_LAYOUT_KEY,
		route: APP_ROUTE_KEY,
		skippedLayoutIds: APP_SKIPPED_LAYOUT_IDS_KEY,
		slotBindings: APP_SLOT_BINDINGS_KEY,
		sourcePage: APP_SOURCE_PAGE_KEY
	},
	unmatchedSlotValue: APP_UNMATCHED_SLOT_WIRE_VALUE,
	createMetadataEntries: createAppElementsWireMetadataEntries,
	decode: normalizeAppElements,
	encodeCacheKey: createAppPayloadCacheKey,
	encodeLayoutId: createAppPayloadLayoutId,
	encodeOutgoingPayload: buildOutgoingAppPayload,
	encodePageId: createAppPayloadPageId,
	encodeRouteId: createAppPayloadRouteId,
	encodeSlotId: createAppPayloadSlotId,
	encodeTemplateId: createAppPayloadTemplateId,
	isSlotId: isAppElementsWireSlotId,
	parseElementKey: parseAppElementsWireElementKey,
	readMetadata: readAppElementsMetadata,
	withLayoutFlags
};
//#endregion
export { APP_ARTIFACT_COMPATIBILITY_KEY, APP_CACHE_ENTRY_REUSE_PROOF_KEY, APP_DYNAMIC_STALE_TIME_KEY, APP_INTERCEPTION_CONTEXT_KEY, APP_INTERCEPTION_KEY, APP_LAYOUT_FLAGS_KEY, APP_LAYOUT_IDS_KEY, APP_RENDER_OBSERVATION_KEY, APP_ROOT_LAYOUT_KEY, APP_ROUTE_KEY, APP_SKIPPED_LAYOUT_IDS_KEY, APP_SLOT_BINDINGS_KEY, APP_SOURCE_PAGE_KEY, APP_STATIC_SIBLINGS_KEY, APP_UNMATCHED_SLOT_WIRE_VALUE, AppElementsWire, UNMATCHED_SLOT, buildOutgoingAppPayload, compareAppElementsSlotIds, isAppElementsRecord, normalizeAppElements, normalizeAppElementsSlotBindings, readAppElementsMetadata, withLayoutFlags };
