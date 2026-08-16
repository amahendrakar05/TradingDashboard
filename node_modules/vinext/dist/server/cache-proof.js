import { fnv1a64 } from "../utils/hash.js";
import { evaluateArtifactCompatibility } from "./artifact-compatibility.js";
import { findSortedStringPosition } from "../utils/sorted-array.js";
//#region src/server/cache-proof.ts
const CACHE_PROOF_MODEL_SCHEMA_VERSION = 1;
const DEFAULT_CACHE_VARIANT_BUDGET = {
	maxDimensionCount: 8,
	maxDimensionNameLength: 64,
	maxDimensionValueLength: 256,
	maxEncodedLength: 1024,
	maxValuesPerDimension: 8,
	maxVariantsPerRoute: 64
};
const ALL_RENDER_REQUEST_API_KINDS = [
	"connection",
	"cookies",
	"draftMode",
	"headers",
	"params",
	"searchParams"
];
const PUBLIC_UNSAFE_DIMENSION_SOURCES = /* @__PURE__ */ new Set([
	"auth",
	"cookie",
	"draft-mode",
	"header",
	"session"
]);
function buildBreakerFallback(code, fields = {}, mode = "renderFresh", scope = "affectedOutput") {
	return {
		kind: "breakerFallback",
		code,
		mode,
		scope,
		fields
	};
}
function sortedUnique(values) {
	return [...new Set(values)].sort();
}
function normalizeDimensionName(name) {
	return name.trim().toLowerCase();
}
function redactValue(value) {
	return `h:${fnv1a64(value)}`;
}
function sortedUniqueRedacted(values) {
	return sortedUnique(sortedUnique(values).map(redactValue));
}
function encodeParts(parts) {
	return JSON.stringify(parts);
}
function compareDimensions(a, b) {
	return a.source.localeCompare(b.source) || a.name.localeCompare(b.name) || a.privacy.localeCompare(b.privacy);
}
function encodeNullable(value) {
	return value;
}
function assertNever(value) {
	throw new Error(`Unhandled cache proof variant: ${String(value)}`);
}
function encodeOutputScope(output) {
	switch (output.kind) {
		case "app-html": return encodeParts([
			output.kind,
			output.routeId,
			encodeNullable(output.rootBoundaryId),
			encodeNullable(output.renderEpoch)
		]);
		case "app-rsc": return encodeParts([
			output.kind,
			output.routeId,
			encodeNullable(output.rootBoundaryId),
			encodeNullable(output.renderEpoch),
			encodeNullable(output.mountedSlotsFingerprint)
		]);
		case "layout": return encodeParts([
			output.kind,
			output.routeId,
			output.layoutId,
			encodeNullable(output.rootBoundaryId)
		]);
		case "page": return encodeParts([
			output.kind,
			output.routeId,
			output.pageId,
			encodeNullable(output.rootBoundaryId)
		]);
		case "route-handler": return encodeParts([
			output.kind,
			output.routeId,
			output.routeHandlerId
		]);
		case "slot": return encodeParts([
			output.kind,
			output.routeId,
			output.slotId,
			encodeNullable(output.rootBoundaryId)
		]);
		case "template": return encodeParts([
			output.kind,
			output.routeId,
			output.templateId,
			encodeNullable(output.rootBoundaryId)
		]);
		default: return assertNever(output);
	}
}
function validateBudgetNumber(name, value) {
	if (Number.isInteger(value) && value >= 0) return null;
	return buildBreakerFallback("CP_INVALID_VARIANT_BUDGET", { budgetField: name });
}
function validateBudget(budget) {
	return validateBudgetNumber("maxDimensionCount", budget.maxDimensionCount) ?? validateBudgetNumber("maxDimensionNameLength", budget.maxDimensionNameLength) ?? validateBudgetNumber("maxDimensionValueLength", budget.maxDimensionValueLength) ?? validateBudgetNumber("maxEncodedLength", budget.maxEncodedLength) ?? validateBudgetNumber("maxValuesPerDimension", budget.maxValuesPerDimension) ?? validateBudgetNumber("maxVariantsPerRoute", budget.maxVariantsPerRoute);
}
function buildDimension(input, budget) {
	const name = normalizeDimensionName(input.name);
	if (name.length === 0) return buildBreakerFallback("CP_DIMENSION_NAME_MISSING", { source: input.source });
	if (name.length > budget.maxDimensionNameLength) return buildBreakerFallback("CP_DIMENSION_NAME_TOO_LONG", {
		maxLength: budget.maxDimensionNameLength,
		nameHash: redactValue(name),
		source: input.source
	});
	if (input.privacy === "public" && PUBLIC_UNSAFE_DIMENSION_SOURCES.has(input.source)) return buildBreakerFallback("CP_UNSAFE_PUBLIC_DIMENSION", {
		name,
		source: input.source
	}, "privateUncacheable");
	const values = sortedUnique(input.values);
	if (values.length === 0) return buildBreakerFallback("CP_DIMENSION_VALUES_MISSING", {
		name,
		source: input.source
	});
	if (values.length > budget.maxValuesPerDimension) return buildBreakerFallback("CP_DIMENSION_VALUE_COUNT_EXCEEDED", {
		maxValues: budget.maxValuesPerDimension,
		name,
		source: input.source,
		valueCount: values.length
	});
	for (const value of values) if (value.length > budget.maxDimensionValueLength) return buildBreakerFallback("CP_DIMENSION_VALUE_TOO_LONG", {
		maxLength: budget.maxDimensionValueLength,
		name,
		source: input.source,
		valueHash: redactValue(value)
	});
	const valueHashes = values.map(redactValue);
	return {
		encoded: encodeParts([
			input.source,
			input.privacy,
			name,
			valueHashes
		]),
		name,
		privacy: input.privacy,
		source: input.source,
		valueCount: valueHashes.length,
		valueHashes
	};
}
function isCacheProofBreakerFallback(value) {
	return "code" in value;
}
function getDimensionBucket(bySource, source, privacy) {
	const existingByPrivacy = bySource.get(source);
	const byPrivacy = existingByPrivacy ?? /* @__PURE__ */ new Map();
	if (!existingByPrivacy) bySource.set(source, byPrivacy);
	const existingByName = byPrivacy.get(privacy);
	const byName = existingByName ?? /* @__PURE__ */ new Map();
	if (!existingByName) byPrivacy.set(privacy, byName);
	return byName;
}
function mergeDimensionInputs(dimensions) {
	const bySource = /* @__PURE__ */ new Map();
	const orderedDimensions = [];
	for (const dimension of dimensions) {
		const name = normalizeDimensionName(dimension.name);
		const bucket = getDimensionBucket(bySource, dimension.source, dimension.privacy);
		const existing = bucket.get(name);
		if (existing) {
			existing.values.push(...dimension.values);
			continue;
		}
		const accumulator = {
			name,
			privacy: dimension.privacy,
			source: dimension.source,
			values: [...dimension.values]
		};
		bucket.set(name, accumulator);
		orderedDimensions.push(accumulator);
	}
	return orderedDimensions;
}
function createAppRouteCacheProofGraphScope(route) {
	return {
		routeId: route.ids.route,
		pageId: route.ids.page,
		routeHandlerId: route.ids.routeHandler,
		layoutIds: [...route.ids.layouts],
		templateIds: [...route.ids.templates],
		slotIds: sortedUnique(Object.values(route.ids.slots))
	};
}
function buildCacheVariant(input) {
	const budgetFallback = validateBudget(input.budget);
	if (budgetFallback) return {
		kind: "breakerFallback",
		fallback: budgetFallback
	};
	const dimensionInputs = mergeDimensionInputs(input.dimensions);
	if (dimensionInputs.length > input.budget.maxDimensionCount) return {
		kind: "breakerFallback",
		fallback: buildBreakerFallback("CP_DIMENSION_COUNT_EXCEEDED", {
			dimensionCount: dimensionInputs.length,
			maxDimensionCount: input.budget.maxDimensionCount,
			routeId: input.output.routeId
		})
	};
	const dimensions = [];
	for (const dimensionInput of dimensionInputs) {
		const dimension = buildDimension(dimensionInput, input.budget);
		if (isCacheProofBreakerFallback(dimension)) return {
			kind: "breakerFallback",
			fallback: dimension
		};
		dimensions.push(dimension);
	}
	dimensions.sort(compareDimensions);
	const encoded = [
		`schema:1`,
		encodeOutputScope(input.output),
		...dimensions.map((dimension) => dimension.encoded)
	].join("|");
	if (encoded.length > input.budget.maxEncodedLength) return {
		kind: "breakerFallback",
		fallback: buildBreakerFallback("CP_ENCODED_VARIANT_TOO_LONG", {
			encodedHash: redactValue(encoded),
			encodedLength: encoded.length,
			maxEncodedLength: input.budget.maxEncodedLength,
			routeId: input.output.routeId
		})
	};
	return {
		kind: "variant",
		variant: {
			schemaVersion: 1,
			cacheKey: `cp1:${fnv1a64(encoded)}`,
			output: input.output,
			dimensions,
			encodedLength: encoded.length,
			budget: { ...input.budget }
		}
	};
}
function normalizeRouteBudget(input) {
	return {
		routeId: input.routeId,
		variantCacheKeys: sortedUnique(input.variantCacheKeys)
	};
}
function buildRouteVariantCeilingFallback(variant, existingVariantCount) {
	return buildBreakerFallback("CP_ROUTE_VARIANT_CEILING_EXCEEDED", {
		existingVariantCount,
		maxVariantsPerRoute: variant.budget.maxVariantsPerRoute,
		routeId: variant.output.routeId
	}, "privateUncacheable", "route");
}
function enforceCacheVariantRouteBudget(input) {
	if (input.routeBudget && input.routeBudget.routeId !== input.variant.output.routeId) return {
		kind: "breakerFallback",
		routeBudget: normalizeRouteBudget(input.routeBudget),
		fallback: buildBreakerFallback("CP_ROUTE_VARIANT_BUDGET_ROUTE_MISMATCH", {
			budgetRouteId: input.routeBudget.routeId,
			routeId: input.variant.output.routeId
		}, "privateUncacheable", "route")
	};
	const routeBudget = normalizeRouteBudget(input.routeBudget ?? {
		routeId: input.variant.output.routeId,
		variantCacheKeys: []
	});
	const existingVariantCount = routeBudget.variantCacheKeys.length;
	const variantKeyPosition = findSortedStringPosition(routeBudget.variantCacheKeys, input.variant.cacheKey);
	if (existingVariantCount > input.variant.budget.maxVariantsPerRoute) return {
		kind: "breakerFallback",
		routeBudget,
		fallback: buildRouteVariantCeilingFallback(input.variant, existingVariantCount)
	};
	if (variantKeyPosition.found) return {
		kind: "variant",
		variant: input.variant,
		routeBudget,
		didConsumeRouteVariantBudget: false
	};
	if (existingVariantCount >= input.variant.budget.maxVariantsPerRoute) return {
		kind: "breakerFallback",
		routeBudget,
		fallback: buildRouteVariantCeilingFallback(input.variant, existingVariantCount)
	};
	return {
		kind: "variant",
		variant: input.variant,
		routeBudget: {
			routeId: routeBudget.routeId,
			variantCacheKeys: [
				...routeBudget.variantCacheKeys.slice(0, variantKeyPosition.index),
				input.variant.cacheKey,
				...routeBudget.variantCacheKeys.slice(variantKeyPosition.index)
			]
		},
		didConsumeRouteVariantBudget: true
	};
}
function buildCacheVariantWithRouteBudget(input) {
	const variantResult = buildCacheVariant({
		budget: input.budget,
		dimensions: input.dimensions,
		output: input.output
	});
	if (variantResult.kind === "breakerFallback") return {
		kind: "breakerFallback",
		routeBudget: input.routeBudget ? normalizeRouteBudget(input.routeBudget) : null,
		fallback: variantResult.fallback
	};
	return enforceCacheVariantRouteBudget({
		routeBudget: input.routeBudget,
		variant: variantResult.variant
	});
}
function boundaryOutcomesMatch(expected, candidate) {
	switch (expected.kind) {
		case "error": return candidate.kind === "error" && (expected.digest ?? "") === (candidate.digest ?? "");
		case "forbidden": return candidate.kind === "forbidden";
		case "globalError": return candidate.kind === "globalError" && (expected.digest ?? "") === (candidate.digest ?? "");
		case "notFound": return candidate.kind === "notFound";
		case "redirect": return candidate.kind === "redirect" && expected.status === candidate.status && expected.location === candidate.location;
		case "success": return candidate.kind === "success";
		case "unauthorized": return candidate.kind === "unauthorized";
		case "unknown": return false;
		default: return assertNever(expected);
	}
}
function buildBoundaryOutcomeCompatibility(input) {
	if (input.expected.kind === "unknown" || input.candidate.kind === "unknown") return {
		kind: "incompatible",
		expected: input.expected,
		candidate: input.candidate,
		fallback: buildBreakerFallback("CP_BOUNDARY_OUTCOME_UNKNOWN", {
			candidateKind: input.candidate.kind,
			expectedKind: input.expected.kind
		})
	};
	if (boundaryOutcomesMatch(input.expected, input.candidate)) return {
		kind: "compatible",
		outcome: input.candidate,
		reason: "CP_BOUNDARY_OUTCOME_MATCH"
	};
	return {
		kind: "incompatible",
		expected: input.expected,
		candidate: input.candidate,
		fallback: buildBreakerFallback("CP_BOUNDARY_OUTCOME_MISMATCH", {
			candidateKind: input.candidate.kind,
			expectedKind: input.expected.kind
		})
	};
}
function requestApiStatusRank(status) {
	switch (status) {
		case "notObserved": return 0;
		case "unknown": return 1;
		case "observed": return 2;
		default: return assertNever(status);
	}
}
function normalizeRequestApiObservations(observations) {
	const byKind = /* @__PURE__ */ new Map();
	for (const observation of observations) {
		const current = byKind.get(observation.kind);
		if (current === void 0 || requestApiStatusRank(observation.status) > requestApiStatusRank(current)) byKind.set(observation.kind, observation.status);
	}
	return [...byKind.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, status]) => ({
		kind,
		status
	}));
}
function cacheProofDowngradeTargetRank(target) {
	switch (target) {
		case "public": return 0;
		case "publicVariant": return 1;
		case "private": return 2;
		case "privateUncacheable": return 3;
		case "freshRender": return 4;
		default: return assertNever(target);
	}
}
function maxCacheProofDowngradeTarget(current, candidate) {
	return cacheProofDowngradeTargetRank(candidate) > cacheProofDowngradeTargetRank(current) ? candidate : current;
}
function createDowngradeFallback(target, reasons) {
	switch (target) {
		case "public":
		case "publicVariant":
		case "private": return null;
		case "privateUncacheable": return buildBreakerFallback("CP_PRIVATE_DYNAMIC_DOWNGRADE", {
			reasonCodes: reasons.map((reason) => reason.code),
			target
		}, "privateUncacheable");
		case "freshRender": return buildBreakerFallback("CP_PRIVATE_DYNAMIC_DOWNGRADE", {
			reasonCodes: reasons.map((reason) => reason.code),
			target
		});
		default: return assertNever(target);
	}
}
function classifyObservedRequestApiDowngrade(kind) {
	switch (kind) {
		case "connection": return {
			code: "CP_DOWNGRADE_DYNAMIC_REQUEST_API",
			requestApi: "connection",
			target: "freshRender"
		};
		case "cookies": return {
			code: "CP_DOWNGRADE_PRIVATE_REQUEST_API",
			requestApi: "cookies",
			target: "private"
		};
		case "draftMode": return {
			code: "CP_DOWNGRADE_DRAFT_MODE",
			requestApi: "draftMode",
			target: "privateUncacheable"
		};
		case "headers": return {
			code: "CP_DOWNGRADE_PRIVATE_REQUEST_API",
			requestApi: "headers",
			target: "private"
		};
		case "params": return {
			code: "CP_DOWNGRADE_PUBLIC_REQUEST_API",
			requestApi: "params",
			target: "publicVariant"
		};
		case "searchParams": return {
			code: "CP_DOWNGRADE_PUBLIC_REQUEST_API",
			requestApi: "searchParams",
			target: "publicVariant"
		};
		default: return assertNever(kind);
	}
}
function classifyCacheVariantDimensionDowngrade(input) {
	switch (input.source) {
		case "auth": return {
			code: "CP_DOWNGRADE_PRIVATE_DIMENSION",
			inputClass: "auth",
			source: "auth",
			target: "private"
		};
		case "cookie": return {
			code: "CP_DOWNGRADE_PRIVATE_DIMENSION",
			inputClass: "private",
			source: "cookie",
			target: "private"
		};
		case "draft-mode": return {
			code: "CP_DOWNGRADE_PRIVATE_DIMENSION",
			inputClass: "draft",
			source: "draft-mode",
			target: "privateUncacheable"
		};
		case "header": return {
			code: "CP_DOWNGRADE_PRIVATE_DIMENSION",
			inputClass: "private",
			source: "header",
			target: "private"
		};
		case "session": return {
			code: "CP_DOWNGRADE_PRIVATE_DIMENSION",
			inputClass: "session",
			source: "session",
			target: "private"
		};
		case "custom":
		case "interception":
		case "mounted-slots":
		case "params":
		case "route":
		case "search": return null;
		default: return assertNever(input.source);
	}
}
function classifyRenderObservationDowngrade(input) {
	const reasons = [];
	let target = "public";
	switch (input.cacheability) {
		case "public": break;
		case "private": {
			const reason = {
				code: "CP_DOWNGRADE_CACHEABILITY_PRIVATE",
				target: "private"
			};
			reasons.push(reason);
			target = maxCacheProofDowngradeTarget(target, reason.target);
			break;
		}
		case "uncacheable": {
			const reason = {
				code: "CP_DOWNGRADE_CACHEABILITY_UNCACHEABLE",
				target: "privateUncacheable"
			};
			reasons.push(reason);
			target = maxCacheProofDowngradeTarget(target, reason.target);
			break;
		}
		case "unknown": {
			const reason = {
				code: "CP_DOWNGRADE_CACHEABILITY_UNKNOWN",
				target: "freshRender"
			};
			reasons.push(reason);
			target = maxCacheProofDowngradeTarget(target, reason.target);
			break;
		}
		default: assertNever(input.cacheability);
	}
	if (input.completeness !== "complete") {
		const reason = {
			code: "CP_DOWNGRADE_INCOMPLETE_OBSERVATION",
			completeness: input.completeness,
			target: "freshRender"
		};
		reasons.push(reason);
		target = maxCacheProofDowngradeTarget(target, reason.target);
	}
	if (input.dynamicFetches.length > 0) {
		const reason = {
			code: "CP_DOWNGRADE_DYNAMIC_FETCH",
			dynamicFetchCount: input.dynamicFetches.length,
			target: "freshRender"
		};
		reasons.push(reason);
		target = maxCacheProofDowngradeTarget(target, reason.target);
	}
	const requestApis = normalizeRequestApiObservations(input.requestApis);
	for (const requestApi of requestApis) {
		if (requestApi.status === "notObserved") continue;
		const reason = requestApi.status === "unknown" ? {
			code: "CP_DOWNGRADE_UNKNOWN_REQUEST_API",
			requestApi: requestApi.kind,
			target: "freshRender"
		} : classifyObservedRequestApiDowngrade(requestApi.kind);
		reasons.push(reason);
		target = maxCacheProofDowngradeTarget(target, reason.target);
	}
	return {
		target,
		reasons,
		fallback: createDowngradeFallback(target, reasons),
		isPublicCacheCandidate: target === "public" || target === "publicVariant"
	};
}
function buildRenderRequestApiObservations(input) {
	const observedKinds = new Set(input.observed);
	const absentStatus = input.completeness === "complete" ? "notObserved" : "unknown";
	return ALL_RENDER_REQUEST_API_KINDS.map((kind) => ({
		kind,
		status: observedKinds.has(kind) ? "observed" : absentStatus
	}));
}
function buildRenderObservation(input) {
	const requestApis = normalizeRequestApiObservations(input.requestApis);
	const dynamicFetches = sortedUniqueRedacted(input.dynamicFetches);
	return {
		schemaVersion: 1,
		output: input.output,
		completeness: input.completeness,
		boundaryOutcome: input.boundaryOutcome,
		requestApis,
		dynamicFetches,
		cacheTags: sortedUnique(input.cacheTags),
		pathTags: sortedUnique(input.pathTags),
		cacheability: input.cacheability,
		downgrade: classifyRenderObservationDowngrade({
			cacheability: input.cacheability,
			completeness: input.completeness,
			dynamicFetches,
			requestApis
		})
	};
}
function hasCompleteNegativeRequestApiProof(observation, requiredApis) {
	if (observation.completeness !== "complete") return false;
	const statuses = /* @__PURE__ */ new Map();
	for (const requestApi of normalizeRequestApiObservations(observation.requestApis)) statuses.set(requestApi.kind, requestApi.status);
	for (const api of requiredApis) if (statuses.get(api) !== "notObserved") return false;
	return true;
}
function isStaticLayoutOutputScope(output) {
	return output.kind === "layout";
}
function rejectStaticLayoutReuseProof(code, fields, mode = "renderFresh") {
	return {
		kind: "rejected",
		fallback: buildBreakerFallback(code, fields, mode)
	};
}
function getRequestApiStatus(observations, kind) {
	let status = null;
	for (const requestApi of observations) {
		if (requestApi.kind !== kind) continue;
		if (status === null || requestApiStatusRank(requestApi.status) > requestApiStatusRank(status)) status = requestApi.status;
	}
	return status ?? "missing";
}
function createStaticLayoutDowngradeFallback(downgrade) {
	const mode = downgrade.target === "privateUncacheable" ? "privateUncacheable" : "renderFresh";
	return buildBreakerFallback("CP_STATIC_LAYOUT_PRIVATE_DYNAMIC_DOWNGRADE", {
		reasonCodes: downgrade.reasons.map((reason) => reason.code),
		target: downgrade.target
	}, mode);
}
function outputFieldMismatch(candidate, observation) {
	if (candidate.layoutId !== observation.layoutId) return "layoutId";
	if (candidate.rootBoundaryId !== observation.rootBoundaryId) return "rootBoundaryId";
	if (candidate.routeId !== observation.routeId) return "routeId";
	return null;
}
function buildStaticLayoutReuseProof(input) {
	if (!isStaticLayoutOutputScope(input.currentOutput)) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_CURRENT_OUTPUT_KIND", { currentOutputKind: input.currentOutput.kind });
	if (!isStaticLayoutOutputScope(input.candidateVariant.output)) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_CANDIDATE_OUTPUT_KIND", { candidateOutputKind: input.candidateVariant.output.kind });
	if (!isStaticLayoutOutputScope(input.candidateObservation.output)) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_KIND", { observationOutputKind: input.candidateObservation.output.kind });
	const currentOutput = input.currentOutput;
	const candidateOutput = input.candidateVariant.output;
	const observationOutput = input.candidateObservation.output;
	const requestApis = normalizeRequestApiObservations(input.candidateObservation.requestApis);
	const candidateObservation = {
		...input.candidateObservation,
		requestApis,
		downgrade: classifyRenderObservationDowngrade({
			cacheability: input.candidateObservation.cacheability,
			completeness: input.candidateObservation.completeness,
			dynamicFetches: input.candidateObservation.dynamicFetches,
			requestApis
		})
	};
	const observedOutputMismatch = outputFieldMismatch(candidateOutput, observationOutput);
	if (observedOutputMismatch) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_MISMATCH", {
		candidateLayoutId: candidateOutput.layoutId,
		candidateRootBoundaryId: candidateOutput.rootBoundaryId,
		candidateRouteId: candidateOutput.routeId,
		field: observedOutputMismatch,
		observationLayoutId: observationOutput.layoutId,
		observationRootBoundaryId: observationOutput.rootBoundaryId,
		observationRouteId: observationOutput.routeId
	});
	if (currentOutput.layoutId !== candidateOutput.layoutId) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_ID_MISMATCH", {
		candidateLayoutId: candidateOutput.layoutId,
		currentLayoutId: currentOutput.layoutId
	});
	if (currentOutput.rootBoundaryId === null || candidateOutput.rootBoundaryId === null) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_ROOT_BOUNDARY_UNKNOWN", {
		candidateRootBoundaryId: candidateOutput.rootBoundaryId,
		currentRootBoundaryId: currentOutput.rootBoundaryId
	});
	if (currentOutput.rootBoundaryId !== candidateOutput.rootBoundaryId) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_ROOT_BOUNDARY_MISMATCH", {
		candidateRootBoundaryId: candidateOutput.rootBoundaryId,
		currentRootBoundaryId: currentOutput.rootBoundaryId
	});
	const boundaryCompatibility = buildBoundaryOutcomeCompatibility({
		candidate: candidateObservation.boundaryOutcome,
		expected: { kind: "success" }
	});
	if (boundaryCompatibility.kind === "incompatible") return {
		kind: "rejected",
		fallback: boundaryCompatibility.fallback
	};
	if (input.candidateVariant.dimensions.length > 0) return rejectStaticLayoutReuseProof("CP_STATIC_LAYOUT_VARIANT_DIMENSION_UNPROVEN", {
		dimensionCount: input.candidateVariant.dimensions.length,
		sources: sortedUnique(input.candidateVariant.dimensions.map((dimension) => dimension.source))
	});
	if (!candidateObservation.downgrade.isPublicCacheCandidate) return {
		kind: "rejected",
		fallback: createStaticLayoutDowngradeFallback(candidateObservation.downgrade)
	};
	const requiredNegativeRequestApis = ALL_RENDER_REQUEST_API_KINDS;
	for (const api of requiredNegativeRequestApis) {
		const status = getRequestApiStatus(candidateObservation.requestApis, api);
		if (status === "notObserved") continue;
		return rejectStaticLayoutReuseProof(status === "missing" ? "CP_STATIC_LAYOUT_REQUEST_API_UNKNOWN" : "CP_STATIC_LAYOUT_REQUEST_API_OBSERVED", {
			requestApi: api,
			status
		});
	}
	return {
		kind: "proof",
		proof: {
			authorizesRuntimeReuse: true,
			candidateOutput,
			code: "CP_STATIC_LAYOUT_REUSE_PROVEN",
			currentOutput,
			fields: {
				candidateRouteId: candidateOutput.routeId,
				currentRouteId: currentOutput.routeId,
				layoutId: currentOutput.layoutId,
				rootBoundaryId: currentOutput.rootBoundaryId
			},
			observation: candidateObservation,
			requiredNegativeRequestApis: [...requiredNegativeRequestApis],
			reuseClass: "static-layout",
			variant: input.candidateVariant
		}
	};
}
function createCacheProofHotPathMetric(outcome, code, fields) {
	return {
		name: "vinext.cache.static_layout_artifact_reuse",
		outcome,
		code,
		fields
	};
}
function createStaticLayoutArtifactReuseFallback(fallback) {
	return {
		kind: "fallback",
		canReuse: false,
		fallback,
		metric: createCacheProofHotPathMetric("fallback", fallback.code, fallback.fields)
	};
}
function createStaticLayoutArtifactReuseDecision(input) {
	if (input.candidateVariant.kind === "breakerFallback") return createStaticLayoutArtifactReuseFallback(input.candidateVariant.fallback);
	const artifactCompatibility = evaluateArtifactCompatibility(input.currentArtifactCompatibility, input.candidateArtifactCompatibility, { compatibilityMap: input.compatibilityMap });
	if (artifactCompatibility.kind === "unknown") return createStaticLayoutArtifactReuseFallback(buildBreakerFallback("CP_ARTIFACT_COMPATIBILITY_UNKNOWN", {
		compatibilityFallback: artifactCompatibility.fallback,
		reason: artifactCompatibility.reason
	}));
	if (artifactCompatibility.kind === "incompatible") return createStaticLayoutArtifactReuseFallback(buildBreakerFallback("CP_ARTIFACT_COMPATIBILITY_INCOMPATIBLE", {
		compatibilityFallback: artifactCompatibility.fallback,
		reason: artifactCompatibility.reason
	}));
	const proof = buildStaticLayoutReuseProof({
		candidateObservation: input.candidateObservation,
		candidateVariant: input.candidateVariant.variant,
		currentOutput: input.currentOutput
	});
	if (proof.kind === "rejected") return createStaticLayoutArtifactReuseFallback(proof.fallback);
	return {
		kind: "reuse",
		canReuse: true,
		proof: {
			...proof.proof,
			candidateArtifactCompatibility: { ...input.candidateArtifactCompatibility }
		},
		metric: createCacheProofHotPathMetric("reuse", proof.proof.code, proof.proof.fields)
	};
}
function createCacheEntryReuseProof(decision) {
	if (decision === null) return {
		kind: "runtime-cache-entry",
		decision: null
	};
	switch (decision.kind) {
		case "reuse": return {
			kind: "runtime-cache-entry",
			decision: {
				canReuse: true,
				code: decision.proof.code,
				kind: "reuse",
				reuseClass: decision.proof.reuseClass
			}
		};
		case "fallback": return {
			kind: "runtime-cache-entry",
			decision: {
				canReuse: false,
				code: decision.fallback.code,
				kind: "reject",
				mode: decision.fallback.mode,
				scope: decision.fallback.scope
			}
		};
		default: return assertNever(decision);
	}
}
function createDisabledCacheProofDecision(input) {
	return {
		kind: "disabled",
		canReuse: false,
		variant: input.variant,
		observation: input.observation,
		...input.staticLayoutProof ? { staticLayoutProof: input.staticLayoutProof } : {},
		fallback: buildBreakerFallback("CP_MODEL_DISABLED")
	};
}
//#endregion
export { ALL_RENDER_REQUEST_API_KINDS, CACHE_PROOF_MODEL_SCHEMA_VERSION, DEFAULT_CACHE_VARIANT_BUDGET, buildBoundaryOutcomeCompatibility, buildCacheVariant, buildCacheVariantWithRouteBudget, buildRenderObservation, buildRenderRequestApiObservations, buildStaticLayoutReuseProof, classifyCacheVariantDimensionDowngrade, classifyRenderObservationDowngrade, createAppRouteCacheProofGraphScope, createCacheEntryReuseProof, createDisabledCacheProofDecision, createStaticLayoutArtifactReuseDecision, enforceCacheVariantRouteBudget, hasCompleteNegativeRequestApiProof };
