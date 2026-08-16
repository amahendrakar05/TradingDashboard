import { isUnknownRecord } from "../utils/record.js";
import { fnv1a64 } from "../utils/hash.js";
//#region src/server/artifact-compatibility.ts
const ARTIFACT_COMPATIBILITY_SCHEMA_VERSION = 1;
const APP_ELEMENTS_SCHEMA_VERSION = 1;
const RSC_PAYLOAD_SCHEMA_VERSION = 1;
const ARTIFACT_COMPATIBILITY_PROOF_FIELDS = [
	"schemaVersion",
	"graphVersion",
	"deploymentVersion",
	"appElementsSchemaVersion",
	"rscPayloadSchemaVersion",
	"rootBoundaryId",
	"renderEpoch"
];
function createArtifactCompatibilityEnvelope(input = {}) {
	return {
		schemaVersion: 1,
		graphVersion: input.graphVersion ?? null,
		deploymentVersion: input.deploymentVersion ?? null,
		appElementsSchemaVersion: 1,
		rscPayloadSchemaVersion: 1,
		rootBoundaryId: input.rootBoundaryId ?? null,
		renderEpoch: input.renderEpoch ?? null
	};
}
function createArtifactCompatibilityGraphVersion(input) {
	return `app-route-graph:${fnv1a64(JSON.stringify([input.routePattern, input.rootBoundaryId]))}`;
}
function isStringOrNull(value) {
	return typeof value === "string" || value === null;
}
function hasCurrentSchemaVersions(record) {
	return record.schemaVersion === 1 && record.appElementsSchemaVersion === 1 && record.rscPayloadSchemaVersion === 1;
}
function parseArtifactCompatibilityEnvelope(value) {
	if (!isUnknownRecord(value)) return null;
	if (!hasCurrentSchemaVersions(value)) return null;
	if (!isStringOrNull(value.graphVersion)) return null;
	if (!isStringOrNull(value.deploymentVersion)) return null;
	if (!isStringOrNull(value.rootBoundaryId)) return null;
	if (!isStringOrNull(value.renderEpoch)) return null;
	return {
		schemaVersion: 1,
		graphVersion: value.graphVersion,
		deploymentVersion: value.deploymentVersion,
		appElementsSchemaVersion: 1,
		rscPayloadSchemaVersion: 1,
		rootBoundaryId: value.rootBoundaryId,
		renderEpoch: value.renderEpoch
	};
}
function incompatible(reason) {
	return {
		kind: "incompatible",
		fallback: "renderFresh",
		reason
	};
}
function unknown(reason) {
	return {
		kind: "unknown",
		fallback: "renderFresh",
		reason
	};
}
function compareKnownField(currentValue, candidateValue, unknownReason, mismatchReason, notDeclaredCompatibleReason, compatibilitySets) {
	if (currentValue === null || candidateValue === null) return unknown(unknownReason);
	if (currentValue === candidateValue) return null;
	if (compatibilitySets === void 0) return incompatible(mismatchReason);
	return isDeclaredCompatible(currentValue, candidateValue, compatibilitySets) ? null : incompatible(notDeclaredCompatibleReason);
}
function isDeclaredCompatible(currentValue, candidateValue, compatibilitySets) {
	return compatibilitySets.some((compatibilitySet) => compatibilitySet.includes(currentValue) && compatibilitySet.includes(candidateValue));
}
function evaluateArtifactCompatibility(current, candidate, options = {}) {
	if (current.schemaVersion !== candidate.schemaVersion) return incompatible("schemaVersionMismatch");
	if (current.appElementsSchemaVersion !== candidate.appElementsSchemaVersion) return incompatible("appElementsSchemaVersionMismatch");
	if (current.rscPayloadSchemaVersion !== candidate.rscPayloadSchemaVersion) return incompatible("rscPayloadSchemaVersionMismatch");
	const graphDecision = compareKnownField(current.graphVersion, candidate.graphVersion, "graphVersionUnknown", "graphVersionMismatch", "graphVersionNotDeclaredCompatible", options.compatibilityMap?.graphVersions);
	if (graphDecision) return graphDecision;
	const deploymentDecision = compareKnownField(current.deploymentVersion, candidate.deploymentVersion, "deploymentVersionUnknown", "deploymentVersionMismatch", "deploymentVersionNotDeclaredCompatible", options.compatibilityMap?.deploymentVersions);
	if (deploymentDecision) return deploymentDecision;
	const rootBoundaryDecision = compareKnownField(current.rootBoundaryId, candidate.rootBoundaryId, "rootBoundaryIdUnknown", "rootBoundaryIdMismatch", "rootBoundaryIdNotDeclaredCompatible", options.compatibilityMap?.rootBoundaryIds);
	if (rootBoundaryDecision) return rootBoundaryDecision;
	const renderEpochDecision = compareKnownField(current.renderEpoch, candidate.renderEpoch, "renderEpochUnknown", "renderEpochMismatch", "renderEpochNotDeclaredCompatible", options.compatibilityMap?.renderEpochs);
	if (renderEpochDecision) return renderEpochDecision;
	return { kind: "compatible" };
}
//#endregion
export { APP_ELEMENTS_SCHEMA_VERSION, ARTIFACT_COMPATIBILITY_PROOF_FIELDS, ARTIFACT_COMPATIBILITY_SCHEMA_VERSION, RSC_PAYLOAD_SCHEMA_VERSION, createArtifactCompatibilityEnvelope, createArtifactCompatibilityGraphVersion, evaluateArtifactCompatibility, parseArtifactCompatibilityEnvelope };
