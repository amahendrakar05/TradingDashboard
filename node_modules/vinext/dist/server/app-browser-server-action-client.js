import { hasBasePath } from "../utils/base-path.js";
import { ACTION_REDIRECT_HEADER, ACTION_REDIRECT_STATUS_HEADER } from "./headers.js";
import { DANGEROUS_URL_BLOCK_MESSAGE, isDangerousScheme } from "../shims/url-safety.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import { VINEXT_RSC_COMPATIBILITY_ID_HEADER, createServerActionRequestUrl } from "./app-rsc-cache-busting.js";
import { createServerActionResultFacts, isServerActionResult, normalizeServerActionThrownValue, parseServerActionRevalidationHeader, readInvalidServerActionResponseError, shouldClearClientNavigationCachesForServerActionResult, shouldSyncServerActionHttpFallbackHead } from "./app-browser-action-result.js";
import { resolveServerActionRequestState } from "./app-browser-state.js";
import { applyServerActionResultDecision } from "./app-browser-server-action-navigation.js";
import { throwOnServerActionNotFound } from "./server-action-not-found.js";
import { createFromFetch, createTemporaryReferenceSet, encodeReply } from "@vitejs/plugin-rsc/browser";
//#region src/server/app-browser-server-action-client.ts
function resolveActionRedirectTarget(response, basePath, performHardNavigation) {
	const actionRedirect = response.headers.get(ACTION_REDIRECT_HEADER);
	if (!actionRedirect) return null;
	if (isDangerousScheme(actionRedirect)) {
		console.error(DANGEROUS_URL_BLOCK_MESSAGE);
		return null;
	}
	try {
		let redirectUrl;
		if (actionRedirect.startsWith("/") || /^[a-z]+:/i.test(actionRedirect)) redirectUrl = new URL(actionRedirect, window.location.href);
		else {
			const baseParsed = new URL(window.location.href);
			let baseDir = baseParsed.pathname;
			if (!baseDir.endsWith("/")) baseDir += "/";
			redirectUrl = new URL(actionRedirect, `${baseParsed.origin}${baseDir}${baseParsed.search}`);
		}
		if (redirectUrl.origin !== window.location.origin || basePath !== "" && !hasBasePath(redirectUrl.pathname, basePath)) {
			performHardNavigation(actionRedirect);
			return null;
		}
		const statusHeader = response.headers.get(ACTION_REDIRECT_STATUS_HEADER);
		return {
			href: redirectUrl.href,
			type: response.headers.get("x-action-redirect-type") ?? "push",
			status: statusHeader ? parseInt(statusHeader, 10) : 307
		};
	} catch {
		performHardNavigation(actionRedirect);
		return null;
	}
}
var ServerActionRedirectError = class extends Error {
	digest;
	handled = true;
	constructor(target) {
		super("NEXT_REDIRECT");
		const redirectUrl = new URL(target.href, window.location.href);
		const redirectHref = redirectUrl.pathname + redirectUrl.search + redirectUrl.hash;
		const redirectType = target.type === "push" ? "push" : "replace";
		this.digest = `NEXT_REDIRECT;${redirectType};${redirectHref};${target.status};`;
	}
};
async function invokeClientServerAction(id, args, actionInitiation, deps) {
	deps.syncServerActionHttpFallbackHead(null);
	const temporaryReferences = createTemporaryReferenceSet();
	deps.syncCurrentHistoryState(actionInitiation.routerState.previousNextUrl, actionInitiation.routerState.bfcacheIds);
	const body = await encodeReply(args, { temporaryReferences });
	const headers = resolveServerActionRequestState({
		actionId: id,
		basePath: deps.basePath,
		elements: actionInitiation.routerState.elements,
		interceptionContext: actionInitiation.routerState.interception !== null ? actionInitiation.routerState.interceptionContext : null,
		previousNextUrl: actionInitiation.routerState.previousNextUrl
	}).headers;
	const fetchResponse = await fetch(createServerActionRequestUrl(actionInitiation.path), {
		method: "POST",
		headers,
		body
	});
	throwOnServerActionNotFound(fetchResponse, id);
	const hasActionRedirect = fetchResponse.headers.has(ACTION_REDIRECT_HEADER);
	const actionRedirectTarget = resolveActionRedirectTarget(fetchResponse, deps.basePath, (url, historyMode) => deps.performHardNavigation(url, historyMode));
	if (hasActionRedirect && !actionRedirectTarget) return void 0;
	const actionResultFacts = createServerActionResultFacts({
		actionRedirectHref: actionRedirectTarget?.href ?? null,
		actionRedirectType: actionRedirectTarget?.type ?? null,
		clientCompatibilityId: deps.clientRscCompatibilityId,
		compatibilityIdHeader: fetchResponse.headers.get(VINEXT_RSC_COMPATIBILITY_ID_HEADER),
		contentTypeHeader: fetchResponse.headers.get("content-type"),
		currentHref: actionInitiation.href,
		origin: window.location.origin,
		responseUrl: fetchResponse.url
	});
	const fetchResponseIsRsc = actionResultFacts.isRscContentType;
	if (applyServerActionResultDecision(deps.navigationPlanner.classifyServerActionResult(actionResultFacts), () => deps.clearClientNavigationCaches(), (url, historyMode) => deps.performHardNavigation(url, historyMode))) return;
	const revalidation = parseServerActionRevalidationHeader(fetchResponse.headers);
	if (revalidation !== "none") deps.clearClientNavigationCaches();
	const invalidResponseError = await readInvalidServerActionResponseError(fetchResponse.clone(), actionRedirectTarget !== null);
	if (invalidResponseError) throw invalidResponseError;
	if (actionRedirectTarget && !fetchResponseIsRsc) {
		deps.performHardNavigation(actionRedirectTarget.href);
		return;
	}
	const flightResponse = fetchResponse.status === 303 ? new Response(fetchResponse.body, {
		headers: fetchResponse.headers,
		status: 200,
		statusText: "OK"
	}) : fetchResponse;
	const result = await createFromFetch(Promise.resolve(flightResponse), { temporaryReferences });
	if (revalidation === "none" && shouldClearClientNavigationCachesForServerActionResult(result, revalidation)) deps.clearClientNavigationCaches();
	if (actionRedirectTarget) {
		if (isServerActionResult(result) && result.root !== void 0) {
			deps.renderRedirectPayload(AppElementsWire.decode(result.root), actionRedirectTarget, actionInitiation, revalidation);
			throw new ServerActionRedirectError(actionRedirectTarget);
		}
		deps.performHardNavigation(actionRedirectTarget.href);
		return;
	}
	deps.syncServerActionHttpFallbackHead(shouldSyncServerActionHttpFallbackHead(result) ? fetchResponse.status : null);
	if (isServerActionResult(result)) {
		if (result.root !== void 0) {
			const returnValue = result.returnValue && !result.returnValue.ok ? {
				ok: false,
				data: normalizeServerActionThrownValue(result.returnValue.data, fetchResponse.status)
			} : result.returnValue;
			return deps.commitSameUrlNavigatePayload(Promise.resolve(AppElementsWire.decode(result.root)), actionInitiation, returnValue, revalidation);
		}
		if (result.returnValue) {
			if (!result.returnValue.ok) throw normalizeServerActionThrownValue(result.returnValue.data, fetchResponse.status);
			return result.returnValue.data;
		}
		return;
	}
	return deps.commitSameUrlNavigatePayload(Promise.resolve(AppElementsWire.decode(result)), actionInitiation, void 0, revalidation);
}
//#endregion
export { invokeClientServerAction };
