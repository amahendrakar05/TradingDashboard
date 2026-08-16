import { ArtifactCompatibilityEnvelope } from "./artifact-compatibility.js";
import { CacheEntryReuseProof, RenderObservation } from "./cache-proof.js";
import { ClientReuseManifestSkipDisposition } from "./client-reuse-manifest.js";
import { compareStrings } from "../utils/compare.js";
import { ReactNode } from "react";

//#region src/server/app-elements-wire.d.ts
declare const APP_ARTIFACT_COMPATIBILITY_KEY = "__artifactCompatibility";
declare const APP_CACHE_ENTRY_REUSE_PROOF_KEY = "__cacheEntryReuseProof";
declare const APP_DYNAMIC_STALE_TIME_KEY = "__dynamicStaleTime";
declare const APP_INTERCEPTION_KEY = "__interception";
declare const APP_INTERCEPTION_CONTEXT_KEY = "__interceptionContext";
declare const APP_LAYOUT_IDS_KEY = "__layoutIds";
declare const APP_LAYOUT_FLAGS_KEY = "__layoutFlags";
declare const APP_RENDER_OBSERVATION_KEY = "__renderObservation";
declare const APP_ROUTE_KEY = "__route";
declare const APP_ROOT_LAYOUT_KEY = "__rootLayout";
declare const APP_SKIPPED_LAYOUT_IDS_KEY = "__skippedLayoutIds";
declare const APP_SOURCE_PAGE_KEY = "__sourcePage";
declare const APP_SLOT_BINDINGS_KEY = "__slotBindings";
/**
 * Static sibling segment names for the matched route, surfaced so the client
 * router can determine if a cached prefetch of a dynamic route can be reused
 * when navigating to a static sibling URL.
 *
 * Mirrors Next.js's `staticSiblings` tuple element on the loader-tree dynamic
 * segments (issue cloudflare/vinext#1525).
 */
declare const APP_STATIC_SIBLINGS_KEY = "__staticSiblings";
declare const APP_UNMATCHED_SLOT_WIRE_VALUE = "__VINEXT_UNMATCHED_SLOT__";
declare const UNMATCHED_SLOT: unique symbol;
type AppElementsSlotBindingState = "active" | "default" | "unmatched";
type AppElementsSlotBinding = Readonly<{
  activeRouteId?: string | null;
  ownerLayoutId: string | null;
  slotId: string;
  state: AppElementsSlotBindingState;
}>;
type AppElementsInterception = Readonly<{
  sourceMatchedUrl: string;
  sourceRouteId: string;
  slotId: string;
  targetMatchedUrl: string;
  targetRouteId: string;
}>;
declare const compareAppElementsSlotIds: typeof compareStrings;
declare function normalizeAppElementsSlotBindings(slotBindings: readonly AppElementsSlotBinding[], options?: {
  layoutIds?: readonly string[];
}): readonly AppElementsSlotBinding[];
type AppElementValue = ReactNode | typeof UNMATCHED_SLOT | string | null | LayoutFlags | ArtifactCompatibilityEnvelope | CacheEntryReuseProof | AppElementsInterception | readonly string[] | readonly AppElementsSlotBinding[];
type AppWireElementValue = ReactNode | string | null | LayoutFlags | ArtifactCompatibilityEnvelope | CacheEntryReuseProof | AppElementsInterception | readonly string[] | readonly AppElementsSlotBinding[];
type AppElements = Readonly<Record<string, AppElementValue>>;
type AppWireElements = Readonly<Record<string, AppWireElementValue>>;
/**
 * Per-layout static/dynamic flags. `"s"` = static (skippable on next nav);
 * `"d"` = dynamic (must always render).
 *
 * Lifecycle (partial — later PRs extend this):
 *
 *   1. PROBE   — probeAppPageLayouts (server/app-page-execution.ts) returns
 *                LayoutFlags for every layout in the route at render time.
 *
 *   2. ATTACH  — AppElementsWire.encodeOutgoingPayload writes `__layoutFlags`
 *                into the outgoing App Router payload record.
 *
 *   3. WIRE    — renderToReadableStream serializes the record as RSC row 0.
 *
 *   4. PARSE   — AppElementsWire.readMetadata extracts layoutFlags from the
 *                wire payload on the client side.
 */
