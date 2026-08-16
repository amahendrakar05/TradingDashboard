import { APP_ARTIFACT_COMPATIBILITY_KEY, APP_CACHE_ENTRY_REUSE_PROOF_KEY, APP_DYNAMIC_STALE_TIME_KEY, APP_INTERCEPTION_CONTEXT_KEY, APP_INTERCEPTION_KEY, APP_LAYOUT_FLAGS_KEY, APP_LAYOUT_IDS_KEY, APP_RENDER_OBSERVATION_KEY, APP_ROOT_LAYOUT_KEY, APP_ROUTE_KEY, APP_SKIPPED_LAYOUT_IDS_KEY, APP_SLOT_BINDINGS_KEY, APP_SOURCE_PAGE_KEY, APP_STATIC_SIBLINGS_KEY, APP_UNMATCHED_SLOT_WIRE_VALUE, AppElementsWire, UNMATCHED_SLOT, buildOutgoingAppPayload, compareAppElementsSlotIds, isAppElementsRecord, normalizeAppElements, normalizeAppElementsSlotBindings, readAppElementsMetadata, withLayoutFlags } from "./app-elements-wire.js";
import { normalizeMountedSlotsHeader } from "./app-mounted-slots-header.js";
//#region src/server/app-elements.ts
const APP_PREFETCH_LOADING_SHELL_MARKER_KEY = "__prefetchLoadingShell";
function getMountedSlotIds(elements) {
	return Object.keys(elements).filter((key) => {
		const value = elements[key];
		const parsed = AppElementsWire.parseElementKey(key);
		return parsed?.kind === "slot" && parsed.name !== "children" && value !== null && value !== void 0 && value !== UNMATCHED_SLOT;
	}).sort();
}
function getMountedSlotIdsHeader(elements) {
	return normalizeMountedSlotsHeader(getMountedSlotIds(elements).join(" "));
}
function resolveVisitedResponseInterceptionContext(requestInterceptionContext, payloadInterceptionContext) {
	return payloadInterceptionContext ?? requestInterceptionContext;
}
//#endregion
export { APP_ARTIFACT_COMPATIBILITY_KEY, APP_CACHE_ENTRY_REUSE_PROOF_KEY, APP_DYNAMIC_STALE_TIME_KEY, APP_INTERCEPTION_CONTEXT_KEY, APP_INTERCEPTION_KEY, APP_LAYOUT_FLAGS_KEY, APP_LAYOUT_IDS_KEY, APP_PREFETCH_LOADING_SHELL_MARKER_KEY, APP_RENDER_OBSERVATION_KEY, APP_ROOT_LAYOUT_KEY, APP_ROUTE_KEY, APP_SKIPPED_LAYOUT_IDS_KEY, APP_SLOT_BINDINGS_KEY, APP_SOURCE_PAGE_KEY, APP_STATIC_SIBLINGS_KEY, APP_UNMATCHED_SLOT_WIRE_VALUE, AppElementsWire, UNMATCHED_SLOT, buildOutgoingAppPayload, compareAppElementsSlotIds, getMountedSlotIds, getMountedSlotIdsHeader, isAppElementsRecord, normalizeAppElements, normalizeAppElementsSlotBindings, readAppElementsMetadata, resolveVisitedResponseInterceptionContext, withLayoutFlags };
