import { ARTIFACT_COMPATIBILITY_PROOF_FIELDS, evaluateArtifactCompatibility } from "./artifact-compatibility.js";
import { createClientReusePayloadHash } from "./client-reuse-manifest.js";
import { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId } from "./static-layout-client-reuse-proof.js";
//#region src/server/skip-cache-proof.ts
function createDisabledSkipDisposition() {
	return {
		code: "SKIP_MODEL_DISABLED",
		enabled: false,
		mode: "renderAndSend"
	};
}
function createStaticLayoutSkipDisposition(skippedEntryIds) {
	return {
		code: "SKIP_STATIC_LAYOUT_VERIFIED",
		enabled: true,
		mode: "skipStaticLayout",
		skippedEntryIds: [...skippedEntryIds]
	};
}
function rejectSkipCacheCrossCheck(entry, code, fields = {}) {
	return {
		kind: "rejected",
		rejection: {
			code,
			entryId: entry.id,
			fields
		},
		skipDisposition: createDisabledSkipDisposition()
	};
}
function collectArtifactCompatibilityProofMismatches(artifactCompatibility, proofCompatibility) {
	const mismatchedFields = [];
	for (const field of ARTIFACT_COMPATIBILITY_PROOF_FIELDS) if (artifactCompatibility[field] !== proofCompatibility[field]) mismatchedFields.push(field);
	return mismatchedFields;
}
function isExactArtifactCompatibility(artifactCompatibility, entryCompatibility) {
	return collectArtifactCompatibilityProofMismatches(artifactCompatibility, entryCompatibility).length === 0;
}
function assertNever(value) {
	throw new Error(`Unhandled skip/cache proof state: ${String(value)}`);
}
function createRenderAndSendPlan(options) {
	return {
		kind: "renderAndSend",
		entryRejections: options.entryRejections ?? [],
		...options.manifestRejection ? { manifestRejection: options.manifestRejection } : {},
		skipDisposition: createDisabledSkipDisposition(),
		skipIneligibleEntryIds: options.skipIneligibleEntryIds ?? [],
		skippedEntryIds: []
	};
}
function createVerificationBudgetExceededRejection(totalWireEntries, maxWireEntriesToVerify) {
	return {
		code: "SKIP_VERIFICATION_BUDGET_EXCEEDED",
		fields: {
			totalWireEntries,
			maxWireEntriesToVerify
		}
	};
}
function crossCheckInvalidationProof(entry, invalidation) {
	switch (invalidation.kind) {
		case "valid": return null;
		case "unknown": return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_INVALIDATION_UNKNOWN");
		case "invalidated": return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_INVALIDATED", { invalidationEpoch: invalidation.invalidationEpoch });
		default: return assertNever(invalidation);
	}
}
function crossCheckClientReuseManifestEntryWithCache(input) {
	const { cacheDecision, entry } = input;
	if (cacheDecision === null) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_PROOF_MISSING");
	if (cacheDecision.kind === "fallback") return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_PROOF_REJECTED", {
		cacheProofCode: cacheDecision.fallback.code,
		cacheProofMode: cacheDecision.fallback.mode,
		cacheProofScope: cacheDecision.fallback.scope
	});
	const { proof } = cacheDecision;
	if (entry.kind !== "layout" || proof.reuseClass !== "static-layout") return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_REUSE_CLASS_UNSUPPORTED", {
		entryKind: entry.kind,
		reuseClass: proof.reuseClass
	});
	if (entry.id !== proof.candidateOutput.layoutId) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_ENTRY_ID_MISMATCH", {
		cacheEntryId: proof.candidateOutput.layoutId,
		manifestEntryId: entry.id
	});
	const artifactProofMismatches = collectArtifactCompatibilityProofMismatches(input.artifact.compatibility, proof.candidateArtifactCompatibility);
	if (artifactProofMismatches.length > 0) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_ARTIFACT_PROOF_MISMATCH", { mismatchedFields: artifactProofMismatches });
	const artifactCompatibility = evaluateArtifactCompatibility(input.artifact.compatibility, entry.artifactCompatibility, { compatibilityMap: input.compatibilityMap });
	if (artifactCompatibility.kind === "unknown") return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_ARTIFACT_COMPATIBILITY_UNKNOWN", {
		compatibilityFallback: artifactCompatibility.fallback,
		reason: artifactCompatibility.reason
	});
	if (artifactCompatibility.kind === "incompatible") return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_ARTIFACT_COMPATIBILITY_INCOMPATIBLE", {
		compatibilityFallback: artifactCompatibility.fallback,
		reason: artifactCompatibility.reason
	});
	if (entry.variantCacheKey !== proof.variant.cacheKey) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_VARIANT_MISMATCH", {
		cacheVariantCacheKeyHash: createClientReusePayloadHash(proof.variant.cacheKey),
		entryVariantCacheKeyHash: createClientReusePayloadHash(entry.variantCacheKey)
	});
	if (input.artifact.payloadHash === null) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_PAYLOAD_HASH_MISSING");
	if (entry.payloadHash !== input.artifact.payloadHash) return rejectSkipCacheCrossCheck(entry, "SKIP_CACHE_PAYLOAD_HASH_MISMATCH", {
		cachePayloadHash: input.artifact.payloadHash,
		entryPayloadHash: entry.payloadHash
	});
	const invalidationRejection = crossCheckInvalidationProof(entry, input.artifact.invalidation);
	if (invalidationRejection) return invalidationRejection;
	const skipDisposition = isExactArtifactCompatibility(input.artifact.compatibility, entry.artifactCompatibility) ? createStaticLayoutSkipDisposition([entry.id]) : createDisabledSkipDisposition();
	return {
		kind: "verified",
		code: "SKIP_CACHE_CROSS_CHECK_PASSED",
		entryId: entry.id,
		fields: {
			entryKind: entry.kind,
			reuseClass: proof.reuseClass,
			variantCacheKeyHash: createClientReusePayloadHash(proof.variant.cacheKey)
		},
		skipDisposition
	};
}
function createClientReuseSkipTransportPlan(input) {
	const { manifest } = input;
	if (manifest.kind === "absent") return createRenderAndSendPlan({});
	if (manifest.kind === "rejected") return createRenderAndSendPlan({ manifestRejection: manifest.rejection });
	const maxWireEntriesToVerify = input.maxWireEntriesToVerify ?? 8;
	if (!Number.isSafeInteger(maxWireEntriesToVerify) || maxWireEntriesToVerify < 0) throw new RangeError("maxWireEntriesToVerify must be a non-negative safe integer");
	const totalWireEntries = manifest.manifest.entries.length + manifest.entryRejections.length;
	if (totalWireEntries > maxWireEntriesToVerify) return createRenderAndSendPlan({
		entryRejections: manifest.entryRejections,
		manifestRejection: createVerificationBudgetExceededRejection(totalWireEntries, maxWireEntriesToVerify)
	});
	const skippedEntryIds = [];
	const skipIneligibleEntryIds = [];
	const entryRejections = [...manifest.entryRejections];
	for (const entry of manifest.manifest.entries) {
		const verification = input.verifyEntry(entry);
		if (verification.kind === "rejected") {
			entryRejections.push(verification.rejection);
			continue;
		}
		if (verification.entryId !== entry.id) {
			entryRejections.push({
				code: "SKIP_CACHE_ENTRY_ID_MISMATCH",
				entryId: entry.id,
				fields: {
					verifierEntryId: verification.entryId,
					manifestEntryId: entry.id
				}
			});
			continue;
		}
		if (verification.skipDisposition.enabled) skippedEntryIds.push(entry.id);
		else skipIneligibleEntryIds.push(entry.id);
	}
	if (skippedEntryIds.length === 0) return createRenderAndSendPlan({
		entryRejections,
		skipIneligibleEntryIds
	});
	return {
		kind: "skip",
		entryRejections,
		skipDisposition: createStaticLayoutSkipDisposition(skippedEntryIds),
		skipIneligibleEntryIds,
		skippedEntryIds
	};
}
//#endregion
export { createClientReuseSkipTransportPlan, createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId, crossCheckClientReuseManifestEntryWithCache };