type LayoutFlags = Readonly<Record<string, "s" | "d">>;
type AppElementsMetadata = {
  artifactCompatibility: ArtifactCompatibilityEnvelope;
  cacheEntryReuseProof?: CacheEntryReuseProof;
  dynamicStaleTimeSeconds?: number;
  interception: AppElementsInterception | null;
  interceptionContext: string | null;
  layoutIds: readonly string[];
  layoutFlags: LayoutFlags;
  routeId: string;
  rootLayoutTreePath: string | null;
  skippedLayoutIds: readonly string[];
  slotBindings: readonly AppElementsSlotBinding[];
  sourcePage: string | null;
};
type AppElementsWireElementKey = {
  kind: "layout";
  treePath: string;
} | {
  interceptionContext: string | null;
  kind: "page";
  path: string;
} | {
  interceptionContext: string | null;
  kind: "route";
  path: string;
} | {
  kind: "slot";
  name: string;
  treePath: string;
} | {
  kind: "template";
  treePath: string;
};
type AppElementsWireMetadataInput = {
  dynamicStaleTimeSeconds?: number;
  interception?: AppElementsInterception | null;
  interceptionContext: string | null;
  layoutIds?: readonly string[];
  routeId: string;
  rootLayoutTreePath: string | null;
  slotBindings?: readonly AppElementsSlotBinding[];
  sourcePage?: string | null;
};
type AppElementsWireMetadataEntries = Readonly<{
  [APP_DYNAMIC_STALE_TIME_KEY]?: number;
  [APP_ROUTE_KEY]: string;
  [APP_INTERCEPTION_KEY]?: AppElementsInterception;
  [APP_INTERCEPTION_CONTEXT_KEY]: string | null;
  [APP_LAYOUT_IDS_KEY]: readonly string[];
  [APP_ROOT_LAYOUT_KEY]: string | null;
  [APP_SOURCE_PAGE_KEY]?: string;
  [APP_SLOT_BINDINGS_KEY]?: readonly AppElementsSlotBinding[];
}>;
/**
 * The outgoing wire payload shape. Includes ReactNode values for the
 * rendered tree plus metadata values like LayoutFlags attached under
 * known keys (e.g. __layoutFlags). Distinct from AppElements / AppWireElements
 * which only carry render-time values.
 */
