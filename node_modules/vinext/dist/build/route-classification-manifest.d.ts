import { ClassificationReason, ModuleGraphStaticReason } from "./layout-classification-types.js";
import { AppRoute } from "../routing/app-route-graph.js";

//#region src/build/route-classification-manifest.d.ts
type Layer1Class = "static" | "dynamic";
type RouteManifestEntry = {
  /** Route pattern for diagnostics (e.g. "/blog/:slug"). */pattern: string; /** Absolute file paths for each layout, ordered root → leaf. */
  layoutPaths: string[]; /** Layer 1 (segment config) results keyed by numeric layout index. */
  layer1: Map<number, Layer1Class>;
  /**
   * Structured reasons for every Layer 1 decision, keyed by the same layout
   * index. Always populated in lockstep with `layer1` so the debug channel
   * can surface which segment-config field produced the decision.
   */
  layer1Reasons: Map<number, ClassificationReason>;
};
type RouteClassificationManifest = {
  routes: RouteManifestEntry[];
};
/**
 * Reads each layout's source at build time and runs Layer 1 segment-config
 * classification. Fails loudly if any layout file is missing — a missing
 * layout means the routing scan and the filesystem have drifted, and shipping
 * a build in that state would silently break layout rendering.
 */
declare function collectRouteClassificationManifest(routes: readonly AppRoute[]): RouteClassificationManifest;
/**
 * Builds a JavaScript arrow-function expression that dispatches route index
 * to a pre-computed `Map<layoutIndex, "static" | "dynamic">` of build-time
 * classifications. The returned string is suitable for embedding into the
 * generated RSC entry via the `renderChunk` hook.
 *
 * `layer2PerRoute` is typed to only carry `"static"` entries — the
 * module-graph classifier can only prove static, so "needs-probe" results
 * are omitted by the caller before this map is constructed.
 */
declare function buildClassificationReplacement(manifest: RouteClassificationManifest, layer2PerRoute: ReadonlyMap<number, ReadonlyMap<number, ModuleGraphStaticReason>>): string;
/**
 * Sibling of `buildClassificationReplacement`: emits a dispatch function
 * that returns `Map<layoutIndex, ClassificationReason>` per route.
 *
 * The runtime consults this map only when `VINEXT_DEBUG_CLASSIFICATION` is
 * set, and the plugin only patches this dispatcher into the built bundle when
 * that env var is present at build time.
 *
 * Layer 1 priority applies the same way as in `buildClassificationReplacement`:
 * a segment-config reason must override a module-graph reason for the same
 * layout index.
 */
declare function buildReasonsReplacement(manifest: RouteClassificationManifest, layer2PerRoute: ReadonlyMap<number, ReadonlyMap<number, ModuleGraphStaticReason>>): string;
//#endregion
export { RouteClassificationManifest, buildClassificationReplacement, buildReasonsReplacement, collectRouteClassificationManifest };