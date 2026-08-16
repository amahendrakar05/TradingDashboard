import { splitPathSegments } from "../routing/utils.js";
import { addBasePathToPathname, hasBasePath, stripBasePath } from "../utils/base-path.js";
import { ACTION_FORWARDED_HEADER, ACTION_REDIRECT_HEADER, ACTION_REDIRECT_STATUS_HEADER, ACTION_REDIRECT_TYPE_HEADER, ACTION_REVALIDATED_HEADER } from "./headers.js";
import { isExternalUrl } from "../utils/external-url.js";
import { internalServerErrorResponse, payloadTooLargeResponse } from "./http-error-responses.js";
import { validateCsrfOrigin, validateServerActionPayload } from "./request-pipeline.js";
import { APP_RSC_RENDER_MODE_NAVIGATION } from "./app-rsc-render-mode.js";
import { headersContextFromRequest, isDraftModeRequest, setHeadersContext } from "../shims/headers.js";
import { _drainPendingRevalidations, getAndClearActionRevalidationKind } from "../shims/cache-request-state.js";
import { setCurrentFetchCacheMode, setCurrentFetchSoftTags, setCurrentForceDynamicFetchDefault } from "../shims/fetch-cache.js";
import { readStreamAsTextWithLimit } from "../utils/text-stream.js";
import { VINEXT_RSC_CONTENT_TYPE, VINEXT_RSC_VARY_HEADER, applyRscCompatibilityIdHeader } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { applyEdgeRuntimeHeader } from "./app-page-response.js";
import { getNextErrorDigest, parseNextHttpErrorDigest, parseNextRedirectDigest } from "./next-error-digest.js";
import { createServerActionNotFoundResponse, getServerActionNotFoundMessage, isServerActionNotFoundError } from "./server-action-not-found.js";
import { resolveAppPageNavigationParams } from "./app-page-element-builder.js";
import { deferUntilStreamConsumed } from "./defer-until-stream-consumed.js";
import "./app-page-stream.js";
import { buildAppPageTags } from "./implicit-tags.js";
import { resolveAppPageActionRerenderTarget } from "./app-page-request.js";
import { createRootParamsUsageController, pickRootParams, runWithRootParamsScope, runWithRootParamsUsage } from "../shims/root-params.js";
import { getSetCookieName } from "./cookie-utils.js";
import { createStaticGenerationHeadersContext } from "./app-static-generation.js";
//#region src/server/app-server-action-execution.ts
function prepareActionPageRerenderContext(options) {
	if (options.dynamicConfig === "force-static" || options.dynamicConfig === "error") setHeadersContext(createStaticGenerationHeadersContext({
		draftModeEnabled: isDraftModeRequest(createActionRerenderRequest({
			draftModeCookie: options.draftModeCookie,
			request: options.request
		}), options.draftModeSecret),
		draftModeSecret: options.draftModeSecret,
		dynamicConfig: options.dynamicConfig,
		routeKind: "page",
		routePattern: options.routePattern
	}));
	return options.dynamicConfig === "force-static" ? new URLSearchParams() : options.searchParams;
}
function createActionRerenderRequest(options) {
	if (!options.draftModeCookie) return options.request;
	const headers = new Headers(options.request.headers);
	const cookieHeader = applySetCookieMutationsToRequestCookieHeader(headers.get("cookie"), [options.draftModeCookie]);
	if (cookieHeader === null) headers.delete("cookie");
	else headers.set("cookie", cookieHeader);
	return new Request(options.request.url, { headers });
}
/**
* Matches Next.js' server action argument cap to prevent stack overflow in
* Function.prototype.apply when decoding hostile action payloads.
*/
const SERVER_ACTION_ARGS_LIMIT = 1e3;
const ACTION_DID_NOT_REVALIDATE = 0;
const ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC = 1;
const ACTION_REDIRECT_RENDER_STRIPPED_HEADERS = [
	"accept",
	"content-length",
	"content-type",
	"next-action",
	"origin",
	"rsc",
	"x-action-forwarded",
	"x-rsc-action"
];
function setActionRevalidatedHeader(headers, kind) {
	if (kind === ACTION_DID_NOT_REVALIDATE) return;
	headers.set(ACTION_REVALIDATED_HEADER, JSON.stringify(kind));
}
function resolveActionRevalidationKind(hasModifiedCookies) {
	const revalidationKind = getAndClearActionRevalidationKind();
	if (hasModifiedCookies) return ACTION_DID_REVALIDATE_STATIC_AND_DYNAMIC;
	return revalidationKind;
}
function clearRejectedActionSideEffects(getAndClearPendingCookies) {
	getAndClearPendingCookies();
	getAndClearActionRevalidationKind();
}
function cloneActionRedirectHeaders(requestHeaders) {
	const headers = new Headers(requestHeaders);
	for (const header of ACTION_REDIRECT_RENDER_STRIPPED_HEADERS) headers.delete(header);
	return headers;
}
function readSetCookieNameValue(setCookie) {
	const equalsIndex = setCookie.indexOf("=");
	if (equalsIndex <= 0) return null;
	const name = setCookie.slice(0, equalsIndex).trim();
	const valueEnd = setCookie.indexOf(";", equalsIndex + 1);
	return {
		name,
		value: setCookie.slice(equalsIndex + 1, valueEnd === -1 ? void 0 : valueEnd)
	};
}
function isExpiredSetCookie(setCookie) {
	return /(?:^|;\s*)max-age=0(?:;|$)/i.test(setCookie) || /(?:^|;\s*)expires=Thu,\s*0?1[\s-]+Jan[\s-]+1970/i.test(setCookie);
}
function applySetCookieMutationsToRequestCookieHeader(cookieHeader, setCookies) {
	const cookies = /* @__PURE__ */ new Map();
	if (cookieHeader) for (const part of cookieHeader.split(";")) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		const equalsIndex = trimmed.indexOf("=");
		if (equalsIndex <= 0) continue;
		cookies.set(trimmed.slice(0, equalsIndex), trimmed.slice(equalsIndex + 1));
	}
	for (const setCookie of setCookies) {
		const entry = readSetCookieNameValue(setCookie);
		if (!entry) continue;
		if (isExpiredSetCookie(setCookie)) cookies.delete(entry.name);
		else cookies.set(entry.name, entry.value);
	}
	return cookies.size === 0 ? null : [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}
