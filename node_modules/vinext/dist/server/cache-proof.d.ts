import { AppRouteSemanticIds } from "../routing/app-route-graph.js";
import { ArtifactCompatibilityEnvelope, ArtifactCompatibilityEvaluationOptions } from "./artifact-compatibility.js";

//#region src/server/cache-proof.d.ts
declare const CACHE_PROOF_MODEL_SCHEMA_VERSION = 1;
type CacheProofModelSchemaVersion = 1;
type CacheProofRejectionCode = "CP_CACHE_ENTRY_PROOF_MISSING" | "CP_MODEL_DISABLED" | "CP_ARTIFACT_COMPATIBILITY_INCOMPATIBLE" | "CP_ARTIFACT_COMPATIBILITY_UNKNOWN" | "CP_DIMENSION_COUNT_EXCEEDED" | "CP_DIMENSION_NAME_MISSING" | "CP_DIMENSION_NAME_TOO_LONG" | "CP_DIMENSION_VALUE_COUNT_EXCEEDED" | "CP_DIMENSION_VALUE_TOO_LONG" | "CP_DIMENSION_VALUES_MISSING" | "CP_ENCODED_VARIANT_TOO_LONG" | "CP_INVALID_VARIANT_BUDGET" | "CP_ROUTE_VARIANT_BUDGET_ROUTE_MISMATCH" | "CP_ROUTE_VARIANT_CEILING_EXCEEDED" | "CP_UNSAFE_PUBLIC_DIMENSION" | "CP_BOUNDARY_OUTCOME_MISMATCH" | "CP_BOUNDARY_OUTCOME_UNKNOWN" | "CP_PRIVATE_DYNAMIC_DOWNGRADE" | "CP_STATIC_LAYOUT_CANDIDATE_OUTPUT_KIND" | "CP_STATIC_LAYOUT_CURRENT_OUTPUT_KIND" | "CP_STATIC_LAYOUT_ID_MISMATCH" | "CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_KIND" | "CP_STATIC_LAYOUT_OBSERVATION_OUTPUT_MISMATCH" | "CP_STATIC_LAYOUT_PRIVATE_DYNAMIC_DOWNGRADE" | "CP_STATIC_LAYOUT_REQUEST_API_OBSERVED" | "CP_STATIC_LAYOUT_REQUEST_API_UNKNOWN" | "CP_STATIC_LAYOUT_ROOT_BOUNDARY_MISMATCH" | "CP_STATIC_LAYOUT_ROOT_BOUNDARY_UNKNOWN" | "CP_STATIC_LAYOUT_VARIANT_DIMENSION_UNPROVEN";
type CacheProofAcceptanceCode = "CP_STATIC_LAYOUT_REUSE_PROVEN";
type CacheProofTraceCode = CacheProofAcceptanceCode | CacheProofRejectionCode;
type CacheProofTraceFieldValue = string | number | boolean | null | readonly string[];
type CacheProofTraceFields = Readonly<Record<string, CacheProofTraceFieldValue>>;
type CacheProofBreakerFallbackMode = "renderFresh" | "privateUncacheable";
type CacheProofFallbackScope = "affectedOutput" | "route";
type CacheProofBreakerFallback = Readonly<{
  kind: "breakerFallback";
  code: CacheProofRejectionCode;
  mode: CacheProofBreakerFallbackMode;
  scope: CacheProofFallbackScope;
  fields: CacheProofTraceFields;
}>;
type CacheVariantBudget = Readonly<{
  maxDimensionCount: number;
  maxDimensionNameLength: number;
  maxDimensionValueLength: number;
  maxEncodedLength: number;
  maxValuesPerDimension: number;
  maxVariantsPerRoute: number;
}>;
declare const DEFAULT_CACHE_VARIANT_BUDGET: {
  maxDimensionCount: number;
  maxDimensionNameLength: number;
  maxDimensionValueLength: number;
  maxEncodedLength: number;
  maxValuesPerDimension: number;
  maxVariantsPerRoute: number;
};
type CacheVariantDimensionSource = "auth" | "cookie" | "custom" | "draft-mode" | "header" | "interception" | "mounted-slots" | "params" | "route" | "search" | "session";
type CacheVariantDimensionPrivacy = "internal" | "private" | "public";
type CacheVariantDimensionInput = Readonly<{
  name: string;
  privacy: CacheVariantDimensionPrivacy;
  source: CacheVariantDimensionSource;
  values: readonly string[];
}>;
type CacheVariantDimension = Readonly<{
  encoded: string;
  name: string;
  privacy: CacheVariantDimensionPrivacy;
  source: CacheVariantDimensionSource;
  valueCount: number;
  valueHashes: readonly string[];
}>;
type CacheProofOutputScope = Readonly<{
  kind: "app-html";
  renderEpoch: string | null;
  rootBoundaryId: string | null;
  routeId: string;
}> | Readonly<{
  kind: "app-rsc";
  mountedSlotsFingerprint: string | null;
  renderEpoch: string | null;
  rootBoundaryId: string | null;
  routeId: string;
}> | Readonly<{
  kind: "layout";
  layoutId: string;
  rootBoundaryId: string | null;
  routeId: string;
}> | Readonly<{
  kind: "page";
  pageId: string;
  rootBoundaryId: string | null;
  routeId: string;
}> | Readonly<{
  kind: "route-handler";
  routeHandlerId: string;
  routeId: string;
}> | Readonly<{
  kind: "slot";
  rootBoundaryId: string | null;
  routeId: string;
  slotId: string;
}> | Readonly<{
  kind: "template";
  rootBoundaryId: string | null;
  routeId: string;
  templateId: string;
}>;
type StaticLayoutCacheProofOutputScope = Extract<CacheProofOutputScope, {
  kind: "layout";
}>;
type CacheVariant = Readonly<{
  budget: CacheVariantBudget;
  cacheKey: string;
  dimensions: readonly CacheVariantDimension[];
  encodedLength: number;
  output: CacheProofOutputScope;
  schemaVersion: CacheProofModelSchemaVersion;
}>;
type BuildCacheVariantInput = Readonly<{
  budget: CacheVariantBudget;
  dimensions: readonly CacheVariantDimensionInput[];
  output: CacheProofOutputScope;
}>;
type BuildCacheVariantResult = Readonly<{
  kind: "variant";
  variant: CacheVariant;
}> | Readonly<{
  kind: "breakerFallback";
  fallback: CacheProofBreakerFallback;
}>;
type CacheVariantRouteBudget = Readonly<{
  routeId: string;
  variantCacheKeys: readonly string[];
}>;
type CacheVariantRouteBudgetAdmission = Readonly<{
  didConsumeRouteVariantBudget: boolean;
  kind: "variant";
  routeBudget: CacheVariantRouteBudget;
  variant: CacheVariant;
}> | Readonly<{
  fallback: CacheProofBreakerFallback;
  kind: "breakerFallback";
  routeBudget: CacheVariantRouteBudget | null;
}>;
type BuildCacheVariantWithRouteBudgetInput = BuildCacheVariantInput & Readonly<{
  routeBudget: CacheVariantRouteBudget | null;
}>;
type BuildCacheVariantWithRouteBudgetResult = CacheVariantRouteBudgetAdmission;
type AppRouteCacheProofGraphScopeInput = Readonly<{
  ids: AppRouteSemanticIds;
}>;
type AppRouteCacheProofGraphScope = Readonly<{
  layoutIds: readonly string[];
  pageId: string | null;
  routeHandlerId: string | null;
  routeId: string;
  slotIds: readonly string[];
  templateIds: readonly string[];
}>;
type BoundaryOutcome = Readonly<{
  kind: "error";
  digest?: string;
}> | Readonly<{
  kind: "forbidden";
}> | Readonly<{
  kind: "globalError";
  digest?: string;
}> | Readonly<{
  kind: "notFound";
}> | Readonly<{
  kind: "redirect";
  location: string;
  status: number;
}> | Readonly<{
  kind: "success";
}> | Readonly<{
  kind: "unauthorized";
}> | Readonly<{
  kind: "unknown";
}>;
type BoundaryOutcomeCompatibility = Readonly<{
  kind: "compatible";
  outcome: BoundaryOutcome;
  reason: "CP_BOUNDARY_OUTCOME_MATCH";
}> | Readonly<{
  candidate: BoundaryOutcome;
  expected: BoundaryOutcome;
  fallback: CacheProofBreakerFallback;
  kind: "incompatible";
}>;
type RenderObservationCompleteness = "complete" | "partial" | "unknown";
type RenderCacheability = "private" | "public" | "uncacheable" | "unknown";
type RenderRequestApiKind = "connection" | "cookies" | "draftMode" | "headers" | "params" | "searchParams";
type RenderRequestApiStatus = "notObserved" | "observed" | "unknown";
declare const ALL_RENDER_REQUEST_API_KINDS: readonly RenderRequestApiKind[];
type RenderRequestApiObservation = Readonly<{
  kind: RenderRequestApiKind;
  status: RenderRequestApiStatus;
}>;
type CacheProofDowngradeTarget = "freshRender" | "private" | "privateUncacheable" | "public" | "publicVariant";
type CacheProofDowngradeReason = Readonly<{
  code: "CP_DOWNGRADE_CACHEABILITY_PRIVATE";
  target: "private";
}> | Readonly<{
  code: "CP_DOWNGRADE_CACHEABILITY_UNCACHEABLE";
  target: "privateUncacheable";
}> | Readonly<{
  code: "CP_DOWNGRADE_CACHEABILITY_UNKNOWN";
  target: "freshRender";
}> | Readonly<{
  code: "CP_DOWNGRADE_DYNAMIC_FETCH";
  dynamicFetchCount: number;
  target: "freshRender";
}> | Readonly<{
  code: "CP_DOWNGRADE_DYNAMIC_REQUEST_API";
  requestApi: "connection";
  target: "freshRender";
}> | Readonly<{
  code: "CP_DOWNGRADE_DRAFT_MODE";
  requestApi: "draftMode";
  target: "privateUncacheable";
}> | Readonly<{
  code: "CP_DOWNGRADE_INCOMPLETE_OBSERVATION";
  completeness: Exclude<RenderObservationCompleteness, "complete">;
  target: "freshRender";
}> | Readonly<{
  code: "CP_DOWNGRADE_PRIVATE_DIMENSION";
  inputClass: "auth" | "draft" | "private" | "session";
  source: "auth" | "cookie" | "draft-mode" | "header" | "session";
  target: "private" | "privateUncacheable";
}> | Readonly<{
  code: "CP_DOWNGRADE_PRIVATE_REQUEST_API";
  requestApi: "cookies" | "headers";
  target: "private";
}> | Readonly<{
  code: "CP_DOWNGRADE_PUBLIC_REQUEST_API";
  requestApi: "params" | "searchParams";
  target: "publicVariant";
}> | Readonly<{
  code: "CP_DOWNGRADE_UNKNOWN_REQUEST_API";
  requestApi: RenderRequestApiKind;
  target: "freshRender";
}>;
type CacheProofDowngradeClassification = Readonly<{
  fallback: CacheProofBreakerFallback | null;
  isPublicCacheCandidate: boolean;
  reasons: readonly CacheProofDowngradeReason[];
  target: CacheProofDowngradeTarget;
}>;
type ClassifyRenderObservationDowngradeInput = Readonly<{
  cacheability: RenderCacheability;
  completeness: RenderObservationCompleteness;
  dynamicFetches: readonly string[];
  requestApis: readonly RenderRequestApiObservation[];
}>;
type ClassifyCacheVariantDimensionDowngradeInput = Pick<CacheVariantDimensionInput, "source">;
type RenderObservation = Readonly<{
  boundaryOutcome: BoundaryOutcome;
  cacheTags: readonly string[];
  cacheability: RenderCacheability;
  completeness: RenderObservationCompleteness;
  downgrade: CacheProofDowngradeClassification;
  dynamicFetches: readonly string[];
  output: CacheProofOutputScope;
  pathTags: readonly string[];
  requestApis: readonly RenderRequestApiObservation[];
  schemaVersion: CacheProofModelSchemaVersion;
}>;
type StaticLayoutReuseProof = Readonly<{
  authorizesRuntimeReuse: true;
  candidateOutput: StaticLayoutCacheProofOutputScope;
  code: "CP_STATIC_LAYOUT_REUSE_PROVEN";
  currentOutput: StaticLayoutCacheProofOutputScope;
  fields: CacheProofTraceFields;
  observation: RenderObservation;
  requiredNegativeRequestApis: readonly RenderRequestApiKind[];
  reuseClass: "static-layout";
  variant: CacheVariant;
}>;
type StaticLayoutArtifactReuseProof = StaticLayoutReuseProof & Readonly<{
  candidateArtifactCompatibility: ArtifactCompatibilityEnvelope;
}>;
type BuildStaticLayoutReuseProofInput = Readonly<{
  candidateObservation: RenderObservation;
  candidateVariant: CacheVariant;
  currentOutput: CacheProofOutputScope;
}>;
type BuildStaticLayoutReuseProofResult = Readonly<{
  kind: "proof";
  proof: StaticLayoutReuseProof;
}> | Readonly<{
  kind: "rejected";
  fallback: CacheProofBreakerFallback;
}>;
type CacheProofHotPathMetric = Readonly<{
  code: CacheProofTraceCode;
  fields: CacheProofTraceFields;
  name: "vinext.cache.static_layout_artifact_reuse";
  outcome: "fallback" | "reuse";
}>;
type StaticLayoutArtifactReuseDecision = Readonly<{
  canReuse: true;
  kind: "reuse";
  metric: CacheProofHotPathMetric;
  proof: StaticLayoutArtifactReuseProof;
}> | Readonly<{
  canReuse: false;
  fallback: CacheProofBreakerFallback;
  kind: "fallback";
  metric: CacheProofHotPathMetric;
}>;
type CacheEntryReuseDecision = Readonly<{
  canReuse: true;
  code: CacheProofAcceptanceCode;
  kind: "reuse";
  reuseClass: StaticLayoutReuseProof["reuseClass"];
}> | Readonly<{
  canReuse: false;
  code: CacheProofRejectionCode;
  kind: "reject";
  mode: CacheProofBreakerFallbackMode;
  scope: CacheProofFallbackScope;
}>;
type CacheEntryReuseProof = Readonly<{
  decision: CacheEntryReuseDecision | null;
  kind: "runtime-cache-entry";
}>;
type CreateStaticLayoutArtifactReuseDecisionInput = Readonly<{
  candidateArtifactCompatibility: ArtifactCompatibilityEnvelope;
  candidateObservation: RenderObservation;
  candidateVariant: BuildCacheVariantWithRouteBudgetResult;
  currentArtifactCompatibility: ArtifactCompatibilityEnvelope;
  currentOutput: CacheProofOutputScope;
}> & ArtifactCompatibilityEvaluationOptions;
type BuildRenderObservationInput = Readonly<{
  boundaryOutcome: BoundaryOutcome;
  cacheTags: readonly string[];
  cacheability: RenderCacheability;
  completeness: RenderObservationCompleteness;
  dynamicFetches: readonly string[];
  output: CacheProofOutputScope;
  pathTags: readonly string[];
  requestApis: readonly RenderRequestApiObservation[];
}>;
type BuildRenderRequestApiObservationsInput = Readonly<{
  completeness: RenderObservationCompleteness;
  observed: readonly RenderRequestApiKind[];
}>;
type DisabledCacheProofDecision = Readonly<{
  canReuse: false;
  fallback: CacheProofBreakerFallback;
  kind: "disabled";
  observation: RenderObservation;
  staticLayoutProof?: StaticLayoutReuseProof;
  variant: CacheVariant;
}>;
type CreateDisabledCacheProofDecisionInput = Readonly<{
  observation: RenderObservation;
  staticLayoutProof?: StaticLayoutReuseProof;
  variant: CacheVariant;
}>;
declare function createAppRouteCacheProofGraphScope(route: AppRouteCacheProofGraphScopeInput): AppRouteCacheProofGraphScope;
declare function buildCacheVariant(input: BuildCacheVariantInput): BuildCacheVariantResult;
declare function enforceCacheVariantRouteBudget(input: {
  routeBudget: CacheVariantRouteBudget | null;
  variant: CacheVariant;
}): CacheVariantRouteBudgetAdmission;
declare function buildCacheVariantWithRouteBudget(input: BuildCacheVariantWithRouteBudgetInput): BuildCacheVariantWithRouteBudgetResult;
declare function buildBoundaryOutcomeCompatibility(input: {
  candidate: BoundaryOutcome;
  expected: BoundaryOutcome;
}): BoundaryOutcomeCompatibility;
declare function classifyCacheVariantDimensionDowngrade(input: ClassifyCacheVariantDimensionDowngradeInput): CacheProofDowngradeReason | null;
declare function classifyRenderObservationDowngrade(input: ClassifyRenderObservationDowngradeInput): CacheProofDowngradeClassification;
declare function buildRenderRequestApiObservations(input: BuildRenderRequestApiObservationsInput): RenderRequestApiObservation[];
declare function buildRenderObservation(input: BuildRenderObservationInput): RenderObservation;
declare function hasCompleteNegativeRequestApiProof(observation: RenderObservation, requiredApis: readonly RenderRequestApiKind[]): boolean;
declare function buildStaticLayoutReuseProof(input: BuildStaticLayoutReuseProofInput): BuildStaticLayoutReuseProofResult;
declare function createStaticLayoutArtifactReuseDecision(input: CreateStaticLayoutArtifactReuseDecisionInput): StaticLayoutArtifactReuseDecision;
declare function createCacheEntryReuseProof(decision: StaticLayoutArtifactReuseDecision | null): CacheEntryReuseProof;
declare function createDisabledCacheProofDecision(input: CreateDisabledCacheProofDecisionInput): DisabledCacheProofDecision;
//#endregion
export { ALL_RENDER_REQUEST_API_KINDS, AppRouteCacheProofGraphScope, AppRouteCacheProofGraphScopeInput, BoundaryOutcome, BoundaryOutcomeCompatibility, BuildCacheVariantInput, BuildCacheVariantResult, BuildCacheVariantWithRouteBudgetInput, BuildCacheVariantWithRouteBudgetResult, BuildRenderObservationInput, BuildRenderRequestApiObservationsInput, BuildStaticLayoutReuseProofInput, BuildStaticLayoutReuseProofResult, CACHE_PROOF_MODEL_SCHEMA_VERSION, CacheEntryReuseDecision, CacheEntryReuseProof, CacheProofAcceptanceCode, CacheProofBreakerFallback, CacheProofBreakerFallbackMode, CacheProofDowngradeClassification, CacheProofDowngradeReason, CacheProofDowngradeTarget, CacheProofFallbackScope, CacheProofHotPathMetric, CacheProofModelSchemaVersion, CacheProofOutputScope, CacheProofRejectionCode, CacheProofTraceCode, CacheProofTraceFieldValue, CacheProofTraceFields, CacheVariant, CacheVariantBudget, CacheVariantDimension, CacheVariantDimensionInput, CacheVariantDimensionPrivacy, CacheVariantDimensionSource, CacheVariantRouteBudget, CacheVariantRouteBudgetAdmission, ClassifyCacheVariantDimensionDowngradeInput, ClassifyRenderObservationDowngradeInput, CreateDisabledCacheProofDecisionInput, CreateStaticLayoutArtifactReuseDecisionInput, DEFAULT_CACHE_VARIANT_BUDGET, DisabledCacheProofDecision, RenderCacheability, RenderObservation, RenderObservationCompleteness, RenderRequestApiKind, RenderRequestApiObservation, RenderRequestApiStatus, StaticLayoutArtifactReuseDecision, StaticLayoutArtifactReuseProof, StaticLayoutCacheProofOutputScope, StaticLayoutReuseProof, buildBoundaryOutcomeCompatibility, buildCacheVariant, buildCacheVariantWithRouteBudget, buildRenderObservation, buildRenderRequestApiObservations, buildStaticLayoutReuseProof, classifyCacheVariantDimensionDowngrade, classifyRenderObservationDowngrade, createAppRouteCacheProofGraphScope, createCacheEntryReuseProof, createDisabledCacheProofDecision, createStaticLayoutArtifactReuseDecision, enforceCacheVariantRouteBudget, hasCompleteNegativeRequestApiProof };