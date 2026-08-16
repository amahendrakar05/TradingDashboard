import { ARTIFACT_COMPATIBILITY_PROOF_FIELDS } from "./artifact-compatibility.js";
import { createClientReusePayloadHash } from "./client-reuse-manifest.js";
//#region src/server/static-layout-client-reuse-proof.ts
function createStaticLayoutClientReuseRouteId(layoutId) {
	return `static-layout:${createClientReusePayloadHash(layoutId)}`;
}
function createCanonicalProofPairs(input) {
	return ARTIFACT_COMPATIBILITY_PROOF_FIELDS.map((field) => [field, input.artifactCompatibility[field]]);
}
function createStaticLayoutClientReusePayloadHash(input) {
	return createClientReusePayloadHash(JSON.stringify({
		artifactCompatibilityPairs: createCanonicalProofPairs(input),
		layoutId: input.layoutId,
		rootBoundaryId: input.rootBoundaryId,
		variantCacheKey: input.variantCacheKey
	}));
}
function createStaticLayoutClientReuseArtifactCompatibility(input) {
	return {
		...input.artifactCompatibility,
		graphVersion: `static-layout-graph:${createClientReusePayloadHash(JSON.stringify({
			layoutId: input.layoutId,
			rootBoundaryId: input.rootBoundaryId
		}))}`,
		renderEpoch: `static-layout:${createClientReusePayloadHash(JSON.stringify({
			layoutId: input.layoutId,
			rootBoundaryId: input.rootBoundaryId,
			variantCacheKey: input.variantCacheKey
		}))}`
	};
}
//#endregion
export { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId };
