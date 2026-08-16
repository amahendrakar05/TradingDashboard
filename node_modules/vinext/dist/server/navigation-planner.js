import { splitPathnameForRouteMatch } from "../routing/utils.js";
import { stripBasePath } from "../utils/base-path.js";
import { compareAppElementsSlotIds } from "./app-elements-wire.js";
import "./app-elements.js";
import { matchRoutePattern, matchRoutePatternPrefix, matchRoutePatternWithOptionalDynamicSegments } from "../routing/route-pattern.js";
import { resolveHardNavigationTargetFromRscResponse, resolveRscCompatibilityNavigationDecision } from "./app-rsc-cache-busting.js";
import { resolveRscRedirectLifecycleHop, resolveStreamedRscRedirectLifecycleHop } from "./app-browser-rsc-redirect.js";
import { NavigationTraceReasonCodes, createNavigationLifecycleTraceFields, createNavigationTrace } from "./navigation-trace.js";
import { verifyOperationTokenForCacheReuse } from "./operation-token.js";
//#region src/server/navigation-planner.ts
function mergeRscRedirectHistoryMode(navigationMode, redirectType) {
	return navigationMode === "push" || redirectType === "push" ? "push" : "replace";
}
const ROUTE_INTERCEPTION_CONTEXT_SEPARATOR = "\0";
const CACHE_ENTRY_PROOF_MISSING_CODE = "CP_CACHE_ENTRY_PROOF_MISSING";
function createRequestWorkDecision(options) {
	const traverseFields = options.work.kind === "traverseFlight" ? { traverseDirection: options.work.direction } : {};
	return {
		kind: "requestWork",
		token: options.state.nextOperationToken,
		work: options.work,
		trace: createNavigationTrace(NavigationTraceReasonCodes.requestWork, {
			eventKind: options.eventKind,
			targetHref: getRequestedWorkTargetHref(options.work),
			...traverseFields
		})
	};
}
function getRequestedWorkTargetHref(work) {
	switch (work.kind) {
		case "flight":
		case "prefetch": return work.href;
		case "traverseFlight": return null;
		default: throw new Error("[vinext] Unknown requested navigation work: " + String(work));
	}
}
function createRscFetchResultTraceFields(facts, fields = {}) {
	return {
		fetchResultSource: facts.source,
		...fields
	};
}
function createRscFetchResultHardNavigationDecision(options) {
	return {
		discardBody: options.discardBody,
		kind: "hardNavigate",
		...options.hardNavigationMode !== void 0 ? { hardNavigationMode: options.hardNavigationMode } : {},
		reason: options.reason,
		trace: createNavigationTrace(options.reasonCode, createRscFetchResultTraceFields(options.facts, {
			...options.redirectSignal !== void 0 ? { redirectSignal: options.redirectSignal } : {},
			redirectDepth: options.facts.redirectDepth,
			targetHref: options.url
		})),
		url: options.url
	};
}
function createRscFetchResultFollowRedirectDecision(options) {
	return {
		discardBody: options.discardBody,
		kind: "followRedirect",
		redirect: options.redirect,
		trace: createNavigationTrace(NavigationTraceReasonCodes.redirectFollow, createRscFetchResultTraceFields(options.facts, {
			redirectDepth: options.redirect.redirectDepth,
			redirectSignal: options.redirectSignal,
			targetHref: options.redirect.href
		}))
	};
}
function mapRscRedirectTerminalReason(reason) {
	switch (reason) {
		case "externalRedirect": return {
			hardNavigationReason: "externalRedirectTarget",
			traceReasonCode: NavigationTraceReasonCodes.redirectTerminalExternal
		};
		case "maxRedirectsExceeded": return {
			hardNavigationReason: "redirectDepthExhausted",
			traceReasonCode: NavigationTraceReasonCodes.redirectTerminalDepth
		};
		default: throw new Error("[vinext] Unknown RSC redirect terminal reason: " + String(reason));
	}
}
function classifyRscFetchResult(facts) {
	if (!facts.responseOk || !facts.isRscContentType || !facts.hasBody) {
		const url = resolveHardNavigationTargetFromRscResponse(facts.responseUrl, facts.currentHref, facts.origin);
		return createRscFetchResultHardNavigationDecision({
			discardBody: false,
			facts,
			reason: "invalidRscPayload",
			reasonCode: NavigationTraceReasonCodes.invalidRscPayload,
			url
		});
	}
	const compatibilityDecision = resolveRscCompatibilityNavigationDecision({
		clientCompatibilityId: facts.clientCompatibilityId,
		currentHref: facts.currentHref,
		origin: facts.origin,
		responseCompatibilityId: facts.compatibilityIdHeader,
		responseUrl: facts.responseUrl
	});
	if (compatibilityDecision.kind === "hard-navigate") return createRscFetchResultHardNavigationDecision({
		discardBody: false,
		facts,
		reason: "rscCompatibilityMismatch",
		reasonCode: NavigationTraceReasonCodes.rscCompatibilityMismatch,
		url: compatibilityDecision.hardNavigationTarget
	});
	if (facts.responseUrl !== null) {
		const redirectDecision = resolveRscRedirectLifecycleHop({
			currentHref: facts.currentHref,
			historyUpdateMode: facts.effectiveHistoryUpdateMode,
			origin: facts.origin,
			redirectDepth: facts.redirectDepth,
			requestPreviousNextUrl: facts.requestPreviousNextUrl,
			responseUrl: facts.responseUrl
		});
		if (redirectDecision.kind === "terminal-hard-navigation") {
			const terminalReason = mapRscRedirectTerminalReason(redirectDecision.reason);
			return createRscFetchResultHardNavigationDecision({
				discardBody: false,
				facts,
				reason: terminalReason.hardNavigationReason,
				reasonCode: terminalReason.traceReasonCode,
				redirectSignal: "response-url",
				url: redirectDecision.href
			});
		}
		if (redirectDecision.kind === "follow") return createRscFetchResultFollowRedirectDecision({
			discardBody: false,
			facts,
			redirect: {
				href: redirectDecision.href,
				historyUpdateMode: facts.effectiveHistoryUpdateMode,
				previousNextUrl: redirectDecision.previousNextUrl,
				redirectDepth: redirectDecision.redirectDepth
			},
			redirectSignal: "response-url"
		});
	}
	if (facts.streamedRedirectTarget !== null) {
		const streamedHistoryMode = mergeRscRedirectHistoryMode(facts.effectiveHistoryUpdateMode, facts.streamedRedirectType);
		const redirectDecision = resolveStreamedRscRedirectLifecycleHop({
			currentHref: facts.currentHref,
			historyUpdateMode: streamedHistoryMode,
			origin: facts.origin,
			redirectDepth: facts.redirectDepth,
			requestPreviousNextUrl: facts.requestPreviousNextUrl,
			streamedRedirectTarget: facts.streamedRedirectTarget
		});
		if (redirectDecision.kind === "terminal-hard-navigation") {
			const terminalReason = mapRscRedirectTerminalReason(redirectDecision.reason);
			return createRscFetchResultHardNavigationDecision({
				discardBody: true,
				facts,
				reason: terminalReason.hardNavigationReason,
				reasonCode: terminalReason.traceReasonCode,
				redirectSignal: "streamed-header",
				hardNavigationMode: streamedHistoryMode === "push" ? "assign" : "replace",
				url: redirectDecision.href
			});
		}
		if (redirectDecision.kind === "follow") return createRscFetchResultFollowRedirectDecision({
			discardBody: true,
			facts,
			redirect: {
				href: redirectDecision.href,
				historyUpdateMode: streamedHistoryMode,
				previousNextUrl: redirectDecision.previousNextUrl,
				redirectDepth: redirectDecision.redirectDepth
			},
			redirectSignal: "streamed-header"
		});
		return createRscFetchResultHardNavigationDecision({
			discardBody: true,
			facts,
			reason: "streamedRedirectLoop",
			reasonCode: NavigationTraceReasonCodes.streamedRedirectLoop,
			redirectSignal: "streamed-header",
			url: redirectDecision.href
		});
	}
	return {
		discardBody: false,
		kind: "proceedToCommit",
		trace: createNavigationTrace(NavigationTraceReasonCodes.proceedToCommit, createRscFetchResultTraceFields(facts))
	};
}
function createEarlyNavigationIntentTrace(reasonCode, facts) {
	return createNavigationTrace(reasonCode, { targetHref: facts.targetHref });
}
function classifyEarlyNavigationIntent(facts) {
	let current;
	let next;
	try {
		current = new URL(facts.currentHref);
		next = new URL(facts.targetHref, facts.currentHref);
	} catch {
		return {
			bypassNavigationCache: false,
			kind: "flightNavigation",
			trace: createEarlyNavigationIntentTrace(NavigationTraceReasonCodes.crossDocumentFlight, facts)
		};
	}
	const samePathname = current.origin === next.origin && stripBasePath(current.pathname, facts.basePath) === stripBasePath(next.pathname, facts.basePath);
	const sameSearch = current.searchParams.toString() === next.searchParams.toString();
	if (samePathname && sameSearch && next.hash !== "") return {
		hash: next.hash,
		kind: "sameDocumentScroll",
		mode: facts.mode,
		scroll: facts.scroll,
		trace: createEarlyNavigationIntentTrace(NavigationTraceReasonCodes.sameDocumentScroll, facts)
	};
	if (samePathname && !sameSearch) return {
		bypassNavigationCache: true,
		kind: "flightNavigation",
		trace: createEarlyNavigationIntentTrace(NavigationTraceReasonCodes.samePageSearch, facts)
	};
	return {
		bypassNavigationCache: false,
		kind: "flightNavigation",
		trace: createEarlyNavigationIntentTrace(NavigationTraceReasonCodes.crossDocumentFlight, facts)
	};
}
function classifyVisitedResponseCacheCandidate(facts) {
	if (facts.candidate === "missing") return { kind: "miss" };
	if (!facts.mountedSlotsMatch) return {
		kind: "evict",
		reason: "mountedSlotsMismatch"
	};
	if (facts.navigationKind === "refresh") return {
		kind: "evict",
		reason: "refresh"
	};
	if (!facts.fresh) return {
		kind: "evict",
		reason: "stale"
	};
	return { kind: "reuse" };
}
function createNavigationReuseTrace(code, facts, fields = {}) {
	return createNavigationTrace(code, {
		eventKind: facts.navigationKind,
		targetHref: facts.targetHref,
		...fields
	});
}
function createFreshFetchDecision(facts, reason) {
	return {
		kind: "fetchFresh",
		reason,
		trace: createNavigationReuseTrace(NavigationTraceReasonCodes.fetchFresh, facts, { freshFetchReason: reason })
	};
}
function classifyNavigationReuse(facts) {
	if (facts.navigationKind === "refresh") return createFreshFetchDecision(facts, "refresh");
	if (!facts.bypassNavigationCache && facts.visitedResponse.status === "available") return {
		kind: "reuseVisitedResponse",
		trace: createNavigationReuseTrace(NavigationTraceReasonCodes.visitedResponseReuse, facts)
	};
	if (!facts.bypassNavigationCache && facts.prefetch.status === "available") return {
		kind: "consumePrefetch",
		trace: createNavigationReuseTrace(NavigationTraceReasonCodes.prefetchResponseReuse, facts)
	};
	if (facts.navigationKind === "navigate") {
		if (facts.optimisticRouteShell.status === "available") return {
			kind: "attemptOptimisticRouteShell",
			trace: createNavigationReuseTrace(NavigationTraceReasonCodes.optimisticRouteShell, facts)
		};
		return createFreshFetchDecision(facts, facts.bypassNavigationCache ? "cacheBypassed" : facts.optimisticRouteShell.reason);
	}
	if (facts.bypassNavigationCache) return createFreshFetchDecision(facts, "cacheBypassed");
	return createFreshFetchDecision(facts, "cacheMiss");
}
function classifyNavigationPrefetchProbe(facts) {
	if (facts.visitedResponse.status === "available") return {
		kind: "skip",
		reason: "visitedResponseAvailable"
	};
	if (facts.navigationKind === "refresh") return {
		kind: "skip",
		reason: "refresh"
	};
	if (facts.bypassNavigationCache) return {
		kind: "skip",
		reason: "cacheBypassed"
	};
	return { kind: "probe" };
}
function createSnapshotRouteTopology(snapshot) {
	return {
		layoutIds: snapshot.layoutIds,
		rootBoundaryId: snapshot.rootBoundaryId,
		rootLayoutTreePath: snapshot.rootBoundaryId,
		slotBindings: snapshot.slotBindings
	};
}
function stripInterceptionContextFromRouteId(routeId) {
	const separatorIndex = routeId.indexOf(ROUTE_INTERCEPTION_CONTEXT_SEPARATOR);
	return separatorIndex === -1 ? routeId : routeId.slice(0, separatorIndex);
}
function matchedUrlFromConcreteRouteId(routeId) {
	const normalizedRouteId = stripInterceptionContextFromRouteId(routeId);
	if (!normalizedRouteId.startsWith("route:/")) return null;
	return normalizedRouteId.slice(6);
}
function getMatchedUrlPathname(matchedUrl) {
	try {
		return new URL(matchedUrl, "https://vinext.local").pathname;
	} catch {
		const [withoutHash = ""] = matchedUrl.split("#");
		const [pathname = ""] = withoutHash.split("?");
		return pathname === "" ? "/" : pathname;
	}
}
function splitMatchedUrlIntoRouteParts(matchedUrl) {
	return splitPathnameForRouteMatch(getMatchedUrlPathname(matchedUrl));
}
function findRouteManifestRouteByMatchedUrl(routeManifest, matchedUrl) {
	const urlParts = splitMatchedUrlIntoRouteParts(matchedUrl);
	for (const route of routeManifest.segmentGraph.routes.values()) if (matchRoutePattern(urlParts, route.patternParts) !== null) return route;
	return null;
}
function routeManifestRouteMatchesUrl(route, matchedUrl) {
	return matchRoutePattern(splitMatchedUrlIntoRouteParts(matchedUrl), route.patternParts) !== null;
}
function findRouteManifestRouteByIdOrMatchedUrl(options) {
	const routeId = stripInterceptionContextFromRouteId(options.routeId);
	const route = options.routeManifest.segmentGraph.routes.get(routeId);
	if (route && routeManifestRouteMatchesUrl(route, options.matchedUrl)) return route;
	const concreteRouteMatchedUrl = route === void 0 ? matchedUrlFromConcreteRouteId(options.routeId) : null;
	if (concreteRouteMatchedUrl !== null) {
		const concreteRoute = findRouteManifestRouteByMatchedUrl(options.routeManifest, concreteRouteMatchedUrl);
		if (concreteRoute !== null) return concreteRoute;
	}
	return findRouteManifestRouteByMatchedUrl(options.routeManifest, options.matchedUrl);
}
function findRouteManifestRouteForSnapshot(routeManifest, snapshot) {
	if (snapshot.interception !== null) return findRouteManifestRouteByIdOrMatchedUrl({
		matchedUrl: snapshot.interception.sourceMatchedUrl,
		routeId: snapshot.interception.sourceRouteId,
		routeManifest
	});
	return findRouteManifestRouteByIdOrMatchedUrl({
		matchedUrl: snapshot.matchedUrl,
		routeId: snapshot.routeId,
		routeManifest
	});
}
function resolveRouteManifestSlotBindings(routeManifest, route) {
	const bindings = [];
	for (const slotId of route.slotIds) {
		const binding = routeManifest.segmentGraph.slotBindings.get(`${route.id}::${slotId}`);
		if (!binding) continue;
		bindings.push({
			ownerLayoutId: binding.ownerLayoutId,
			slotId: binding.slotId,
			state: binding.state
		});
	}
	return bindings.sort((left, right) => compareAppElementsSlotIds(left.slotId, right.slotId));
}
function resolveRouteManifestRootLayoutTreePath(routeManifest, route) {
	if (route.rootBoundaryId === null) return null;
	return routeManifest.segmentGraph.rootBoundaries.get(route.rootBoundaryId)?.treePath ?? null;
}
function resolveRouteTopologySnapshot(options) {
	const route = options.routeManifest === null ? null : findRouteManifestRouteForSnapshot(options.routeManifest, options.snapshot);
	if (route === null || options.routeManifest === null) return { kind: "unknown" };
	const shouldUseManifestSlotBindings = options.slotBindingSource === "manifestTarget" && options.snapshot.interception === null;
	return {
		kind: "known",
		topology: {
			layoutIds: route.layoutIds,
			rootBoundaryId: route.rootBoundaryId,
			rootLayoutTreePath: resolveRouteManifestRootLayoutTreePath(options.routeManifest, route),
			slotBindings: shouldUseManifestSlotBindings ? resolveRouteManifestSlotBindings(options.routeManifest, route) : options.snapshot.slotBindings
		}
	};
}
function findRouteManifestInterceptionForProof(routeManifest, proof) {
	const sourceParts = splitMatchedUrlIntoRouteParts(proof.sourceMatchedUrl);
	const targetParts = splitMatchedUrlIntoRouteParts(proof.targetMatchedUrl);
	const targetRoute = findRouteManifestRouteByIdOrMatchedUrl({
		matchedUrl: proof.targetMatchedUrl,
		routeId: proof.targetRouteId,
		routeManifest
	});
	const candidateInterceptions = routeManifest.segmentGraph.interceptionsBySlotId.get(proof.slotId) ?? [];
	for (const interception of candidateInterceptions) {
		if (!matchRoutePatternPrefix(sourceParts, interception.sourcePatternParts)) continue;
		const exactTargetParams = matchRoutePattern(targetParts, interception.targetPatternParts);
		const allowsMiddlewareRewriteTarget = exactTargetParams === null && matchRoutePatternWithOptionalDynamicSegments(targetParts, interception.targetPatternParts);
		if (exactTargetParams === null && !allowsMiddlewareRewriteTarget) continue;
		if (!allowsMiddlewareRewriteTarget && interception.targetRouteId !== null && targetRoute?.id !== interception.targetRouteId) continue;
		return interception;
	}
	return null;
}
function createRootBoundaryTraceFields(options) {
	if (options.state.traceFields) return {
		...options.state.traceFields,
		currentRootLayoutTreePath: options.currentRootLayoutTreePath,
		nextRootLayoutTreePath: options.nextRootLayoutTreePath
	};
	return createNavigationLifecycleTraceFields({
		currentRootLayoutTreePath: options.currentRootLayoutTreePath,
		currentVisibleCommitVersion: options.state.visibleCommitVersion,
		nextRootLayoutTreePath: options.nextRootLayoutTreePath,
		startedVisibleCommitVersion: options.event.token.baseVisibleCommitVersion
	});
}
function classifyRootBoundaryTransition(currentRootBoundaryId, nextRootBoundaryId) {
	if (currentRootBoundaryId === null || nextRootBoundaryId === null) return "rootBoundaryUnknown";
	return currentRootBoundaryId === nextRootBoundaryId ? "currentRootBoundary" : "rootBoundaryChanged";
}
function resolveSameLayoutAncestorPersistence(currentSnapshot, targetSnapshot) {
	return resolveSameLayoutAncestorPersistenceForTopologies(createSnapshotRouteTopology(currentSnapshot), createSnapshotRouteTopology(targetSnapshot));
}
function resolveSameLayoutAncestorPersistenceForTopologies(currentTopology, targetTopology) {
	if (classifyRootBoundaryTransition(currentTopology.rootBoundaryId, targetTopology.rootBoundaryId) !== "currentRootBoundary") return [];
	const commonLayoutIds = [];
	const maxLength = Math.min(currentTopology.layoutIds.length, targetTopology.layoutIds.length);
	for (let index = 0; index < maxLength; index++) {
		const layoutId = currentTopology.layoutIds[index];
		if (layoutId !== targetTopology.layoutIds[index]) break;
		commonLayoutIds.push(layoutId);
	}
	return commonLayoutIds;
}
function resolveMountedParallelSlotPersistence(currentSnapshot, targetSnapshot) {
	return resolveMountedParallelSlotPersistenceForLayouts(currentSnapshot, resolveSameLayoutAncestorPersistence(currentSnapshot, targetSnapshot));
}
function resolveMountedParallelSlotPersistenceForLayouts(currentSnapshot, preservedLayoutIds) {
	if (preservedLayoutIds.length === 0) return [];
	const preservedLayoutIdSet = new Set(preservedLayoutIds);
	const preservedSlotIds = [];
	const seenSlotIds = /* @__PURE__ */ new Set();
	for (const slot of currentSnapshot.mountedParallelSlots) {
		if (slot.ownerLayoutId === null) continue;
		if (!preservedLayoutIdSet.has(slot.ownerLayoutId)) continue;
		if (seenSlotIds.has(slot.slotId)) continue;
		preservedSlotIds.push(slot.slotId);
		seenSlotIds.add(slot.slotId);
	}
	return preservedSlotIds;
}
function resolveCurrentRootBoundaryElementPersistence(currentSnapshot, targetSnapshot) {
	const preservedLayoutIds = resolveSameLayoutAncestorPersistence(currentSnapshot, targetSnapshot);
	return [...preservedLayoutIds, ...resolveMountedParallelSlotPersistenceForLayouts(currentSnapshot, preservedLayoutIds)];
}
function resolveCurrentRootBoundaryCommitElementPersistence(options) {
	return resolveSameLayoutAncestorPersistenceForTopologies(options.currentTopology, options.targetTopology);
}
function resolveCurrentRootBoundaryCommitSlotPersistence(options) {
	if (options.lane === "traverse") return [];
	const preservedLayoutIds = resolveSameLayoutAncestorPersistenceForTopologies(options.currentTopology, options.targetTopology);
	if (preservedLayoutIds.length === 0) return [];
	return resolveDefaultOrUnmatchedSlotPersistenceForLayouts({
		currentSlotBindings: options.currentTopology.slotBindings,
		preservedLayoutIds,
		targetSlotBindings: options.targetTopology.slotBindings
	});
}
/**
* Default/unmatched slot preservation law:
*
* A target default/unmatched slot may reuse previous content only when:
* - the slot's owner layout is part of the preserved layout ancestor set;
* - the current visible snapshot proves the same slot had renderable content;
* - the navigation is not a traversal.
*
* Wire absence and UNMATCHED_SLOT markers are not semantic proof.
*/
function resolveDefaultOrUnmatchedSlotPersistenceForLayouts(options) {
	const preservedLayoutIdSet = new Set(options.preservedLayoutIds);
	const slotIdsWithContent = /* @__PURE__ */ new Set();
	for (const binding of options.currentSlotBindings) {
		if (binding.state === "unmatched") continue;
		slotIdsWithContent.add(binding.slotId);
	}
	const preservedSlotIds = [];
	const seenSlotIds = /* @__PURE__ */ new Set();
	for (const binding of options.targetSlotBindings) {
		if (binding.ownerLayoutId === null) continue;
		if (!preservedLayoutIdSet.has(binding.ownerLayoutId)) continue;
		if (binding.state === "active") continue;
		if (!slotIdsWithContent.has(binding.slotId)) continue;
		if (seenSlotIds.has(binding.slotId)) continue;
		preservedSlotIds.push(binding.slotId);
		seenSlotIds.add(binding.slotId);
	}
	return preservedSlotIds.sort(compareAppElementsSlotIds);
}
function getVisibleInterceptionSourceIdentity(snapshot) {
	if (snapshot.interception) return {
		matchedUrl: snapshot.interception.sourceMatchedUrl,
		routeId: snapshot.interception.sourceRouteId
	};
	return {
		matchedUrl: matchedUrlFromConcreteRouteId(snapshot.routeId) ?? snapshot.matchedUrl,
		routeId: snapshot.routeId
	};
}
function createInterceptionProofRejectedDecision(options) {
	return {
		kind: "hardNavigate",
		reason: "interceptionProofRejected",
		token: options.event.token,
		trace: createNavigationTrace(options.reasonCode, options.traceFields),
		url: options.event.result.href
	};
}
function evaluateCacheEntryReuseProof(proof) {
	if (proof === void 0) return {
		kind: "accepted",
		decision: null
	};
	if (proof.decision === null) return {
		kind: "rejected",
		decision: null
	};
	if (proof.decision.canReuse) return {
		kind: "accepted",
		decision: proof.decision
	};
	return {
		kind: "rejected",
		decision: proof.decision
	};
}
function createCacheProofRejectedTraceFields(traceFields, decision) {
	if (decision === null) return {
		...traceFields,
		cacheProofCode: CACHE_ENTRY_PROOF_MISSING_CODE
	};
	return {
		...traceFields,
		cacheProofCode: decision.code,
		cacheProofMode: decision.mode,
		cacheProofScope: decision.scope
	};
}
function createCacheProofRejectedDecision(options) {
	return {
		kind: "hardNavigate",
		reason: "cacheProofRejected",
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.cacheProofRejected, createCacheProofRejectedTraceFields(options.traceFields, options.rejection.decision)),
		url: options.event.result.href
	};
}
function createCacheReuseTokenRejectedDecision(options) {
	return {
		kind: "hardNavigate",
		reason: "cacheReuseTokenRejected",
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.cacheReuseTokenRejected, {
			...options.traceFields,
			cacheReuseTokenReason: options.reason
		}),
		url: options.event.result.href
	};
}
function createAcceptedCacheProofTraceFields(traceFields, decision) {
	if (decision === null) return traceFields;
	return {
		...traceFields,
		cacheProofCode: decision.code,
		cacheProofReuseClass: decision.reuseClass
	};
}
function createCacheEntryProposalFields(decision) {
	if (decision === null) return {};
	return { cacheEntryReuseDecision: decision };
}
function validateInterceptedPreservation(options) {
	const proof = options.targetSnapshot.interception;
	if (!proof) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedMissingProof
	};
	if (proof.targetMatchedUrl !== options.targetSnapshot.matchedUrl) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedTargetMismatch
	};
	const sourceIdentity = getVisibleInterceptionSourceIdentity(options.currentSnapshot);
	if (!options.restoredHistorySnapshot && (proof.sourceMatchedUrl !== sourceIdentity.matchedUrl || proof.sourceRouteId !== sourceIdentity.routeId)) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedUnknownSource
	};
	const declaredInterception = options.routeManifest === null ? null : findRouteManifestInterceptionForProof(options.routeManifest, proof);
	if (options.routeManifest !== null && declaredInterception === null) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedUndeclaredTopology
	};
	const preservedLayoutIds = resolveSameLayoutAncestorPersistenceForTopologies(options.currentTopology, options.targetTopology);
	if (preservedLayoutIds.length === 0) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedIncompatibleRoot
	};
	const preservedLayoutIdSet = new Set(preservedLayoutIds);
	const targetSlotBinding = options.targetTopology.slotBindings.find((binding) => binding.slotId === proof.slotId);
	if (!targetSlotBinding || targetSlotBinding.state !== "active" || targetSlotBinding.ownerLayoutId === null || !preservedLayoutIdSet.has(targetSlotBinding.ownerLayoutId)) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedMissingSlotProof
	};
	if (declaredInterception !== null && targetSlotBinding.ownerLayoutId !== declaredInterception.ownerLayoutId) return {
		kind: "rejected",
		reasonCode: NavigationTraceReasonCodes.interceptedRejectedUndeclaredTopology
	};
	return {
		kind: "approved",
		preserveElementIds: preservedLayoutIds,
		preservePreviousSlotIds: resolveDefaultOrUnmatchedSlotPersistenceForLayouts({
			currentSlotBindings: options.currentTopology.slotBindings,
			preservedLayoutIds,
			targetSlotBindings: options.targetTopology.slotBindings
		}).filter((slotId) => slotId !== proof.slotId)
	};
}
function planFlightResponseArrived(options) {
	const targetSnapshot = options.event.result.targetSnapshot;
	const currentTopology = resolveRouteTopologySnapshot({
		routeManifest: options.routeManifest,
		slotBindingSource: "snapshot",
		snapshot: options.state.visibleSnapshot
	});
	const targetTopology = resolveRouteTopologySnapshot({
		routeManifest: options.routeManifest,
		slotBindingSource: "manifestTarget",
		snapshot: targetSnapshot
	});
	const traceFields = createRootBoundaryTraceFields({
		currentRootLayoutTreePath: currentTopology.kind === "known" ? currentTopology.topology.rootLayoutTreePath : null,
		event: options.event,
		nextRootLayoutTreePath: targetTopology.kind === "known" ? targetTopology.topology.rootLayoutTreePath : null,
		state: options.state
	});
	if (options.event.token.lane === "prefetch") return {
		kind: "noCommit",
		reason: "prefetchOnly",
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.prefetchOnly, traceFields)
	};
	const cacheEntryProofEvaluation = evaluateCacheEntryReuseProof(options.event.result.cacheEntryReuseProof);
	if (cacheEntryProofEvaluation.kind === "rejected") return createCacheProofRejectedDecision({
		event: options.event,
		rejection: cacheEntryProofEvaluation,
		traceFields
	});
	const acceptedCacheEntryDecision = cacheEntryProofEvaluation.decision;
	if (acceptedCacheEntryDecision !== null) {
		const reuseVerdict = verifyOperationTokenForCacheReuse(options.event.token, {
			graphVersion: options.routeManifest?.graphVersion ?? null,
			installedCacheVariantFingerprint: null
		});
		if (!reuseVerdict.authorized) return createCacheReuseTokenRejectedDecision({
			event: options.event,
			reason: reuseVerdict.reason,
			traceFields
		});
	}
	const commitTraceFields = createAcceptedCacheProofTraceFields(traceFields, acceptedCacheEntryDecision);
	const cacheEntryProposalFields = createCacheEntryProposalFields(acceptedCacheEntryDecision);
	if (targetSnapshot.interception !== null) {
		if (currentTopology.kind === "unknown" || targetTopology.kind === "unknown") return createInterceptionProofRejectedDecision({
			event: options.event,
			reasonCode: NavigationTraceReasonCodes.interceptedRejectedUndeclaredTopology,
			traceFields: commitTraceFields
		});
		const validation = validateInterceptedPreservation({
			currentSnapshot: options.state.visibleSnapshot,
			currentTopology: currentTopology.topology,
			restoredHistorySnapshot: options.event.result.restoredHistorySnapshot === true,
			routeManifest: options.routeManifest,
			targetSnapshot,
			targetTopology: targetTopology.topology
		});
		if (validation.kind === "rejected") return createInterceptionProofRejectedDecision({
			event: options.event,
			reasonCode: validation.reasonCode,
			traceFields: commitTraceFields
		});
		return {
			kind: "proposeCommit",
			proposal: {
				...cacheEntryProposalFields,
				preserveAbsentSlots: false,
				preserveElementIds: validation.preserveElementIds,
				preservePreviousSlotIds: validation.preservePreviousSlotIds,
				reason: "interceptedCurrentRootBoundary",
				targetSnapshot
			},
			token: options.event.token,
			trace: createNavigationTrace(NavigationTraceReasonCodes.interceptedCommitCurrent, commitTraceFields)
		};
	}
	const transition = currentTopology.kind === "unknown" || targetTopology.kind === "unknown" ? "rootBoundaryUnknown" : classifyRootBoundaryTransition(currentTopology.topology.rootBoundaryId, targetTopology.topology.rootBoundaryId);
	if (transition === "rootBoundaryChanged") return {
		kind: "hardNavigate",
		reason: "rootBoundaryChanged",
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.rootBoundaryChanged, commitTraceFields),
		url: options.event.result.href
	};
	if (transition === "rootBoundaryUnknown") return {
		kind: "proposeCommit",
		proposal: {
			...cacheEntryProposalFields,
			preserveAbsentSlots: false,
			preserveElementIds: [],
			preservePreviousSlotIds: [],
			reason: "unprovenTopologyFallback",
			targetSnapshot
		},
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.rootBoundaryUnknown, commitTraceFields)
	};
	if (currentTopology.kind !== "known" || targetTopology.kind !== "known") throw new Error("[vinext] Current-root navigation planning requires manifest topology");
	return {
		kind: "proposeCommit",
		proposal: {
			...cacheEntryProposalFields,
			preserveAbsentSlots: false,
			preserveElementIds: resolveCurrentRootBoundaryCommitElementPersistence({
				currentTopology: currentTopology.topology,
				lane: options.event.token.lane,
				targetTopology: targetTopology.topology
			}),
			preservePreviousSlotIds: resolveCurrentRootBoundaryCommitSlotPersistence({
				currentTopology: currentTopology.topology,
				lane: options.event.token.lane,
				targetTopology: targetTopology.topology
			}),
			reason: "currentRootBoundary",
			targetSnapshot
		},
		token: options.event.token,
		trace: createNavigationTrace(NavigationTraceReasonCodes.commitCurrent, commitTraceFields)
	};
}
function planNavigation(input) {
	switch (input.event.kind) {
		case "navigate": return createRequestWorkDecision({
			eventKind: input.event.kind,
			state: input.state,
			work: {
				href: input.event.href,
				kind: "flight",
				mode: input.event.mode
			}
		});
		case "refresh": return createRequestWorkDecision({
			eventKind: input.event.kind,
			state: input.state,
			work: {
				href: input.state.visibleSnapshot.displayUrl,
				kind: "flight",
				mode: "refresh"
			}
		});
		case "traverse": return createRequestWorkDecision({
			eventKind: input.event.kind,
			state: input.state,
			work: {
				direction: input.event.direction,
				historyState: input.event.historyState,
				kind: "traverseFlight"
			}
		});
		case "prefetch": return createRequestWorkDecision({
			eventKind: input.event.kind,
			state: input.state,
			work: {
				href: input.event.href,
				kind: "prefetch"
			}
		});
		case "flightResponseArrived": return planFlightResponseArrived({
			event: input.event,
			routeManifest: input.routeManifest,
			state: input.state
		});
		default: {
			const _exhaustive = input.event;
			throw new Error("[vinext] Unknown navigation event: " + String(_exhaustive));
		}
	}
}
function classifyServerActionResult(facts) {
	if (facts.clientCompatibilityId === null) return {
		kind: "proceed",
		trace: createNavigationTrace(NavigationTraceReasonCodes.proceedToCommit, {})
	};
	if (!facts.isRscContentType) return {
		kind: "proceed",
		trace: createNavigationTrace(NavigationTraceReasonCodes.proceedToCommit, {})
	};
	if (resolveRscCompatibilityNavigationDecision({
		clientCompatibilityId: facts.clientCompatibilityId,
		currentHref: facts.currentHref,
		origin: facts.origin,
		responseCompatibilityId: facts.compatibilityIdHeader,
		responseUrl: facts.responseUrl
	}).kind === "compatible") return {
		kind: "proceed",
		trace: createNavigationTrace(NavigationTraceReasonCodes.proceedToCommit, {})
	};
	if (facts.actionRedirectHref !== null) return {
		kind: "hardNavigate",
		url: facts.actionRedirectHref,
		historyMode: facts.actionRedirectType === "push" ? "assign" : "replace",
		clearClientNavigationCaches: true,
		reason: "serverActionRedirectCompatibilityMismatch",
		trace: createNavigationTrace(NavigationTraceReasonCodes.serverActionRedirectCompatibilityMismatch, { targetHref: facts.actionRedirectHref })
	};
	const targetUrl = facts.currentHref;
	return {
		kind: "hardNavigate",
		url: targetUrl,
		clearClientNavigationCaches: false,
		reason: "serverActionRscCompatibilityMismatch",
		trace: createNavigationTrace(NavigationTraceReasonCodes.serverActionRscCompatibilityMismatch, { targetHref: targetUrl })
	};
}
function classifyRscNavigationError(facts) {
	return {
		kind: "hardNavigate",
		url: facts.currentHref,
		reason: "rscNavigationError",
		trace: createNavigationTrace(NavigationTraceReasonCodes.rscNavigationError, { targetHref: facts.currentHref })
	};
}
const navigationPlanner = {
	classifyEarlyNavigationIntent,
	classifyNavigationPrefetchProbe,
	classifyNavigationReuse,
	classifyRscFetchResult,
	classifyRscNavigationError,
	classifyRootBoundaryTransition,
	classifyServerActionResult,
	classifyVisitedResponseCacheCandidate,
	plan: planNavigation,
	resolveCurrentRootBoundaryElementPersistence,
	resolveMountedParallelSlotPersistence,
	resolveSameLayoutAncestorPersistence
};
//#endregion
export { navigationPlanner, resolveDefaultOrUnmatchedSlotPersistenceForLayouts };
