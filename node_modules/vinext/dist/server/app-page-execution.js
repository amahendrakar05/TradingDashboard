import { VINEXT_RSC_REDIRECT_HEADER, VINEXT_RSC_REDIRECT_TYPE_HEADER } from "./headers.js";
import { runWithConnectionProbe } from "../shims/headers.js";
import { VINEXT_RSC_CONTENT_TYPE, applyRscCompatibilityIdHeader, applyRscDeploymentIdHeader, createRscRedirectLocation } from "./app-rsc-cache-busting.js";
import { mergeMiddlewareResponseHeaders } from "./middleware-response-headers.js";
import { applyEdgeRuntimeHeader } from "./app-page-response.js";
import { parseNextHttpErrorDigest, parseNextRedirectDigest } from "./next-error-digest.js";
import { renderSsrErrorMetaTags } from "./app-ssr-error-meta.js";
import { isPromiseLike } from "../utils/promise.js";
import { formatNextRedirectDigest } from "./app-rsc-redirect-flight.js";
//#region src/server/app-page-execution.ts
/**
* Marker we tag onto a thrown redirect/notFound error when it originates from
* `generateMetadata()` (vs. a server component itself). Metadata resolution is
* suspended/streamed in Next.js, so a redirect from metadata is not emitted as
* a plain HTTP-level 307. Instead the transport depends on the request:
*   - RSC navigation requests (`Rsc: 1`) ride inside the flight payload with a
*     200 status; the client router decodes the redirect digest.
*   - Streaming-capable document requests get a 200 HTML response carrying a
*     refresh meta tag (the streamed document can't switch to a 307 after the
*     head has flushed).
*   - html-limited bots (which Next.js serves a blocking, non-streamed
*     response) get the HTTP-level 307.
* Page-level redirect()s, by contrast, still produce a 307 for SSR document
* requests.
*
* See Next.js test:
*   test/e2e/app-dir/metadata-streaming/metadata-streaming.test.ts
*/
const APP_PAGE_METADATA_ERROR_MARKER = Symbol.for("vinext.appPage.metadataError");
function tagAppPageMetadataError(error) {
	if (error && typeof error === "object") try {
		Object.defineProperty(error, APP_PAGE_METADATA_ERROR_MARKER, {
			value: true,
			enumerable: false,
			configurable: true,
			writable: false
		});
	} catch {}
	return error;
}
function getAppPageStatusText(statusCode) {
	return statusCode === 403 ? "Forbidden" : statusCode === 401 ? "Unauthorized" : "Not Found";
}
function mergeAppPageSpecialErrorHeaders(response, middlewareContext) {
	const headers = new Headers(response.headers);
	mergeMiddlewareResponseHeaders(headers, middlewareContext?.headers ?? null);
	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText
	});
}
function resolveAppPageSpecialError(error) {
	if (!(error && typeof error === "object" && "digest" in error)) return null;
	const digest = String(error.digest);
	const fromMetadata = Reflect.get(error, APP_PAGE_METADATA_ERROR_MARKER) === true;
	const redirect = parseNextRedirectDigest(digest);
	if (redirect) return {
		kind: "redirect",
		location: redirect.url,
		statusCode: redirect.status,
		type: redirect.type === "push" ? "push" : "replace",
		...fromMetadata ? { fromMetadata: true } : {}
	};
	const httpError = parseNextHttpErrorDigest(digest);
	if (httpError) return {
		kind: "http-access-fallback",
		statusCode: httpError.status,
		...fromMetadata ? { fromMetadata: true } : {}
	};
	return null;
}
/**
* Resolves a redirect() target against the request URL and prepends the
* configured basePath when the target is an app-internal absolute path.
*
* Mirrors Next.js's `addPathPrefix(getURLFromRedirectError(err), basePath)`
* in `app-render.tsx`: a `redirect("/about")` call from a page mounted at
* `/blog` (basePath) produces `Location: /blog/about`.
*
* Skips prefixing only when basePath is unset or the raw target does not start
* with `/`, matching Next.js's literal `addPathPrefix()` contract.
*/
function applyAppPageRedirectBasePath(location, basePath) {
	if (!basePath || !location.startsWith("/")) return location;
	const queryIndex = location.indexOf("?");
	const hashIndex = location.indexOf("#");
	const suffixIndex = queryIndex === -1 ? hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
	return `${basePath}${suffixIndex === -1 ? location : location.slice(0, suffixIndex)}${suffixIndex === -1 ? "" : location.slice(suffixIndex)}`;
}
/**
* Returns a path-relative form (`/foo?bar`) of an absolute URL when it shares
* the request's origin; otherwise returns the URL verbatim. Used so the digest
* we embed in the flight payload matches Next.js's convention — the digest
* stores the path the developer passed to `redirect("/about")`, not a
* fully-qualified URL like `https://example.com/about`.
*/
function sameOriginPathOrAbsolute(location, requestUrl) {
	try {
		const resolved = new URL(location, requestUrl);
		const requestOrigin = new URL(requestUrl).origin;
		if (resolved.origin !== requestOrigin) return resolved.toString();
		return `${resolved.pathname}${resolved.search}${resolved.hash}`;
	} catch {
		return location;
	}
}
function buildMetadataRedirectHtmlResponse(options) {
	const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
	applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
	mergeMiddlewareResponseHeaders(headers, options.middlewareContext?.headers ?? null);
	const pendingCookies = options.getAndClearPendingCookies?.() ?? [];
	for (const cookie of pendingCookies) headers.append("Set-Cookie", cookie);
	const errorMetaTags = renderSsrErrorMetaTags([{ digest: options.digest }]);
	return new Response(`<!DOCTYPE html><html><head>${errorMetaTags}</head><body></body></html>`, {
		headers,
		status: 200
	});
}
async function buildAppPageSpecialErrorResponse(options) {
	if (options.specialError.kind === "redirect") {
		options.clearRequestContext();
		const prefixedLocation = applyAppPageRedirectBasePath(options.specialError.location, options.basePath);
		const digestUrl = sameOriginPathOrAbsolute(prefixedLocation, options.request.url);
		const digest = formatNextRedirectDigest({
			type: options.specialError.type ?? "replace",
			url: digestUrl,
			statusCode: options.specialError.statusCode
		});
		if (options.specialError.fromMetadata === true && !options.isRscRequest && options.serveStreamingMetadata !== false) return buildMetadataRedirectHtmlResponse({
			digest,
			getAndClearPendingCookies: options.getAndClearPendingCookies,
			isEdgeRuntime: options.isEdgeRuntime,
			middlewareContext: options.middlewareContext
		});
		if (Boolean(options.buildRscRedirectFlightStream) && options.isRscRequest && options.buildRscRedirectFlightStream) {
			const stream = options.buildRscRedirectFlightStream({ digest });
			const headers = new Headers({ "Content-Type": VINEXT_RSC_CONTENT_TYPE });
			applyEdgeRuntimeHeader(headers, options.isEdgeRuntime);
			applyRscCompatibilityIdHeader(headers);
			applyRscDeploymentIdHeader(headers);
			mergeMiddlewareResponseHeaders(headers, options.middlewareContext?.headers ?? null);
			headers.set(VINEXT_RSC_REDIRECT_HEADER, digestUrl);
			headers.set(VINEXT_RSC_REDIRECT_TYPE_HEADER, options.specialError.type ?? "replace");
			const pendingCookies = options.getAndClearPendingCookies?.() ?? [];
			for (const cookie of pendingCookies) headers.append("Set-Cookie", cookie);
			return new Response(stream, {
				headers,
				status: 200
			});
		}
		const location = options.isRscRequest ? await createRscRedirectLocation(prefixedLocation, options.request) : prefixedLocation;
		const headers = new Headers({ Location: location });
		mergeMiddlewareResponseHeaders(headers, options.middlewareContext?.headers ?? null);
		const pendingCookies = options.getAndClearPendingCookies?.() ?? [];
		for (const cookie of pendingCookies) headers.append("Set-Cookie", cookie);
		return new Response(null, {
			headers,
			status: options.specialError.statusCode
		});
	}
	if (options.renderFallbackPage) {
		const fallbackResponse = await options.renderFallbackPage(options.specialError.statusCode);
		if (fallbackResponse) return mergeAppPageSpecialErrorHeaders(options.specialError.fromMetadata === true && options.serveStreamingMetadata !== false ? new Response(fallbackResponse.body, {
			headers: fallbackResponse.headers,
			status: 200,
			statusText: fallbackResponse.statusText
		}) : fallbackResponse, options.middlewareContext);
	}
	options.clearRequestContext();
	const responseStatus = options.specialError.fromMetadata === true && options.serveStreamingMetadata !== false ? 200 : options.specialError.statusCode;
	return mergeAppPageSpecialErrorHeaders(new Response(getAppPageStatusText(options.specialError.statusCode), { status: responseStatus }), options.middlewareContext);
}
/** See `LayoutFlags` type docblock in app-elements.ts for lifecycle. */
async function probeAppPageLayouts(options) {
	const layoutFlags = {};
	const cls = options.classification ?? null;
	return {
		response: await options.runWithSuppressedHookWarning(async () => {
			for (let layoutIndex = options.layoutCount - 1; layoutIndex >= 0; layoutIndex--) {
				const buildTimeResult = cls?.buildTimeClassifications?.get(layoutIndex);
				if (cls && buildTimeResult) {
					const layoutId = cls.getLayoutId(layoutIndex);
					layoutFlags[layoutId] = buildTimeResult === "static" ? "s" : "d";
					const errorResponse = await probeLayoutForErrors(options, layoutIndex);
					if (errorResponse) return errorResponse;
					const observationDynamic = cls.isLayoutObservationDynamic?.(layoutId) === true;
					layoutFlags[layoutId] = buildTimeResult === "dynamic" || observationDynamic ? "d" : "s";
					if (cls.debugClassification) if (observationDynamic && buildTimeResult === "static") cls.debugClassification(layoutId, {
						layer: "runtime-probe",
						outcome: "dynamic"
					});
					else cls.debugClassification(layoutId, cls.buildTimeReasons?.get(layoutIndex) ?? { layer: "no-classifier" });
					continue;
				}
				if (cls) {
					const layoutId = cls.getLayoutId(layoutIndex);
					try {
						const { dynamicDetected } = await cls.runWithIsolatedDynamicScope(async () => {
							const outcome = await runWithConnectionProbe(() => options.probeLayoutAt(layoutIndex));
							return outcome.completed ? outcome.result : null;
						});
						const observationDynamic = cls.isLayoutObservationDynamic?.(layoutId) === true;
						const layoutDynamic = dynamicDetected || observationDynamic;
						layoutFlags[layoutId] = layoutDynamic ? "d" : "s";
						if (cls.debugClassification) cls.debugClassification(layoutId, {
							layer: "runtime-probe",
							outcome: layoutDynamic ? "dynamic" : "static"
						});
					} catch (error) {
						layoutFlags[layoutId] = "d";
						if (cls.debugClassification) cls.debugClassification(layoutId, {
							layer: "runtime-probe",
							outcome: "dynamic",
							error: error instanceof Error ? error.message : String(error)
						});
						const errorResponse = await options.onLayoutError(error, layoutIndex);
						if (errorResponse) return errorResponse;
					}
					continue;
				}
				const errorResponse = await probeLayoutForErrors(options, layoutIndex);
				if (errorResponse) return errorResponse;
			}
			return null;
		}),
		layoutFlags
	};
}
async function probeLayoutForErrors(options, layoutIndex) {
	const outcome = await runWithConnectionProbe(async () => {
		try {
			const layoutResult = options.probeLayoutAt(layoutIndex);
			if (isPromiseLike(layoutResult)) await layoutResult;
		} catch (error) {
			return options.onLayoutError(error, layoutIndex);
		}
		return null;
	});
	return outcome.completed ? outcome.result : null;
}
async function probeAppPageComponent(options) {
	return options.runWithSuppressedHookWarning(async () => {
		const outcome = await runWithConnectionProbe(async () => {
			try {
				const pageResult = options.probePage();
				if (isPromiseLike(pageResult)) if (options.awaitAsyncResult) await pageResult;
				else Promise.resolve(pageResult).catch(() => {});
			} catch (error) {
				return options.onError(error);
			}
			return null;
		});
		return outcome.completed ? outcome.result : null;
	});
}
async function probeAppPageThrownError(options) {
	return options.runWithSuppressedHookWarning(async () => {
		const outcome = await runWithConnectionProbe(async () => {
			try {
				const pageResult = options.probePage();
				if (isPromiseLike(pageResult)) await pageResult;
			} catch (error) {
				return {
					error,
					thrown: true
				};
			}
			return {
				error: null,
				thrown: false
			};
		});
		return outcome.completed && outcome.result.thrown ? outcome.result.error : null;
	});
}
async function readAppPageBinaryStream(stream) {
	const reader = stream.getReader();
	const chunks = [];
	let totalLength = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		totalLength += value.byteLength;
	}
	const buffer = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return buffer.buffer;
}
async function bufferAppPageBinaryStream(stream) {
	const reader = stream.getReader();
	const chunks = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	return new ReadableStream({ start(controller) {
		for (const chunk of chunks) controller.enqueue(chunk);
		controller.close();
	} });
}
function teeAppPageRscStreamForCapture(stream, shouldCapture) {
	if (!shouldCapture) return { ssrStream: stream };
	const [ssrStream, sideStream] = stream.tee();
	return {
		ssrStream,
		sideStream
	};
}
function buildAppPageFontLinkHeader(preloads) {
	if (!preloads || preloads.length === 0) return "";
	return preloads.map((preload) => `<${preload.href}>; rel=preload; as=font; type=${preload.type}; crossorigin`).join(", ");
}
//#endregion
export { bufferAppPageBinaryStream, buildAppPageFontLinkHeader, buildAppPageSpecialErrorResponse, probeAppPageComponent, probeAppPageLayouts, probeAppPageThrownError, readAppPageBinaryStream, resolveAppPageSpecialError, tagAppPageMetadataError, teeAppPageRscStreamForCapture };
