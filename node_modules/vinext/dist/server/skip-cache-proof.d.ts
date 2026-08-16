import { ArtifactCompatibilityEnvelope, ArtifactCompatibilityEvaluationOptions } from "./artifact-compatibility.js";
import { StaticLayoutArtifactReuseDecision } from "./cache-proof.js";
import { ClientReuseManifestEntry, ClientReuseManifestEntryRejection, ClientReuseManifestParseResult, ClientReuseManifestRejection, ClientReuseManifestSkipDisposition, ClientReuseManifestTraceFields } from "./client-reuse-manifest.js";
import { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId } from "./static-layout-client-reuse-proof.js";

//#region src/server/skip-cache-proof.d.ts
type SkipCacheInvalidationProof = Readonly<{
  kind: "invalidated";
  invalidationEpoch: string | null;
}> | Readonly<{
  kind: "unknown";
}> | Readonly<{
  kind: "valid";
}>;
type SkipCacheArtifactProof = Readonly<{
  compatibility: ArtifactCompatibilityEnvelope;
  invalidation: SkipCacheInvalidationProof;
  payloadHash: string | null;
}>;
type SkipCacheCrossCheckAcceptanceCode = "SKIP_CACHE_CROSS_CHECK_PASSED";
type SkipCacheCrossCheckVerified = Readonly<{
  code: SkipCacheCrossCheckAcceptanceCode;
  entryId: string;
  fields: ClientReuseManifestTraceFields;
  kind: "verified";
  skipDisposition: ClientReuseManifestSkipDisposition;
}>;
type SkipCacheCrossCheckRejected = Readonly<{
  kind: "rejected";
  rejection: ClientReuseManifestEntryRejection;
  skipDisposition: ClientReuseManifestSkipDisposition;
}>;
type SkipCacheCrossCheckResult = SkipCacheCrossCheckRejected | SkipCacheCrossCheckVerified;
type CrossCheckClientReuseManifestEntryWithCacheInput = Readonly<{
  artifact: SkipCacheArtifactProof;
  cacheDecision: StaticLayoutArtifactReuseDecision | null;
  entry: ClientReuseManifestEntry;
}> & ArtifactCompatibilityEvaluationOptions;
type ClientReuseSkipTransportPlan = Readonly<{
  entryRejections: readonly ClientReuseManifestEntryRejection[];
  kind: "renderAndSend";
  manifestRejection?: ClientReuseManifestRejection;
  skipDisposition: ClientReuseManifestSkipDisposition;
  skipIneligibleEntryIds: readonly string[];
  skippedEntryIds: readonly string[];
}> | Readonly<{
  entryRejections: readonly ClientReuseManifestEntryRejection[];
  kind: "skip";
  skipDisposition: ClientReuseManifestSkipDisposition;
  skipIneligibleEntryIds: readonly string[];
  skippedEntryIds: readonly string[];
}>;
type CreateClientReuseSkipTransportPlanInput = Readonly<{
  manifest: ClientReuseManifestParseResult;
  maxWireEntriesToVerify?: number;
  verifyEntry: (entry: ClientReuseManifestEntry) => SkipCacheCrossCheckResult;
}>;
declare function crossCheckClientReuseManifestEntryWithCache(input: CrossCheckClientReuseManifestEntryWithCacheInput): SkipCacheCrossCheckResult;
declare function createClientReuseSkipTransportPlan(input: CreateClientReuseSkipTransportPlanInput): ClientReuseSkipTransportPlan;
//#endregion
export { SkipCacheInvalidationProof, createClientReuseSkipTransportPlan, createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId, crossCheckClientReuseManifestEntryWithCache };