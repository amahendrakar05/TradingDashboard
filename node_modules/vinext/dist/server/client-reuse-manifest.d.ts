import { ArtifactCompatibilityEnvelope } from "./artifact-compatibility.js";

//#region src/server/client-reuse-manifest.d.ts
declare const CLIENT_REUSE_MANIFEST_SCHEMA_VERSION = 1;
type ClientReuseManifestSchemaVersion = 1;
declare const CLIENT_REUSE_MANIFEST_HASH_ALGORITHM = "fnv1a64";
type ClientReuseManifestHashAlgorithm = typeof CLIENT_REUSE_MANIFEST_HASH_ALGORITHM;
type ClientReuseManifestLimits = Readonly<{
  maxEntryCount: number;
  maxEntryIdLength: number;
  maxManifestBytes: number;
  maxPayloadHashLength: number;
  maxVariantCacheKeyLength: number;
}>;
declare const DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS: {
  maxEntryCount: number;
  maxEntryIdLength: number;
  maxManifestBytes: number;
  maxPayloadHashLength: number;
  maxVariantCacheKeyLength: number;
};
declare const CLIENT_REUSE_MANIFEST_SKIP_VERIFICATION_ENTRY_BUDGET = 8;
type ClientReuseManifestEntryKind = "layout" | "page" | "route" | "slot" | "template";
type ClientReuseManifestEntryPrivacy = "private" | "public";
type ClientReuseManifestReplayWindow = Readonly<{
  validFromVisibleCommitVersion: number;
  validUntilVisibleCommitVersion: number;
}>;
type ClientReuseManifestEntry = Readonly<{
  artifactCompatibility: ArtifactCompatibilityEnvelope;
  id: string;
  kind: ClientReuseManifestEntryKind;
  payloadHash: string;
  privacy: "public";
  variantCacheKey: string;
}>;
type ClientReuseManifestWireEntry = Readonly<{
  artifactCompatibility: ArtifactCompatibilityEnvelope;
  id: string;
  payloadHash: string;
  privacy: ClientReuseManifestEntryPrivacy;
  variantCacheKey: string;
}>;
type ClientReuseManifest = Readonly<{
  entries: readonly ClientReuseManifestEntry[];
  hashAlgorithm: ClientReuseManifestHashAlgorithm;
  replayWindow: ClientReuseManifestReplayWindow;
  schemaVersion: ClientReuseManifestSchemaVersion;
  visibleCommitVersion: number;
}>;
type ClientReuseManifestWire = Readonly<{
  entries: readonly ClientReuseManifestWireEntry[];
  hashAlgorithm: ClientReuseManifestHashAlgorithm;
  replayWindow: ClientReuseManifestReplayWindow;
  schemaVersion: ClientReuseManifestSchemaVersion;
  visibleCommitVersion: number;
}>;
type CreateClientReuseManifestInput = Readonly<{
  entries: readonly ClientReuseManifestWireEntry[];
  replayWindow?: ClientReuseManifestReplayWindow;
  visibleCommitVersion: number;
}>;
type ClientReuseManifestRejectionCode = "SKIP_CACHE_ARTIFACT_COMPATIBILITY_INCOMPATIBLE" | "SKIP_CACHE_ARTIFACT_COMPATIBILITY_UNKNOWN" | "SKIP_CACHE_ARTIFACT_PROOF_MISMATCH" | "SKIP_CACHE_ENTRY_ID_MISMATCH" | "SKIP_CACHE_INVALIDATED" | "SKIP_CACHE_INVALIDATION_UNKNOWN" | "SKIP_CACHE_PAYLOAD_HASH_MISMATCH" | "SKIP_CACHE_PAYLOAD_HASH_MISSING" | "SKIP_CACHE_PROOF_MISSING" | "SKIP_CACHE_PROOF_REJECTED" | "SKIP_CACHE_REUSE_CLASS_UNSUPPORTED" | "SKIP_CACHE_VARIANT_MISMATCH" | "SKIP_LAYOUT_CACHE_LIFE_OBSERVED" | "SKIP_LAYOUT_CACHE_TAGS_OBSERVED" | "SKIP_LAYOUT_CACHEABLE_FETCHES_OBSERVED" | "SKIP_LAYOUT_DYNAMIC_FETCHES_OBSERVED" | "SKIP_LAYOUT_DYNAMIC_USAGE_OBSERVED" | "SKIP_LAYOUT_PARAMS_OBSERVED" | "SKIP_LAYOUT_PARAMS_OBSERVATION_INCOMPLETE" | "SKIP_LAYOUT_PARAMS_PRESENT" | "SKIP_LAYOUT_REVALIDATE_PRESENT" | "SKIP_LAYOUT_REQUEST_API_OBSERVED" | "SKIP_LAYOUT_UNSTABLE_CACHE_OBSERVED" | "SKIP_ARTIFACT_COMPATIBILITY_INVALID" | "SKIP_ENTRY_COUNT_EXCEEDED" | "SKIP_VERIFICATION_BUDGET_EXCEEDED" | "SKIP_ENTRY_HASH_INVALID" | "SKIP_ENTRY_ID_INVALID" | "SKIP_ENTRY_ID_TOO_LONG" | "SKIP_ENTRY_MALFORMED" | "SKIP_ENTRY_ORDER_NON_CANONICAL" | "SKIP_HASH_ALGORITHM_UNSUPPORTED" | "SKIP_MANIFEST_MALFORMED" | "SKIP_MANIFEST_SCHEMA_UNSUPPORTED" | "SKIP_MANIFEST_TOO_LARGE" | "SKIP_PRIVATE_ENTRY" | "SKIP_REPLAY_WINDOW_INVALID" | "SKIP_UNKNOWN_ENTRY" | "SKIP_VARIANT_CACHE_KEY_INVALID" | "SKIP_VARIANT_CACHE_KEY_TOO_LONG" | "SKIP_VISIBLE_COMMIT_VERSION_INVALID" | "SKIP_VISIBLE_COMMIT_VERSION_MISMATCH";
type ClientReuseManifestTraceFieldValue = string | number | boolean | null | readonly string[];
type ClientReuseManifestTraceFields = Readonly<Record<string, ClientReuseManifestTraceFieldValue>>;
type ClientReuseManifestRejection = Readonly<{
  code: ClientReuseManifestRejectionCode;
  fields: ClientReuseManifestTraceFields;
}>;
type ClientReuseManifestEntryRejection = ClientReuseManifestRejection & Readonly<{
  entryId: string | null;
}>;
type ClientReuseManifestSkipDisposition = Readonly<{
  code: "SKIP_MODEL_DISABLED";
  enabled: false;
  mode: "renderAndSend";
}> | Readonly<{
  code: "SKIP_STATIC_LAYOUT_VERIFIED";
  enabled: true;
  mode: "skipStaticLayout";
  skippedEntryIds: readonly string[];
}>;
type ClientReuseManifestParseResult = Readonly<{
  kind: "absent";
}> | Readonly<{
  kind: "rejected";
  rejection: ClientReuseManifestRejection;
}> | Readonly<{
  entryRejections: readonly ClientReuseManifestEntryRejection[];
  kind: "parsed";
  manifest: ClientReuseManifest;
  skipDisposition: ClientReuseManifestSkipDisposition;
}>;
type ParseClientReuseManifestOptions = Readonly<{
  currentVisibleCommitVersion?: number;
  limits?: ClientReuseManifestLimits;
}>;
declare function countUtf8Bytes(input: string): number;
declare function createClientReusePayloadHash(input: string): string;
declare function createClientReuseManifest(input: CreateClientReuseManifestInput): ClientReuseManifestWire;
declare function serializeClientReuseManifest(input: CreateClientReuseManifestInput): string;
declare function parseClientReuseManifestHeader(rawHeader: string | null | undefined, options?: ParseClientReuseManifestOptions): ClientReuseManifestParseResult;
//#endregion
export { CLIENT_REUSE_MANIFEST_HASH_ALGORITHM, CLIENT_REUSE_MANIFEST_SCHEMA_VERSION, CLIENT_REUSE_MANIFEST_SKIP_VERIFICATION_ENTRY_BUDGET, ClientReuseManifestEntry, ClientReuseManifestEntryRejection, ClientReuseManifestParseResult, ClientReuseManifestRejection, ClientReuseManifestRejectionCode, ClientReuseManifestSkipDisposition, ClientReuseManifestTraceFields, DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS, countUtf8Bytes, createClientReuseManifest, createClientReusePayloadHash, parseClientReuseManifestHeader, serializeClientReuseManifest };