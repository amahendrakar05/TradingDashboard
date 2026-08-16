import { ACTION_REVALIDATED_HEADER } from "./headers.js";
import { VINEXT_RSC_CONTENT_TYPE } from "./app-rsc-cache-busting.js";
//#region src/server/app-browser-action-result.ts
const ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC = 1;
const ACTION_DID_REVALIDATE_DYNAMIC_ONLY = 2;
/**
* Structural discriminator: matches on `"returnValue"` or `"root"` keys.
* This is safe because {@link AppWireElements} keys are prefixed (`route:`,
* `slot:`, `__route`, etc.) and will never collide with these property names.
* If the wire format ever adds a `"root"` key, this guard must be updated.
*/
function isServerActionResult(value) {
	return !!value && typeof value === "object" && ("returnValue" in value || "root" in value);
}
function shouldClearClientNavigationCachesForServerActionResult(result, revalidation = "none") {
	if (revalidation !== "none") return true;
	if (!isServerActionResult(result)) return true;
	return result.root !== void 0;
}
function parseServerActionRevalidationHeader(headers) {
	const value = headers.get(ACTION_REVALIDATED_HEADER);
	if (!value) return "none";
	let parsed;
	try {
		parsed = JSON.parse(value);
	} catch {
		return "none";
	}
	switch (parsed) {
		case ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC: return "staticAndDynamic";
		case ACTION_DID_REVALIDATE_DYNAMIC_ONLY: return "dynamicOnly";
		default: return "none";
	}
}
function resolveServerActionOperationLane(revalidation) {
	return revalidation === "none" ? "server-action" : "refresh";
}
function createServerActionHttpFallbackError(status) {
	if (status !== 401 && status !== 403 && status !== 404) return null;
	const digest = status === 404 ? "NEXT_HTTP_ERROR_FALLBACK;404" : `NEXT_HTTP_ERROR_FALLBACK;${status}`;
	const error = /* @__PURE__ */ new Error(status === 404 ? "NEXT_NOT_FOUND" : `NEXT_HTTP_ERROR_FALLBACK;${status}`);
	return Object.assign(error, { digest });
}
function normalizeServerActionThrownValue(data, responseStatus) {
	return createServerActionHttpFallbackError(responseStatus) ?? data;
}
function shouldSyncServerActionHttpFallbackHead(result) {
	if (!isServerActionResult(result) || result.root !== void 0) return false;
	return result.returnValue?.ok !== false;
}
async function readInvalidServerActionResponseError(response, hasRedirectLocation) {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.startsWith("text/x-component") || hasRedirectLocation) return null;
	const message = response.status >= 400 && contentType.toLowerCase().startsWith("text/plain") ? await response.text() : "An unexpected response was received from the server.";
	return new Error(message || "An unexpected response was received from the server.");
}
/**
* Converts raw browser response data into the narrow facts expected by the
* navigation planner. This is the single place where redirect-type
* normalisation and RSC content-type detection happen for server-action
* compatibility checks.
*/
function createServerActionResultFacts(input) {
	return {
		actionRedirectHref: input.actionRedirectHref,
		actionRedirectType: input.actionRedirectType === "push" ? "push" : "replace",
		clientCompatibilityId: input.clientCompatibilityId,
		compatibilityIdHeader: input.compatibilityIdHeader,
		currentHref: input.currentHref,
		isRscContentType: (input.contentTypeHeader ?? "").startsWith(VINEXT_RSC_CONTENT_TYPE),
		origin: input.origin,
		responseUrl: input.responseUrl
	};
}
function shouldScheduleRefreshForDiscardedServerAction(revalidation) {
	return revalidation !== "none";
}
function createServerActionInitiationSnapshot(options) {
	const url = options.origin === void 0 ? new URL(options.href) : new URL(options.href, options.origin);
	return {
		href: url.href,
		navigationId: options.navigationId,
		path: url.pathname + url.search,
		routerState: options.routerState
	};
}
function createDiscardedServerActionRefreshScheduler(options) {
	const queueTask = options.queueTask ?? queueMicrotask;
	let activeNavigationCount = 0;
	let flushQueued = false;
	let refreshPending = false;
	function flush() {
		flushQueued = false;
		if (!refreshPending || activeNavigationCount > 0) return;
		refreshPending = false;
		options.runRefresh();
	}
	function queueFlush() {
		if (flushQueued) return;
		flushQueued = true;
		queueTask(flush);
	}
	return {
		markNavigationSettled() {
			if (activeNavigationCount > 0) activeNavigationCount -= 1;
			queueFlush();
		},
		markNavigationStart() {
			activeNavigationCount += 1;
		},
		schedule() {
			refreshPending = true;
			queueFlush();
		}
	};
}
//#endregion
export { createDiscardedServerActionRefreshScheduler, createServerActionInitiationSnapshot, createServerActionResultFacts, isServerActionResult, normalizeServerActionThrownValue, parseServerActionRevalidationHeader, readInvalidServerActionResponseError, resolveServerActionOperationLane, shouldClearClientNavigationCachesForServerActionResult, shouldScheduleRefreshForDiscardedServerAction, shouldSyncServerActionHttpFallbackHead };
