import { ModuleInfoProvider } from "./layout-classification.js";
import { RouteClassificationManifest } from "./route-classification-manifest.js";

//#region src/build/route-classification-injector.d.ts
/**
 * Build-time route classification injection.
 *
 * Codegen describes route shape by emitting stable `__VINEXT_CLASS` stubs and
 * per-route call sites. This module owns the behavioral side of replacing
 * those stubs with build-time decisions once the final RSC module graph exists.
 */
type RouteClassificationChunk = {
  code: string;
  fileName: string;
};
type RouteClassificationInjectionPlan = {
  kind: "skip";
} | {
  code: string;
  fileName: string;
  kind: "patch";
  map: null;
};
type PlanRouteClassificationInjectionOptions = {
  canonicalizeLayoutPath?: (path: string) => string;
  chunks: readonly RouteClassificationChunk[];
  dynamicShimPaths: ReadonlySet<string>;
  enableDebugReasons: boolean;
  manifest: RouteClassificationManifest;
  moduleInfo: ModuleInfoProvider;
};
declare function planRouteClassificationInjection(options: PlanRouteClassificationInjectionOptions): RouteClassificationInjectionPlan;
//#endregion
export { planRouteClassificationInjection };