function createActionRedirectRenderRequest(options) {
	const headers = cloneActionRedirectHeaders(options.request.headers);
	const cookieHeader = applySetCookieMutationsToRequestCookieHeader(headers.get("cookie"), options.pendingCookies);
	if (cookieHeader === null) headers.delete("cookie");
	else headers.set("cookie", cookieHeader);
	return new Request(options.url, {
		headers,
		method: "GET"
	});
}
function withoutRscBodyHeaders(headers) {
	const nextHeaders = new Headers(headers);
	nextHeaders.delete("Content-Type");
	nextHeaders.delete("Vary");
	return nextHeaders;
}
function isReadableStreamBody(body) {
	return typeof ReadableStream !== "undefined" && body instanceof ReadableStream;
}
function createServerActionRscResponse(body, init, clearRequestContext) {
	if (!isReadableStreamBody(body)) {
		clearRequestContext();
		return new Response(body, init);
	}
	return new Response(deferUntilStreamConsumed(body, clearRequestContext), init);
}
function isRequestBodyTooLarge(error) {
	return error instanceof Error && error.message === "Request body too large";
}
/**
* Build the error thrown when a server-action request body exceeds the
* configured size limit. Matches Next.js' `Body exceeded {limit} limit.`
* message + docs link (action-handler.ts) verbatim — including the original
* config string (e.g. "2mb") — so it reads identically in logs.
*/
function createBodyExceededError(limitLabel) {
	return /* @__PURE__ */ new Error(`Body exceeded ${limitLabel} limit.\nTo configure the body size limit for Server Actions, see: https://nextjs.org/docs/app/api-reference/next-config-js/serverActions#bodysizelimit`);
}
/**
* Collapse repeated `cookies().set(name, ...)` / `cookies().delete(name)`
* calls down to the last value per name, matching Next.js'
* `MutableRequestCookiesAdapter` semantics. Next.js stores response cookies in
* a `ResponseCookies` Map keyed by name — multiple sets for the same cookie
* collapse to the final value, and emit a single Set-Cookie header.
*
* Insertion order is preserved by first occurrence (Map iteration order),
* which mirrors how `ResponseCookies` iterates its underlying Map. See
* packages/next/src/server/web/spec-extension/adapters/request-cookies.ts.
* Issue: https://github.com/cloudflare/vinext/issues/1481
*/
function dedupePendingCookies(cookies) {
	if (cookies.length <= 1) return cookies.slice();
	const byName = /* @__PURE__ */ new Map();
	const unkeyed = [];
	for (const cookie of cookies) {
		const name = getSetCookieName(cookie);
		if (name === null) {
			unkeyed.push(cookie);
			continue;
		}
		byName.set(name, cookie);
	}
	return [...unkeyed, ...byName.values()];
}
function isAppServerActionFunction(action) {
	return typeof action === "function";
}
function normalizeError(error) {
	return error instanceof Error ? error : new Error(String(error));
}
function getServerActionFailureMessage(error) {
	return error instanceof Error && error.message ? error.message : String(error);
}
function validateServerActionArgs(args) {
	if (args.length > SERVER_ACTION_ARGS_LIMIT) throw new Error(`Server Action arguments list is too long (${args.length}). Maximum allowed is ${SERVER_ACTION_ARGS_LIMIT}.`);
}
async function readActionBodyWithLimit(request, maxBytes) {
	if (!request.body) return "";
	return readStreamAsTextWithLimit(request.body, maxBytes, () => {
		throw new Error("Request body too large");
	});
}
async function readActionFormDataWithLimit(request, maxBytes) {
	if (!request.body) return new FormData();
	const reader = request.body.getReader();
	const chunks = [];
	let totalSize = 0;
	for (;;) {
		const result = await reader.read();
		if (result.done) break;
		totalSize += result.value.byteLength;
		if (totalSize > maxBytes) {
			reader.cancel();
			throw new Error("Request body too large");
		}
		chunks.push(result.value);
	}
	const combined = new Uint8Array(totalSize);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new Response(combined, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
}
function getActionRedirect(error) {
	const digest = getNextErrorDigest(error);
	if (!digest) return null;
	const redirect = parseNextRedirectDigest(digest);
	if (!redirect) return null;
	return {
		status: redirect.status,
		type: redirect.type ?? "push",
		url: redirect.url
	};
}
/**
* Prepend the configured next.config `basePath` to a server-action redirect
* target before it goes on the wire.
*
* `redirect("/foo")` called from a server action mounted at `/base/...` must
* land the browser at `/base/foo`, mirroring how Next.js threads basePath
* through `addPathPrefix(getURLFromRedirectError(err), basePath)` in
* `app-render.tsx` for SSR redirects and in `action-handler.ts` for action
* redirects.
*
* Idempotent and external-aware:
*  - Empty basePath → returned unchanged.
*  - External URLs (`http://`, `https://`, `data:`, protocol-relative `//`)
*    are returned unchanged because the framework does not own those routes.
*  - Targets that already start with the configured basePath are returned
*    unchanged so this helper can be applied at any layer without risk of
*    double-prefixing (`/base/base/foo`).
*
* Exported for tests. Used by both the progressive (no-JS form POST) and
* RSC (`ACTION_REDIRECT_HEADER`) action redirect paths below.
*
* @see https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/action-handler.ts
*/
function applyActionRedirectBasePath(url, basePath) {
	if (!basePath) return url;
	if (isExternalUrl(url)) return url;
	if (hasBasePath(url, basePath)) return url;
	if (!url.startsWith("/")) return url;
	const queryIndex = url.indexOf("?");
	const hashIndex = url.indexOf("#");
	const splitAt = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
	const pathname = splitAt === -1 ? url : url.slice(0, splitAt);
	const suffix = splitAt === -1 ? "" : url.slice(splitAt);
	return `${addBasePathToPathname(pathname, basePath)}${suffix}`;
}
function buildServerActionPageTags(route, pathname) {
	return buildAppPageTags(pathname, [], route.routeSegments ?? []);
}
function resolveInternalActionRedirectTarget(redirectUrl, requestUrl, basePath) {
	if (isExternalUrl(redirectUrl)) {
		const requestOrigin = new URL(requestUrl).origin;
		const parsed = new URL(redirectUrl);
		if (parsed.origin !== requestOrigin) return null;
		if (basePath && !hasBasePath(parsed.pathname, basePath)) return null;
		return parsed;
	}
	let resolvedBase = requestUrl;
	if (!redirectUrl.startsWith("/") && !/^[a-z]+:/i.test(redirectUrl)) {
		const parsedRequestUrl = new URL(requestUrl);
		let pathname = parsedRequestUrl.pathname;
		if (!pathname.endsWith("/")) pathname = pathname + "/";
		resolvedBase = `${parsedRequestUrl.origin}${pathname}${parsedRequestUrl.search}`;
	}
	return new URL(redirectUrl, resolvedBase);
}
function isAncestorRouteRedirect(targetPathname, currentPathname) {
	return targetPathname !== "/" && currentPathname.startsWith(`${targetPathname}/`);
}
function isStaleChildSiblingRouteRedirect(targetPathname, currentPathname) {
	const targetSegments = splitPathSegments(targetPathname);
	const currentSegments = splitPathSegments(currentPathname);
	if (targetSegments.length === 0 || currentSegments.length <= targetSegments.length) return false;
	let commonPrefixLength = 0;
	const maxPrefixLength = Math.min(targetSegments.length, currentSegments.length);
	while (commonPrefixLength < maxPrefixLength && targetSegments[commonPrefixLength] === currentSegments[commonPrefixLength]) commonPrefixLength++;
	return commonPrefixLength > 0 && commonPrefixLength < targetSegments.length;
}
function normalizeRuntime(runtime) {
	if (runtime === "edge" || runtime === "experimental-edge") return "edge";
	return "nodejs";
}
function shouldUseForwardedActionRedirectStatus(options) {
	if (options.actionWasForwarded) return true;
	if (isAncestorRouteRedirect(options.targetPathname, options.currentPathname)) return true;
	if (isStaleChildSiblingRouteRedirect(options.targetPathname, options.currentPathname)) return true;
	if (!options.currentRoute || !options.resolveRouteRuntime) return false;
	return normalizeRuntime(options.resolveRouteRuntime(options.currentRoute)) !== normalizeRuntime(options.resolveRouteRuntime(options.targetRoute));
}
function canRenderActionRedirectTarget(route) {
	if ("routeHandler" in route && route.routeHandler) return false;
	return route.page !== null && route.page !== void 0;
}
function getActionHttpFallbackStatus(error) {
	const digest = getNextErrorDigest(error);
	if (!digest) return null;
	const httpError = parseNextHttpErrorDigest(digest);
	if (!httpError || !Number.isInteger(httpError.status)) return null;
	return httpError.status;
}
function createServerActionErrorResponse(error, options) {
	options.getAndClearPendingCookies();
	console.error("[vinext] Server action error:", error);
	options.reportRequestError(normalizeError(error), {
		path: options.cleanPathname,
		method: options.request.method,
		headers: Object.fromEntries(options.request.headers.entries())
	}, {
		routerKind: "App Router",
		routePath: options.cleanPathname,
		routeType: "action"
	});
	options.clearRequestContext();
	return internalServerErrorResponse(process.env.NODE_ENV === "production" ? void 0 : "Server action failed: " + getServerActionFailureMessage(error));
}
function createActionNotFoundResponse(actionId, options) {
	options.getAndClearPendingCookies();
	console.warn(getServerActionNotFoundMessage(actionId));
	options.clearRequestContext();
	return createServerActionNotFoundResponse();
}
function isProgressiveServerActionRequest(request, contentType, actionId) {
	return request.method.toUpperCase() === "POST" && contentType.startsWith("multipart/form-data") && !actionId;
}
async function handleProgressiveServerActionRequest(options) {
	if (!isProgressiveServerActionRequest(options.request, options.contentType, options.actionId)) return null;
	const csrfResponse = validateCsrfOrigin(options.request, options.allowedOrigins);
	if (csrfResponse) return csrfResponse;
	if (parseInt(options.request.headers.get("content-length") || "0", 10) > options.maxActionBodySize) {
		options.clearRequestContext();
		return payloadTooLargeResponse();
	}
	try {
		let body;
		try {
			body = await options.readFormDataWithLimit(options.request.clone(), options.maxActionBodySize);
		} catch (error) {
			if (isRequestBodyTooLarge(error)) {
				options.clearRequestContext();
				return payloadTooLargeResponse();
			}
			throw error;
		}
		const payloadResponse = await validateServerActionPayload(body);
		if (payloadResponse) {
			clearRejectedActionSideEffects(options.getAndClearPendingCookies);
			options.clearRequestContext();
			return payloadResponse;
		}
		const action = await options.decodeAction(body);
		if (!isAppServerActionFunction(action)) {
			if (options.hasPageRoute) return createActionNotFoundResponse(null, {
				clearRequestContext: options.clearRequestContext,
				getAndClearPendingCookies: options.getAndClearPendingCookies
			});
			return null;
		}
		let actionRedirect = null;
		let actionError = void 0;
		let actionFailed = false;
		let actionThrew = false;
		let actionResult;
		const rootParamsUsage = createRootParamsUsageController();
		const previousHeadersPhase = options.setHeadersAccessPhase("action");
		try {
			actionResult = await runWithRootParamsUsage({ kind: "server-action" }, action, rootParamsUsage);
		} catch (error) {
			actionThrew = true;
			actionRedirect = getActionRedirect(error);
			if (!actionRedirect) {
				actionError = error;
				actionFailed = true;
				if (!(getActionHttpFallbackStatus(error) !== null || isServerActionNotFoundError(error, null))) {
					console.error("[vinext] Server action error:", error);
					options.reportRequestError(normalizeError(error), {
						path: options.cleanPathname,
						method: options.request.method,
						headers: Object.fromEntries(options.request.headers.entries())
					}, {
						routerKind: "App Router",
						routePath: options.cleanPathname,
						routeType: "action"
					});
				}
			}
		} finally {
			options.setHeadersAccessPhase(previousHeadersPhase);
			if (actionThrew) rootParamsUsage.transitionToRender();
		}
		await _drainPendingRevalidations();
		if (!actionRedirect) {
			if (!actionThrew) rootParamsUsage.transitionToRender();
			const actionPendingCookies = dedupePendingCookies(options.getAndClearPendingCookies());
			const actionDraftCookie = options.getDraftModeCookieHeader();
			const revalidationKind = resolveActionRevalidationKind(actionPendingCookies.length > 0 || Boolean(actionDraftCookie));
			if (actionFailed) return {
				kind: "form-state",
				formState: null,
				actionError,
				actionFailed,
				pendingCookies: actionPendingCookies,
				draftCookie: actionDraftCookie,
				revalidationKind
			};
			return {
				kind: "form-state",
				formState: await options.decodeFormState(actionResult, body) ?? null,
				pendingCookies: actionPendingCookies,
				draftCookie: actionDraftCookie,
				revalidationKind
			};
		}
		const actionPendingCookies = dedupePendingCookies(options.getAndClearPendingCookies());
		const actionDraftCookie = options.getDraftModeCookieHeader();
		const actionRevalidationKind = resolveActionRevalidationKind(actionPendingCookies.length > 0 || Boolean(actionDraftCookie));
		options.clearRequestContext();
		const headers = new Headers();
		const prefixedRedirectUrl = applyActionRedirectBasePath(actionRedirect.url, options.basePath ?? "");
		headers.set("Location", new URL(prefixedRedirectUrl, options.request.url).toString());
		mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders);
		for (const cookie of actionPendingCookies) headers.append("Set-Cookie", cookie);
		if (actionDraftCookie) headers.append("Set-Cookie", actionDraftCookie);
		setActionRevalidatedHeader(headers, actionRevalidationKind);
		return new Response(null, {
			status: 303,
			headers
		});
	} catch (error) {
		if (isServerActionNotFoundError(error, null)) return createActionNotFoundResponse(null, {
			clearRequestContext: options.clearRequestContext,
			getAndClearPendingCookies: options.getAndClearPendingCookies
		});
		getAndClearActionRevalidationKind();
		options.getAndClearPendingCookies();
		console.error("[vinext] Server action payload parsing error:", error);
		options.reportRequestError(normalizeError(error), {
			path: options.cleanPathname,
			method: options.request.method,
			headers: Object.fromEntries(options.request.headers.entries())
		}, {
			routerKind: "App Router",
			routePath: options.cleanPathname,
			routeType: "action"
		});
		options.clearRequestContext();
		return internalServerErrorResponse(process.env.NODE_ENV === "production" ? void 0 : "Server action parsing failed: " + getServerActionFailureMessage(error));
	}
}
/**
* Render the response for a fetch (client-invoked) server action whose request
* body exceeds the configured `serverActions.bodySizeLimit`.
*
* Next.js does not return a bare 413 here: it throws the body-exceeded error
* before the action runs, then — for fetch actions — emits a Flight response
* with status 500 carrying the rejected action result, so the nearest client
* error boundary catches it (see action-handler.ts, the `isFetchAction` branch
* of the generic error path). vinext mirrors that by rendering a Flight stream
* with `returnValue: { ok: false }` and no page root (the action never ran, so
* nothing was revalidated and the page render is skipped). A bare 413 plain
* response would bypass the boundary and surface the wrong status/content-type.
*/
async function renderFetchActionBodyExceededResponse(options) {
	const error = createBodyExceededError(options.maxActionBodySizeLabel);
	console.error("[vinext] Server action error:", error);
	options.reportRequestError(normalizeError(error), {
		path: options.cleanPathname,
		method: options.request.method,
		headers: Object.fromEntries(options.request.headers.entries())
	}, {
		routerKind: "App Router",
		routePath: options.cleanPathname,
		routeType: "action"
	});
	getAndClearActionRevalidationKind();
	options.getAndClearPendingCookies();
	const returnValue = {
		ok: false,
		data: options.sanitizeErrorForClient(error)
	};
	const temporaryReferences = options.createTemporaryReferenceSet();
	const onRenderError = options.createRscOnErrorHandler(options.request, options.cleanPathname, options.cleanPathname);
	const rscStream = await options.renderToReadableStream({ returnValue }, {
		temporaryReferences,
		onError: onRenderError
	});
	const headers = new Headers({
		"Content-Type": VINEXT_RSC_CONTENT_TYPE,
		Vary: VINEXT_RSC_VARY_HEADER
	});
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	mergeMiddlewareResponseHeaders(headers, options.middlewareHeaders);
	applyRscCompatibilityIdHeader(headers);
	return createServerActionRscResponse(rscStream, {
		status: 500,
		headers
	}, options.clearRequestContext);
}
async function handleServerActionRscRequest(options) {
	if (options.request.method.toUpperCase() !== "POST" || !options.actionId) return null;
	const csrfResponse = validateCsrfOrigin(options.request, options.allowedOrigins);
	if (csrfResponse) return csrfResponse;
	if (parseInt(options.request.headers.get("content-length") || "0", 10) > options.maxActionBodySize) {
		if (options.request.body) options.request.body.cancel().catch(() => {});
		return renderFetchActionBodyExceededResponse(options);
	}
	try {
		let action;
		if (options.contentType.startsWith("multipart/form-data")) {
			let loadedAction;
			try {
				loadedAction = await options.loadServerAction(options.actionId);
			} catch (error) {
				if (isServerActionNotFoundError(error, options.actionId)) return createActionNotFoundResponse(options.actionId, {
					clearRequestContext: options.clearRequestContext,
					getAndClearPendingCookies: options.getAndClearPendingCookies
				});
				throw error;
			}
			if (!isAppServerActionFunction(loadedAction)) return createActionNotFoundResponse(options.actionId, {
				clearRequestContext: options.clearRequestContext,
				getAndClearPendingCookies: options.getAndClearPendingCookies
			});
			action = loadedAction;
		}
		let body;
		try {
			body = options.contentType.startsWith("multipart/form-data") ? await options.readFormDataWithLimit(options.request, options.maxActionBodySize) : await options.readBodyWithLimit(options.request, options.maxActionBodySize);
		} catch (error) {
			if (isRequestBodyTooLarge(error)) return renderFetchActionBodyExceededResponse(options);
			throw error;
		}
		const payloadResponse = await validateServerActionPayload(body);
		if (payloadResponse) {
			clearRejectedActionSideEffects(options.getAndClearPendingCookies);
			options.clearRequestContext();
			return payloadResponse;
		}
		if (action === void 0) {
			let loadedAction;
			try {
				loadedAction = await options.loadServerAction(options.actionId);
			} catch (error) {
				if (isServerActionNotFoundError(error, options.actionId)) return createActionNotFoundResponse(options.actionId, {
					clearRequestContext: options.clearRequestContext,
					getAndClearPendingCookies: options.getAndClearPendingCookies
				});
				throw error;
			}
			if (!isAppServerActionFunction(loadedAction)) return createActionNotFoundResponse(options.actionId, {
				clearRequestContext: options.clearRequestContext,
				getAndClearPendingCookies: options.getAndClearPendingCookies
			});
			action = loadedAction;
		}
		const temporaryReferences = options.createTemporaryReferenceSet();
		const args = await options.decodeReply(body, { temporaryReferences });
		let returnValue;
		let actionRedirect = null;
		let actionStatus = 200;
		let actionThrew = false;
		const actionWasForwarded = Boolean(options.request.headers.get(ACTION_FORWARDED_HEADER));
		const rootParamsUsage = createRootParamsUsageController();
		const previousHeadersPhase = options.setHeadersAccessPhase("action");
		try {
			try {
				validateServerActionArgs(args);
				returnValue = {
					ok: true,
					data: await runWithRootParamsUsage({ kind: "server-action" }, () => action.apply(null, args), rootParamsUsage)
				};
			} catch (error) {
				actionThrew = true;
				actionRedirect = getActionRedirect(error);
				if (actionRedirect) returnValue = {
					ok: true,
					data: void 0
				};
				else {
					const httpFallbackStatus = getActionHttpFallbackStatus(error);
					if (httpFallbackStatus !== null) {
						actionStatus = httpFallbackStatus;
						returnValue = {
							ok: false,
							data: error
						};
					} else {
						actionStatus = 500;
						console.error("[vinext] Server action error:", error);
						returnValue = {
							ok: false,
							data: options.sanitizeErrorForClient(error)
						};
					}
				}
			}
		} finally {
			options.setHeadersAccessPhase(previousHeadersPhase);
			if (actionThrew && !actionWasForwarded) rootParamsUsage.transitionToRender();
		}
		await _drainPendingRevalidations();
		if (actionRedirect) {
			const actionPendingCookies = dedupePendingCookies(options.getAndClearPendingCookies());
			const actionDraftCookie = options.getDraftModeCookieHeader();
			const actionRevalidationKind = resolveActionRevalidationKind(actionPendingCookies.length > 0 || Boolean(actionDraftCookie));
			const redirectHeaders = new Headers({
				"Content-Type": VINEXT_RSC_CONTENT_TYPE,
				Vary: VINEXT_RSC_VARY_HEADER
			});
			applyEdgeRuntimeHeader(redirectHeaders, options.isEdgeRuntime);
			mergeMiddlewareResponseHeaders(redirectHeaders, options.middlewareHeaders);
			applyRscCompatibilityIdHeader(redirectHeaders);
			const actionRedirectUrl = applyActionRedirectBasePath(actionRedirect.url, options.basePath ?? "");
			redirectHeaders.set(ACTION_REDIRECT_HEADER, actionRedirectUrl);
			redirectHeaders.set(ACTION_REDIRECT_TYPE_HEADER, actionRedirect.type);
			redirectHeaders.set(ACTION_REDIRECT_STATUS_HEADER, String(actionRedirect.status));
			for (const cookie of actionPendingCookies) redirectHeaders.append("Set-Cookie", cookie);
			if (actionDraftCookie) redirectHeaders.append("Set-Cookie", actionDraftCookie);
			setActionRevalidatedHeader(redirectHeaders, actionRevalidationKind);
			const redirectTarget = resolveInternalActionRedirectTarget(actionRedirectUrl, options.request.url, options.basePath ?? "");
			if (!redirectTarget) {
				options.clearRequestContext();
				return new Response(null, {
					status: 303,
					headers: withoutRscBodyHeaders(redirectHeaders)
				});
			}
			const targetPathname = stripBasePath(redirectTarget.pathname, options.basePath ?? "");
			const targetMatch = options.matchRoute(targetPathname);
			if (targetMatch) await options.ensureRouteLoaded?.(targetMatch.route);
			if (!targetMatch || !canRenderActionRedirectTarget(targetMatch.route)) {
				options.clearRequestContext();
				return new Response(null, {
					status: 303,
					headers: withoutRscBodyHeaders(redirectHeaders)
				});
			}
			const currentMatch = options.currentRouteMatch;
			if (currentMatch) await options.ensureRouteLoaded?.(currentMatch.route);
			const redirectRenderRequest = createActionRedirectRenderRequest({
				pendingCookies: [...actionPendingCookies, ...actionDraftCookie ? [actionDraftCookie] : []],
				request: options.request,
				url: redirectTarget
			});
			setHeadersContext(headersContextFromRequest(redirectRenderRequest, { draftModeSecret: options.draftModeSecret }));
			const redirectDynamicConfig = options.resolveRouteDynamicConfig?.(targetMatch.route);
			const redirectSearchParams = prepareActionPageRerenderContext({
				draftModeCookie: actionDraftCookie,
				draftModeSecret: options.draftModeSecret,
				dynamicConfig: redirectDynamicConfig,
				request: redirectRenderRequest,
				routePattern: targetMatch.route.pattern,
				searchParams: redirectTarget.searchParams
			});
			const redirectNavigationParams = resolveAppPageNavigationParams(targetMatch.route, targetMatch.params, targetPathname, null);
			options.setNavigationContext({
				pathname: targetPathname,
				searchParams: redirectSearchParams,
				params: redirectNavigationParams
			});
			setCurrentFetchCacheMode(options.resolveRouteFetchCacheMode?.(targetMatch.route) ?? null);
			setCurrentForceDynamicFetchDefault(redirectDynamicConfig === "force-dynamic");
			setCurrentFetchSoftTags(buildServerActionPageTags(targetMatch.route, targetPathname));
			return createServerActionRscResponse(await runWithRootParamsScope(pickRootParams(targetMatch.params, targetMatch.route.rootParamNames), () => runWithRootParamsUsage({ kind: "route" }, async () => {
				const element = options.buildPageElement({
					cleanPathname: targetPathname,
					interceptOpts: void 0,
					isRscRequest: true,
					mountedSlotsHeader: null,
					params: targetMatch.params,
					request: redirectRenderRequest,
					route: targetMatch.route,
					searchParams: redirectSearchParams,
					renderMode: APP_RSC_RENDER_MODE_NAVIGATION,
					observeMetadataSearchParamsAccess: redirectDynamicConfig !== "force-static",
					observePageSearchParamsAccess: redirectDynamicConfig !== "force-static"
				});
				const onRenderError = options.createRscOnErrorHandler(redirectRenderRequest, targetPathname, targetMatch.route.pattern);
				return options.renderToReadableStream({
					root: element,
					returnValue
				}, {
					temporaryReferences,
					onError: onRenderError
				});
			})), {
				status: shouldUseForwardedActionRedirectStatus({
					actionWasForwarded,
					currentPathname: options.cleanPathname,
					currentRoute: currentMatch?.route ?? null,
					resolveRouteRuntime: options.resolveRouteRuntime,
					targetPathname,
					targetRoute: targetMatch.route
				}) ? 200 : 303,
				headers: redirectHeaders
			}, options.clearRequestContext);
		}
		const actionPendingCookies = dedupePendingCookies(options.getAndClearPendingCookies());
		const actionDraftCookie = options.getDraftModeCookieHeader();
		const actionRevalidationKind = resolveActionRevalidationKind(actionPendingCookies.length > 0 || Boolean(actionDraftCookie));
		const isHttpFallback = actionStatus === 401 || actionStatus === 403 || actionStatus === 404;
		if (!isHttpFallback && (actionWasForwarded || actionRevalidationKind === ACTION_DID_NOT_REVALIDATE)) {
			const onRenderError = options.createRscOnErrorHandler(options.request, options.cleanPathname, options.cleanPathname);
			const rscStream = await options.renderToReadableStream({ returnValue }, {
				temporaryReferences,
				onError: onRenderError
			});
			const actionHeaders = new Headers({
				"Content-Type": VINEXT_RSC_CONTENT_TYPE,
				Vary: VINEXT_RSC_VARY_HEADER
			});
			applyEdgeRuntimeHeader(actionHeaders, options.isEdgeRuntime);
			mergeMiddlewareResponseHeaders(actionHeaders, options.middlewareHeaders);
			applyRscCompatibilityIdHeader(actionHeaders);
			for (const cookie of actionPendingCookies) actionHeaders.append("Set-Cookie", cookie);
			if (actionDraftCookie) actionHeaders.append("Set-Cookie", actionDraftCookie);
			setActionRevalidatedHeader(actionHeaders, actionRevalidationKind);
			return createServerActionRscResponse(rscStream, {
				status: options.middlewareStatus ?? actionStatus,
				headers: actionHeaders
			}, options.clearRequestContext);
		}
		if (!actionThrew) rootParamsUsage.transitionToRender();
		const match = options.currentRouteMatch;
		let element;
		let errorPattern = match ? match.route.pattern : options.cleanPathname;
		const actionRerenderIsRscRequest = true;
		if (match) {
			const { route: actionRoute, params: actionParams } = match;
			const actionRerenderTarget = await resolveAppPageActionRerenderTarget({
				cleanPathname: options.currentRoutePathname,
				currentParams: actionParams,
				currentRoute: actionRoute,
				findIntercept: options.findIntercept,
				getRouteParamNames: options.getRouteParamNames,
				getSourceRoute: options.getSourceRoute,
				isRscRequest: actionRerenderIsRscRequest,
				toInterceptOpts: options.toInterceptOpts
			});
			const resolvedActionNavigationParams = resolveAppPageNavigationParams(actionRerenderTarget.route, actionRerenderTarget.navigationParams, options.cleanPathname, actionRerenderTarget.interceptOpts);
			await options.ensureRouteLoaded?.(actionRerenderTarget.route);
			const actionRerenderDynamicConfig = options.resolveRouteDynamicConfig?.(actionRerenderTarget.route);
			const actionRerenderSearchParams = prepareActionPageRerenderContext({
				draftModeCookie: actionDraftCookie,
				draftModeSecret: options.draftModeSecret,
				dynamicConfig: actionRerenderDynamicConfig,
				request: options.request,
				routePattern: actionRerenderTarget.route.pattern,
				searchParams: options.searchParams
			});
			options.setNavigationContext({
				pathname: options.cleanPathname,
				searchParams: actionRerenderSearchParams,
				params: resolvedActionNavigationParams
			});
			setCurrentFetchCacheMode(options.resolveRouteFetchCacheMode?.(actionRerenderTarget.route) ?? null);
			setCurrentForceDynamicFetchDefault(actionRerenderDynamicConfig === "force-dynamic");
			setCurrentFetchSoftTags(buildServerActionPageTags(actionRerenderTarget.route, options.cleanPathname));
			const buildActionRerenderElement = () => options.buildPageElement({
				cleanPathname: options.cleanPathname,
				interceptOpts: actionRerenderTarget.interceptOpts,
				isRscRequest: actionRerenderIsRscRequest,
				mountedSlotsHeader: options.mountedSlotsHeader,
				params: actionRerenderTarget.params,
				request: options.request,
				route: actionRerenderTarget.route,
				searchParams: actionRerenderSearchParams,
				renderMode: APP_RSC_RENDER_MODE_NAVIGATION,
				observeMetadataSearchParamsAccess: actionRerenderDynamicConfig !== "force-static",
				observePageSearchParamsAccess: actionRerenderDynamicConfig !== "force-static"
			});
			element = actionWasForwarded && isHttpFallback ? await runWithRootParamsUsage({ kind: "route" }, async () => buildActionRerenderElement()) : buildActionRerenderElement();
			errorPattern = actionRerenderTarget.route.pattern;
		} else {
			const actionRouteId = options.createPayloadRouteId(options.cleanPathname, null);
			element = options.createNotFoundElement(actionRouteId);
		}
		const onRenderError = options.createRscOnErrorHandler(options.request, options.cleanPathname, errorPattern);
		const renderActionRerender = () => options.renderToReadableStream({
			root: element,
			returnValue
		}, {
			temporaryReferences,
			onError: onRenderError
		});
		const rscStream = await (actionWasForwarded && isHttpFallback ? runWithRootParamsUsage({ kind: "route" }, renderActionRerender) : renderActionRerender());
		const actionHeaders = new Headers({
			"Content-Type": VINEXT_RSC_CONTENT_TYPE,
			Vary: VINEXT_RSC_VARY_HEADER
		});
		applyEdgeRuntimeHeader(actionHeaders, options.isEdgeRuntime);
		mergeMiddlewareResponseHeaders(actionHeaders, options.middlewareHeaders);
		applyRscCompatibilityIdHeader(actionHeaders);
		setActionRevalidatedHeader(actionHeaders, actionRevalidationKind);
		const actionResponse = createServerActionRscResponse(rscStream, {
			status: options.middlewareStatus ?? actionStatus,
			headers: actionHeaders
		}, options.clearRequestContext);
		if (actionPendingCookies.length > 0 || actionDraftCookie) {
			for (const cookie of actionPendingCookies) actionResponse.headers.append("Set-Cookie", cookie);
			if (actionDraftCookie) actionResponse.headers.append("Set-Cookie", actionDraftCookie);
		}
		return actionResponse;
	} catch (error) {
		getAndClearActionRevalidationKind();
		return createServerActionErrorResponse(error, {
			cleanPathname: options.cleanPathname,
			clearRequestContext: options.clearRequestContext,
			getAndClearPendingCookies: options.getAndClearPendingCookies,
			reportRequestError: options.reportRequestError,
			request: options.request
		});
	}
}
//#endregion
export { applyActionRedirectBasePath, handleProgressiveServerActionRequest, handleServerActionRscRequest, isProgressiveServerActionRequest, readActionBodyWithLimit, readActionFormDataWithLimit };
