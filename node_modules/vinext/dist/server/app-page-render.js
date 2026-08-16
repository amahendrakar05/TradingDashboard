import { NEVER_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, applyCdnResponseHeaders } from "./cache-control.js";
import { createArtifactCompatibilityEnvelope, createArtifactCompatibilityGraphVersion } from "./artifact-compatibility.js";
import { AppElementsWire, isAppElementsRecord } from "./app-elements-wire.js";
import "./app-elements.js";
import { peekDynamicUsage } from "../shims/headers.js";
import { runWithFetchDedupe } from "../shims/fetch-cache.js";
import { buildAppPageHtmlResponse, buildAppPageRscResponse, resolveAppPageHtmlResponsePolicy, resolveAppPageRscResponsePolicy } from "./app-page-response.js";
import { buildAppPageFontLinkHeader, readAppPageBinaryStream, resolveAppPageSpecialError, teeAppPageRscStreamForCapture } from "./app-page-execution.js";
import { probeAppPageBeforeRender } from "./app-page-probe.js";
import { DEFAULT_CACHE_VARIANT_BUDGET, buildCacheVariantWithRouteBudget, buildRenderObservation, buildRenderRequestApiObservations, createStaticLayoutArtifactReuseDecision } from "./cache-proof.js";
import { createAppPageHtmlOutputScope, createAppPageRenderObservation, createAppPageRscOutputScope, createEmptyAppPageRenderObservationState } from "./app-page-render-observation.js";
import { finalizeAppPageHtmlCacheResponse, finalizeAppPageRscCacheResponse } from "./app-page-cache-finalizer.js";
import { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId } from "./static-layout-client-reuse-proof.js";
import { hasDigest } from "./app-rsc-errors.js";
import { deferUntilStreamConsumed } from "./defer-until-stream-consumed.js";
import { buildAppPageLinkHeader, createAppPageFontData, createAppPageRscErrorTracker, renderAppPageHtmlStream, renderAppPageHtmlStreamWithRecovery } from "./app-page-stream.js";
import { getStaticLayoutObservationSkipRejection } from "./app-layout-param-observation.js";
import { createClientReuseSkipTransportPlan, crossCheckClientReuseManifestEntryWithCache } from "./skip-cache-proof.js";
//#region src/server/app-page-render.ts
function buildResponseTiming(options) {
	if (options.isProduction) return;
	return {
		compileEnd: options.compileEnd,
		handlerStart: options.handlerStart,
		renderEnd: options.renderEnd,
		responseKind: options.responseKind
	};
}
function readRequestCacheLifeForPrerender(options) {
	if (options.isEdgeRuntime && options.revalidateSeconds === null) return (options.peekRequestCacheLife?.() ?? options.getRequestCacheLife())?.revalidate !== void 0 ? { revalidate: 0 } : null;
	return options.peekRequestCacheLife?.() ?? options.getRequestCacheLife();
}
function readRequestCacheLifeForCachePolicy(options) {
	const requestCacheLife = options.getRequestCacheLife();
	if (options.isEdgeRuntime && options.revalidateSeconds === null) return null;
	return requestCacheLife;
}
function applyRequestCacheLife(options) {
	let revalidateSeconds = options.revalidateSeconds;
	let expireSeconds = options.expireSeconds;
	const requestCacheLife = options.requestCacheLife;
	if (requestCacheLife?.revalidate !== void 0) revalidateSeconds = revalidateSeconds === null ? requestCacheLife.revalidate : Math.min(revalidateSeconds, requestCacheLife.revalidate);
	if (requestCacheLife?.expire !== void 0) expireSeconds = requestCacheLife.expire;
	return {
		expireSeconds,
		revalidateSeconds
	};
}
function resolveAppPageCacheWriteRevalidateSeconds(options) {
	if (options.revalidateSeconds === null && (options.isForceStatic || options.isDynamicError)) return Infinity;
	return options.revalidateSeconds;
}
function readRootBoundaryId(element) {
	const rootLayoutTreePath = element[AppElementsWire.keys.rootLayout];
	return typeof rootLayoutTreePath === "string" ? rootLayoutTreePath : null;
}
function createAppPageArtifactCompatibility(element, routePattern) {
	if (!isAppElementsRecord(element)) return;
	const rootBoundaryId = readRootBoundaryId(element);
	return createArtifactCompatibilityEnvelope({
		graphVersion: createArtifactCompatibilityGraphVersion({
			routePattern,
			rootBoundaryId
		}),
		deploymentVersion: process.env.__VINEXT_BUILD_ID ?? null,
		rootBoundaryId
	});
}
function readStringMetadata(element, key) {
	const value = element[key];
	return typeof value === "string" ? value : null;
}
function createStaticLayoutOutputScope(input) {
	const routeId = readStringMetadata(input.element, AppElementsWire.keys.route);
	if (routeId === null) return null;
	return {
		kind: "layout",
		layoutId: input.layoutId,
		rootBoundaryId: input.artifactCompatibility.rootBoundaryId,
		routeId
	};
}
function createRenderAndSendSkipDisposition() {
	return {
		code: "SKIP_MODEL_DISABLED",
		enabled: false,
		mode: "renderAndSend"
	};
}
function rejectStaticLayoutObservation(entry, code, fields = {}) {
	return {
		kind: "rejected",
		rejection: {
			code,
			entryId: entry.id,
			fields
		},
		skipDisposition: createRenderAndSendSkipDisposition()
	};
}
function rejectUnsafeStaticLayoutObservation(entry, layoutParamAccess) {
	const observation = layoutParamAccess?.getLayoutObservation(entry.id);
	if (!observation) return rejectStaticLayoutObservation(entry, "SKIP_LAYOUT_PARAMS_OBSERVATION_INCOMPLETE");
	const observationRejection = getStaticLayoutObservationSkipRejection(observation);
	if (observationRejection) return rejectStaticLayoutObservation(entry, observationRejection.code, observationRejection.fields);
	return null;
}
function createRenderLifecycleSkipDisposition(input) {
	if (!input.isRscRequest || input.clientReuseManifest === void 0) return;
	const clientReuseManifest = input.clientReuseManifest;
	if (clientReuseManifest.kind !== "parsed" || clientReuseManifest.manifest.entries.length === 0) return;
	if (!isAppElementsRecord(input.element) || input.artifactCompatibility === void 0) return {
		code: "SKIP_MODEL_DISABLED",
		enabled: false,
		mode: "renderAndSend"
	};
	const element = input.element;
	const artifactCompatibility = input.artifactCompatibility;
	const staticLayoutIds = new Set(Object.entries(input.layoutFlags).filter(([, flag]) => flag === "s").map(([layoutId]) => layoutId));
	return createClientReuseSkipTransportPlan({
		manifest: clientReuseManifest,
		verifyEntry(entry) {
			if (entry.kind !== "layout" || !staticLayoutIds.has(entry.id) || AppElementsWire.parseElementKey(entry.id)?.kind !== "layout") return crossCheckClientReuseManifestEntryWithCache({
				artifact: {
					compatibility: artifactCompatibility,
					invalidation: { kind: "unknown" },
					payloadHash: null
				},
				cacheDecision: null,
				entry
			});
			const currentOutput = createStaticLayoutOutputScope({
				artifactCompatibility,
				element,
				layoutId: entry.id
			});
			if (currentOutput === null) return crossCheckClientReuseManifestEntryWithCache({
				artifact: {
					compatibility: artifactCompatibility,
					invalidation: { kind: "unknown" },
					payloadHash: null
				},
				cacheDecision: null,
				entry
			});
			const observationRejection = rejectUnsafeStaticLayoutObservation(entry, input.layoutParamAccess);
			if (observationRejection) return observationRejection;
			const candidateRouteId = createStaticLayoutClientReuseRouteId(entry.id);
			const candidateOutput = {
				...currentOutput,
				routeId: candidateRouteId
			};
			const candidateVariant = buildCacheVariantWithRouteBudget({
				budget: DEFAULT_CACHE_VARIANT_BUDGET,
				dimensions: [],
				output: candidateOutput,
				routeBudget: {
					routeId: candidateRouteId,
					variantCacheKeys: []
				}
			});
			const skipArtifactCompatibility = candidateVariant.kind === "variant" ? createStaticLayoutClientReuseArtifactCompatibility({
				artifactCompatibility,
				layoutId: entry.id,
				rootBoundaryId: candidateOutput.rootBoundaryId,
				routeId: candidateOutput.routeId,
				variantCacheKey: candidateVariant.variant.cacheKey
			}) : artifactCompatibility;
			const cacheDecision = createStaticLayoutArtifactReuseDecision({
				candidateArtifactCompatibility: skipArtifactCompatibility,
				candidateObservation: buildRenderObservation({
					boundaryOutcome: { kind: "success" },
					cacheability: "public",
					cacheTags: [],
					completeness: "complete",
					dynamicFetches: [],
					output: candidateOutput,
					pathTags: [input.cleanPathname],
					requestApis: buildRenderRequestApiObservations({
						completeness: "complete",
						observed: []
					})
				}),
				candidateVariant,
				currentArtifactCompatibility: skipArtifactCompatibility,
				currentOutput
			});
			return crossCheckClientReuseManifestEntryWithCache({
				artifact: {
					compatibility: skipArtifactCompatibility,
					invalidation: { kind: "valid" },
					payloadHash: candidateVariant.kind === "variant" ? createStaticLayoutClientReusePayloadHash({
						artifactCompatibility: skipArtifactCompatibility,
						layoutId: entry.id,
						rootBoundaryId: candidateOutput.rootBoundaryId,
						routeId: candidateOutput.routeId,
						variantCacheKey: candidateVariant.variant.cacheKey
					}) : null
				},
				cacheDecision,
				entry
			});
		}
	}).skipDisposition;
}
function isSkipTransportEnabled(skipDisposition) {
	return skipDisposition?.enabled === true;
}
/**
* Wraps an RSC response body to report invalid dynamic usage errors after the
* stream is fully consumed. In dev mode, errors from cookies()/headers() inside
* "use cache" may be caught by user try/catch and silently swallowed — this
* wrapper waits for the stream to drain and surfaces any recorded error to the
* terminal (and, via HMR, the browser dev overlay).
*
* Dedups against React's Flight error chunk: if the recorded error already
* carries a `digest`, React's serverComponentsErrorHandler has already stamped
* it and emitted it into the RSC stream. Skipping `console.error` prevents
* double-logging. Caught cases (no digest) still surface here.
*
* Ported from Next.js:
*   https://github.com/vercel/next.js/commit/f5e54c06726b571a042fce67417e40a29f6b8689
*   https://github.com/vercel/next.js/pull/93706
*/
function wrapRscResponseForDevErrorReporting(response, consumeInvalidDynamicUsageError) {
	const originalBody = response.body;
	if (!originalBody) return response;
	let consumed = false;
	const onConsumed = () => {
		if (consumed) return;
		consumed = true;
		const error = consumeInvalidDynamicUsageError();
		if (!error) return;
		if (!hasDigest(error)) console.error("[vinext] Invalid dynamic usage:", error);
	};
	const cleanup = new TransformStream({ flush() {
		onConsumed();
	} });
	const reader = originalBody.pipeThrough(cleanup).getReader();
	const wrappedStream = new ReadableStream({
		pull(controller) {
			return reader.read().then(({ done, value }) => {
				if (done) controller.close();
				else controller.enqueue(value);
			}, (streamError) => {
				onConsumed();
				controller.error(streamError);
			});
		},
		cancel(reason) {
			onConsumed();
			return reader.cancel(reason);
		}
	});
	return new Response(wrappedStream, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
}
async function renderAppPageLifecycle(options) {
	const configuredProbePageBeforeRender = options.probePageBeforeRender ?? options.isRscRequest;
	const probePageBeforeRender = options.isRscRequest || configuredProbePageBeforeRender && !(options.peekDynamicUsage?.() ?? false);
	const preRenderResult = await probeAppPageBeforeRender({
		hasLoadingBoundary: options.hasLoadingBoundary,
		probePageBeforeRender,
		skipProbes: options.pprFallbackShellSignal !== void 0,
		layoutCount: options.layoutCount,
		probeLayoutAt(layoutIndex) {
			return options.probeLayoutAt(layoutIndex);
		},
		probePage() {
			return options.probePage();
		},
		renderLayoutSpecialError(specialError, layoutIndex) {
			return options.renderLayoutSpecialError(specialError, layoutIndex);
		},
		renderPageSpecialError(specialError) {
			return options.renderPageSpecialError(specialError);
		},
		resolveSpecialError: resolveAppPageSpecialError,
		runWithSuppressedHookWarning(probe) {
			return options.runWithSuppressedHookWarning(probe);
		},
		classification: options.classification
	});
	if (preRenderResult.response) return preRenderResult.response;
	const layoutFlags = preRenderResult.layoutFlags;
	const artifactCompatibility = createAppPageArtifactCompatibility(options.element, options.routePattern);
	const rootBoundaryId = artifactCompatibility?.rootBoundaryId ?? null;
	const renderEpoch = artifactCompatibility?.renderEpoch ?? null;
	const rscOutputScope = createAppPageRscOutputScope({
		element: options.element,
		mountedSlotsHeader: options.mountedSlotsHeader,
		renderEpoch,
		rootBoundaryId,
		routePattern: options.routePattern
	});
	const htmlOutputScope = createAppPageHtmlOutputScope({
		element: options.element,
		renderEpoch,
		rootBoundaryId,
		routePattern: options.routePattern
	});
	const payloadRenderObservation = createAppPageRenderObservation({
		boundaryOutcome: { kind: "unknown" },
		cacheability: "unknown",
		cacheTags: options.getPageTags(),
		cleanPathname: options.cleanPathname,
		completeness: "partial",
		output: rscOutputScope,
		params: options.navigationParams,
		state: options.peekRenderObservationState?.() ?? createEmptyAppPageRenderObservationState()
	});
	const skipDisposition = options.skipDisposition ?? createRenderLifecycleSkipDisposition({
		artifactCompatibility,
		cleanPathname: options.cleanPathname,
		clientReuseManifest: options.clientReuseManifest,
		element: options.element,
		isRscRequest: options.isRscRequest,
		layoutFlags,
		layoutParamAccess: options.layoutParamAccess
	});
	const shouldBypassRscCacheForSkipTransport = options.isRscRequest && isSkipTransportEnabled(skipDisposition);
	const outgoingElement = AppElementsWire.encodeOutgoingPayload({
		element: options.element,
		layoutFlags,
		...options.dynamicStaleTimeSeconds !== void 0 && options.isPrerender !== true && !options.isForceStatic ? { dynamicStaleTimeSeconds: options.dynamicStaleTimeSeconds } : {},
		...artifactCompatibility ? { artifactCompatibility } : {},
		renderObservation: payloadRenderObservation,
		skipDisposition: options.isRscRequest ? skipDisposition : void 0
	});
	const compileEnd = options.isProduction ? void 0 : performance.now();
	const rscErrorTracker = createAppPageRscErrorTracker(options.createRscOnErrorHandler(options.cleanPathname, options.routePattern));
	let rscStream = await runWithFetchDedupe(async () => {
		if (options.pprFallbackShellSignal && options.prerenderToReadableStream) {
			const reactSignal = options.pprFallbackShellReactSignal ?? options.pprFallbackShellSignal;
			const pendingResult = options.prerenderToReadableStream(outgoingElement, {
				onError: rscErrorTracker.onRenderError,
				signal: reactSignal
			});
			if (options.abortPprFallbackShell) setTimeout(options.abortPprFallbackShell, 0);
			return (await pendingResult).prelude;
		}
		return options.renderToReadableStream(outgoingElement, { onError: rscErrorTracker.onRenderError });
	});
	let pprFallbackShellRsc = null;
	if (options.pprFallbackShellSignal) pprFallbackShellRsc = new Uint8Array(await readAppPageBinaryStream(rscStream));
	let revalidateSeconds = options.revalidateSeconds;
	let expireSeconds = options.expireSeconds;
	const shouldWaitForAllReady = options.isPrerender === true && options.isSpeculativePrerender !== true;
	const shouldReadRequestCacheLifeForPrerender = options.isPrerender === true;
	const shouldCaptureRscForCacheMetadata = options.isProgressiveActionRender !== true && (options.isProduction || options.isPrerender === true) && (revalidateSeconds === null || revalidateSeconds > 0 && revalidateSeconds !== Infinity) && !options.isDraftMode && !options.isForceDynamic && !shouldBypassRscCacheForSkipTransport;
	const createBufferedRscStream = (close) => new ReadableStream({ start(controller) {
		if (pprFallbackShellRsc) controller.enqueue(pprFallbackShellRsc);
		if (close) controller.close();
	} });
	const rscCapture = pprFallbackShellRsc ? {
		ssrStream: createBufferedRscStream(false),
		...shouldCaptureRscForCacheMetadata ? { sideStream: createBufferedRscStream(true) } : {}
	} : teeAppPageRscStreamForCapture(rscStream, shouldCaptureRscForCacheMetadata);
	const rscForResponse = rscCapture.ssrStream;
	const capturedRscDataRef = { value: null };
	if (rscCapture.sideStream && options.isRscRequest) capturedRscDataRef.value = readAppPageBinaryStream(rscCapture.sideStream);
	if (options.isRscRequest) {
		let requestCacheLifeForPrerender = null;
		if (shouldWaitForAllReady) await settleCapturedRscRenderForCacheMetadata(capturedRscDataRef.value);
		if (shouldReadRequestCacheLifeForPrerender) {
			requestCacheLifeForPrerender = readRequestCacheLifeForPrerender(options);
			({expireSeconds, revalidateSeconds} = applyRequestCacheLife({
				expireSeconds,
				requestCacheLife: requestCacheLifeForPrerender,
				revalidateSeconds
			}));
		}
		const dynamicUsedDuringBuild = options.consumeDynamicUsage();
		const rscResponsePolicy = shouldBypassRscCacheForSkipTransport ? { cacheControl: NO_STORE_CACHE_CONTROL } : resolveAppPageRscResponsePolicy({
			dynamicUsedDuringBuild,
			isDraftMode: options.isDraftMode,
			isDynamicError: options.isDynamicError,
			isForceDynamic: options.isForceDynamic,
			isForceStatic: options.isForceStatic,
			isProduction: options.isProduction,
			expireSeconds,
			revalidateSeconds
		});
		if (shouldBypassRscCacheForSkipTransport) options.isrDebug?.("RSC cache write skipped (skip transport payload)", options.cleanPathname);
		const rscResponse = buildAppPageRscResponse(rscForResponse, {
			dynamicStaleTimeSeconds: options.dynamicStaleTimeSeconds !== void 0 && options.isPrerender !== true && !options.isForceStatic && (dynamicUsedDuringBuild || !shouldCaptureRscForCacheMetadata) ? options.dynamicStaleTimeSeconds : void 0,
			isEdgeRuntime: options.isEdgeRuntime,
			middlewareContext: options.middlewareContext,
			mountedSlotsHeader: options.mountedSlotsHeader,
			params: options.navigationParams,
			policy: rscResponsePolicy,
			renderedPathAndSearch: options.renderedPathAndSearch,
			requestCacheLife: requestCacheLifeForPrerender,
			timing: buildResponseTiming({
				compileEnd,
				handlerStart: options.handlerStart,
				isProduction: options.isProduction,
				responseKind: "rsc"
			})
		});
		return finalizeAppPageRscCacheResponse(!options.isProduction && rscResponse.body && options.consumeInvalidDynamicUsageError ? wrapRscResponseForDevErrorReporting(rscResponse, options.consumeInvalidDynamicUsageError) : rscResponse, {
			capturedRscDataPromise: options.isProduction && shouldCaptureRscForCacheMetadata ? capturedRscDataRef.value : null,
			cleanPathname: options.cleanPathname,
			consumeDynamicUsage: options.consumeDynamicUsage,
			consumeRenderObservationState: options.consumeRenderObservationState,
			createRscRenderObservation(input) {
				return createAppPageRenderObservation({
					boundaryOutcome: { kind: "success" },
					cacheability: "public",
					cacheTags: input.cacheTags,
					cleanPathname: options.cleanPathname,
					completeness: "complete",
					output: rscOutputScope,
					params: options.navigationParams,
					state: input.state
				});
			},
			dynamicUsedDuringBuild,
			getPageTags() {
				return options.getPageTags();
			},
			getRequestCacheLife() {
				return readRequestCacheLifeForCachePolicy(options);
			},
			isrDebug: options.isrDebug,
			isrRscKey: options.isrRscKey,
			isrSet: options.isrSet,
			interceptionContext: options.interceptionContext,
			mountedSlotsHeader: options.mountedSlotsHeader,
			omitPendingDynamicCacheState: options.omitPendingDynamicCacheState,
			renderMode: options.renderMode,
			preserveClientResponseHeaders: rscResponsePolicy.cacheState !== "MISS",
			expireSeconds,
			revalidateSeconds: resolveAppPageCacheWriteRevalidateSeconds({
				isDynamicError: options.isDynamicError,
				isForceStatic: options.isForceStatic,
				revalidateSeconds
			}),
			waitUntil(promise) {
				options.waitUntil?.(promise);
			}
		});
	}
	const fontData = createAppPageFontData({
		getLinks: options.getFontLinks,
		getPreloads: options.getFontPreloads,
		getStyles: options.getFontStyles
	});
	const fontLinkHeader = buildAppPageFontLinkHeader(fontData.preloads);
	let dynamicUsedDuringHtmlRender = false;
	let renderEnd;
	const htmlRender = await renderAppPageHtmlStreamWithRecovery({
		onShellRendered() {
			if (!options.isProduction) renderEnd = performance.now();
		},
		renderErrorBoundaryResponse(error) {
			const capturedRscError = rscErrorTracker.getCapturedError();
			return options.renderErrorBoundaryResponse(capturedRscError ?? error, capturedRscError === null ? "ssr" : "rsc");
		},
		async renderHtmlStream() {
			const ssrHandler = await options.loadSsrHandler();
			return renderAppPageHtmlStream({
				capturedRscDataRef,
				getInitialNavigationCacheMetadata: () => {
					let kind;
					if (options.isForceStatic) kind = "static";
					else if (options.isForceDynamic || dynamicUsedDuringHtmlRender || peekDynamicUsage()) kind = "dynamic";
					else {
						const observation = options.peekRenderObservationState?.();
						kind = observation && (observation.dynamicFetches.length > 0 || observation.requestApis.length > 0) ? "dynamic" : "static";
					}
					return {
						kind,
						...kind === "dynamic" && options.dynamicStaleTimeSeconds !== void 0 && options.isPrerender !== true && !shouldCaptureRscForCacheMetadata ? { dynamicStaleTimeSeconds: options.dynamicStaleTimeSeconds } : {}
					};
				},
				fontData,
				hasCustomGlobalError: options.hasCustomGlobalError,
				navigationContext: options.getNavigationContext(),
				basePath: options.basePath,
				clientTraceMetadata: options.clientTraceMetadata,
				reactMaxHeadersLength: options.reactMaxHeadersLength,
				rootParams: options.rootParams,
				pprFallbackShellSignal: options.pprFallbackShellSignal,
				formState: options.formState ?? null,
				rscStream: rscForResponse,
				scriptNonce: options.scriptNonce,
				sideStream: rscCapture.sideStream,
				ssrHandler,
				fallbackToErrorDocumentOnShellError: options.isPrerender === true && options.isSpeculativePrerender === true ? false : void 0,
				waitForAllReady: shouldWaitForAllReady
			});
		},
		renderSpecialErrorResponse(specialError) {
			return options.renderPageSpecialError(specialError);
		},
		resolveSpecialError: resolveAppPageSpecialError
	});
	if (htmlRender.response) return htmlRender.response;
	let htmlStream = htmlRender.htmlStream;
	if (!htmlStream) throw new Error("[vinext] Expected an HTML stream when no fallback response was returned");
	const linkHeader = buildAppPageLinkHeader(htmlRender.linkHeader, fontLinkHeader, options.reactMaxHeadersLength);
	if (options.isPrerender === true) await htmlRender.metadataReady;
	if (options.hasLoadingBoundary || !probePageBeforeRender) {
		const captured = rscErrorTracker.getCapturedSpecialError();
		if (captured) {
			const specialError = resolveAppPageSpecialError(captured);
			if (specialError) {
				htmlStream.cancel().catch(() => {});
				return options.renderPageSpecialError(specialError);
			}
		}
	}
	let requestCacheLifeForPrerender = null;
	let dynamicUsedDuringRender = options.consumeDynamicUsage();
	dynamicUsedDuringHtmlRender = dynamicUsedDuringRender;
	const stopSpeculativeMetadataWaitOnDynamicUsage = options.isSpeculativePrerender === true && shouldReadRequestCacheLifeForPrerender ? () => {
		if (dynamicUsedDuringRender || (options.peekDynamicUsage?.() ?? peekDynamicUsage())) {
			dynamicUsedDuringRender = true;
			dynamicUsedDuringHtmlRender = true;
			return true;
		}
		return false;
	} : void 0;
	if (shouldWaitForAllReady || shouldReadRequestCacheLifeForPrerender) await settleCapturedRscRenderForCacheMetadata(htmlRender.capturedRscData, stopSpeculativeMetadataWaitOnDynamicUsage);
	if (shouldReadRequestCacheLifeForPrerender) {
		requestCacheLifeForPrerender = readRequestCacheLifeForPrerender(options);
		({expireSeconds, revalidateSeconds} = applyRequestCacheLife({
			expireSeconds,
			requestCacheLife: requestCacheLifeForPrerender,
			revalidateSeconds
		}));
	}
	dynamicUsedDuringRender = dynamicUsedDuringRender || options.consumeDynamicUsage();
	dynamicUsedDuringHtmlRender = dynamicUsedDuringRender;
	const draftCookie = options.getDraftModeCookieHeader();
	let dynamicUsedBeforeContextCleanup = dynamicUsedDuringRender;
	const safeHtmlStream = deferUntilStreamConsumed(htmlStream, () => {
		dynamicUsedBeforeContextCleanup = dynamicUsedBeforeContextCleanup || options.consumeDynamicUsage();
		dynamicUsedDuringHtmlRender = dynamicUsedBeforeContextCleanup;
		options.clearRequestContext();
	});
	const htmlResponsePolicy = resolveAppPageHtmlResponsePolicy({
		dynamicUsedDuringRender,
		isProgressiveActionRender: options.isProgressiveActionRender === true,
		hasScriptNonce: Boolean(options.scriptNonce),
		isDraftMode: options.isDraftMode,
		isDynamicError: options.isDynamicError,
		isForceDynamic: options.isForceDynamic,
		isForceStatic: options.isForceStatic,
		isProduction: options.isProduction,
		expireSeconds,
		revalidateSeconds
	});
	const htmlResponseTiming = buildResponseTiming({
		compileEnd,
		handlerStart: options.handlerStart,
		isProduction: options.isProduction,
		renderEnd,
		responseKind: "html"
	});
	if (htmlRender.shellErrorRecovered) {
		const response = buildAppPageHtmlResponse(safeHtmlStream, {
			draftCookie,
			linkHeader,
			isEdgeRuntime: options.isEdgeRuntime,
			middlewareContext: {
				headers: options.middlewareContext.headers,
				status: 500
			},
			policy: { cacheControl: NEVER_CACHE_CONTROL },
			requestCacheLife: requestCacheLifeForPrerender,
			timing: htmlResponseTiming
		});
		applyCdnResponseHeaders(response.headers, { cacheControl: NEVER_CACHE_CONTROL });
		return response;
	}
	const shouldSpeculativelyWriteCache = options.isProduction && shouldCaptureRscForCacheMetadata && !options.isEdgeRuntime && revalidateSeconds === null && !options.isDynamicError && !options.isForceStatic && !options.scriptNonce && options.isProgressiveActionRender !== true && !dynamicUsedDuringRender;
	if (htmlResponsePolicy.shouldWriteToCache || shouldSpeculativelyWriteCache) {
		const isrResponse = buildAppPageHtmlResponse(safeHtmlStream, {
			draftCookie,
			linkHeader,
			isEdgeRuntime: options.isEdgeRuntime,
			middlewareContext: options.middlewareContext,
			policy: htmlResponsePolicy,
			requestCacheLife: requestCacheLifeForPrerender,
			timing: htmlResponseTiming
		});
		if (options.isPrerender === true) return isrResponse;
		return finalizeAppPageHtmlCacheResponse(isrResponse, {
			capturedDynamicUsageBeforeContextCleanup() {
				return dynamicUsedBeforeContextCleanup;
			},
			capturedRscDataPromise: capturedRscDataRef.value,
			cleanPathname: options.cleanPathname,
			consumeDynamicUsage: options.consumeDynamicUsage,
			consumeRenderObservationState: options.consumeRenderObservationState,
			createHtmlRenderObservation(input) {
				return createAppPageRenderObservation({
					boundaryOutcome: { kind: "success" },
					cacheability: "public",
					cacheTags: input.cacheTags,
					cleanPathname: options.cleanPathname,
					completeness: "complete",
					output: htmlOutputScope,
					params: options.navigationParams,
					state: input.state
				});
			},
			createRscRenderObservation(input) {
				return createAppPageRenderObservation({
					boundaryOutcome: { kind: "success" },
					cacheability: "public",
					cacheTags: input.cacheTags,
					cleanPathname: options.cleanPathname,
					completeness: "complete",
					output: rscOutputScope,
					params: options.navigationParams,
					state: input.state
				});
			},
			getPageTags() {
				return options.getPageTags();
			},
			getRequestCacheLife() {
				return readRequestCacheLifeForCachePolicy(options);
			},
			isrDebug: options.isrDebug,
			isrHtmlKey: options.isrHtmlKey,
			isrRscKey: options.isrRscKey,
			isrSet: options.isrSet,
			interceptionContext: options.interceptionContext,
			omitPendingDynamicCacheState: options.omitPendingDynamicCacheState,
			preserveClientResponseHeaders: !htmlResponsePolicy.shouldWriteToCache,
			expireSeconds,
			revalidateSeconds: resolveAppPageCacheWriteRevalidateSeconds({
				isDynamicError: options.isDynamicError,
				isForceStatic: options.isForceStatic,
				revalidateSeconds
			}),
			waitUntil(cachePromise) {
				options.waitUntil?.(cachePromise);
			}
		});
	}
	return buildAppPageHtmlResponse(safeHtmlStream, {
		draftCookie,
		linkHeader,
		isEdgeRuntime: options.isEdgeRuntime,
		middlewareContext: options.middlewareContext,
		policy: htmlResponsePolicy,
		requestCacheLife: requestCacheLifeForPrerender,
		timing: htmlResponseTiming
	});
}
async function settleCapturedRscRenderForCacheMetadata(capturedRscDataPromise, shouldStopWaiting) {
	if (!capturedRscDataPromise) return;
	if (!shouldStopWaiting) {
		try {
			await capturedRscDataPromise;
		} catch {}
		return;
	}
	let settled = false;
	const settledPromise = capturedRscDataPromise.catch(() => {}).then(() => {
		settled = true;
	});
	try {
		while (!settled && !shouldStopWaiting()) await Promise.race([settledPromise, new Promise((resolve) => setTimeout(resolve, 0))]);
	} finally {}
}
//#endregion
export { renderAppPageLifecycle };