type AppOutgoingElements = Readonly<Record<string, ReactNode | LayoutFlags | ArtifactCompatibilityEnvelope | CacheEntryReuseProof | AppElementsInterception | RenderObservation | number | readonly string[] | readonly AppElementsSlotBinding[]>>;
type AppElementsWireKeys = {
  readonly artifactCompatibility: typeof APP_ARTIFACT_COMPATIBILITY_KEY;
  readonly cacheEntryReuseProof: typeof APP_CACHE_ENTRY_REUSE_PROOF_KEY;
  readonly dynamicStaleTime: typeof APP_DYNAMIC_STALE_TIME_KEY;
  readonly interception: typeof APP_INTERCEPTION_KEY;
  readonly interceptionContext: typeof APP_INTERCEPTION_CONTEXT_KEY;
  readonly layoutIds: typeof APP_LAYOUT_IDS_KEY;
  readonly layoutFlags: typeof APP_LAYOUT_FLAGS_KEY;
  readonly renderObservation: typeof APP_RENDER_OBSERVATION_KEY;
  readonly rootLayout: typeof APP_ROOT_LAYOUT_KEY;
  readonly route: typeof APP_ROUTE_KEY;
  readonly skippedLayoutIds: typeof APP_SKIPPED_LAYOUT_IDS_KEY;
  readonly slotBindings: typeof APP_SLOT_BINDINGS_KEY;
  readonly sourcePage: typeof APP_SOURCE_PAGE_KEY;
};
type AppElementsWireCodec = {
  readonly keys: AppElementsWireKeys;
  readonly unmatchedSlotValue: typeof APP_UNMATCHED_SLOT_WIRE_VALUE;
  createMetadataEntries(input: AppElementsWireMetadataInput): AppElementsWireMetadataEntries;
  decode(elements: AppWireElements): AppElements;
  encodeCacheKey(rscUrl: string, interceptionContext: string | null): string;
  encodeLayoutId(treePath: string): string;
  encodeOutgoingPayload(input: {
    element: ReactNode | AppElements;
    artifactCompatibility?: ArtifactCompatibilityEnvelope;
    cacheEntryReuseProof?: CacheEntryReuseProof;
    dynamicStaleTimeSeconds?: number;
    layoutFlags: LayoutFlags;
    renderObservation?: RenderObservation;
    skipDisposition?: ClientReuseManifestSkipDisposition;
  }): ReactNode | AppOutgoingElements;
  encodePageId(routePath: string, interceptionContext: string | null): string;
  encodeRouteId(routePath: string, interceptionContext: string | null): string;
  encodeSlotId(slotName: string, treePath: string): string;
  encodeTemplateId(treePath: string): string;
  isSlotId(key: string): boolean;
  parseElementKey(key: string): AppElementsWireElementKey | null;
  readMetadata(elements: Readonly<Record<string, unknown>>): AppElementsMetadata;
  withLayoutFlags<T extends Record<string, unknown>>(elements: T, layoutFlags: LayoutFlags): T & {
    [APP_LAYOUT_FLAGS_KEY]: LayoutFlags;
  };
};
declare function normalizeAppElements(elements: AppWireElements): AppElements;
/**
 * Type predicate for a plain (non-null, non-array) record of app payload values.
 * Used to distinguish the App Router payload object from bare React elements at
 * the render boundary. Narrows to `Readonly<Record<string, unknown>>` because
 * the outgoing payload carries heterogeneous values (ReactNodes for the rendered
 * tree, plus metadata like `__layoutFlags` which is a plain object). Delegates
 * to React's canonical `isValidElement` so we don't depend on React's internal
 * `$$typeof` marker scheme.
 */
declare function isAppElementsRecord(value: unknown): value is Readonly<Record<string, unknown>>;
declare function withLayoutFlags<T extends Record<string, unknown>>(elements: T, layoutFlags: LayoutFlags): T & {
  [APP_LAYOUT_FLAGS_KEY]: LayoutFlags;
};
declare function buildOutgoingAppPayload(input: {
  element: ReactNode | AppElements;
  artifactCompatibility?: ArtifactCompatibilityEnvelope;
  cacheEntryReuseProof?: CacheEntryReuseProof;
  dynamicStaleTimeSeconds?: number;
  layoutFlags: LayoutFlags;
  renderObservation?: RenderObservation;
  skipDisposition?: ClientReuseManifestSkipDisposition;
}): ReactNode | AppOutgoingElements;
declare function readAppElementsMetadata(elements: Readonly<Record<string, unknown>>): AppElementsMetadata;
declare const AppElementsWire: AppElementsWireCodec;
//#endregion
export { APP_ARTIFACT_COMPATIBILITY_KEY, APP_CACHE_ENTRY_REUSE_PROOF_KEY, APP_DYNAMIC_STALE_TIME_KEY, APP_INTERCEPTION_CONTEXT_KEY, APP_INTERCEPTION_KEY, APP_LAYOUT_FLAGS_KEY, APP_LAYOUT_IDS_KEY, APP_RENDER_OBSERVATION_KEY, APP_ROOT_LAYOUT_KEY, APP_ROUTE_KEY, APP_SKIPPED_LAYOUT_IDS_KEY, APP_SLOT_BINDINGS_KEY, APP_SOURCE_PAGE_KEY, APP_STATIC_SIBLINGS_KEY, APP_UNMATCHED_SLOT_WIRE_VALUE, AppElementValue, AppElements, AppElementsInterception, AppElementsSlotBinding, AppElementsWire, AppOutgoingElements, AppWireElements, LayoutFlags, UNMATCHED_SLOT, buildOutgoingAppPayload, compareAppElementsSlotIds, isAppElementsRecord, normalizeAppElements, normalizeAppElementsSlotBindings, readAppElementsMetadata, withLayoutFlags };