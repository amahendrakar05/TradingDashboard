import { RenderRequestApiKind } from "./cache-proof.js";
import { ClientReuseManifestRejectionCode, ClientReuseManifestTraceFields } from "./client-reuse-manifest.js";
import { ThenableParamsObserver } from "../shims/thenable-params.js";
import { UnstableCacheObservation } from "../shims/cache-request-state.js";

//#region src/server/app-layout-param-observation.d.ts
type AppLayoutParamAccessObservation = Readonly<{
  cacheLifeObserved: boolean;
  cacheTags: readonly string[];
  cacheableFetchCount: number;
  completeness: "complete" | "unknown";
  dynamicFetchCount: number;
  /**
   * `markDynamicUsage()` fired during the probe (e.g. `"use cache: private"`,
   * `connection()`) with no other observable trace. Folded in from the
   * isolated probe scope so this signal can't diverge from the Layer-3
   * `dynamicDetected` path it replaced.
   */
  dynamicUsageObserved: boolean;
  finiteRevalidateSeconds: number | null;
  keys: readonly string[];
  observed: boolean;
  paramScopeKeys: readonly string[];
  requestApis: readonly RenderRequestApiKind[];
  unstableCaches: readonly UnstableCacheObservation[];
}>;
type AppLayoutParamAccessTracker = Readonly<{
  createThenableParamsObserver: (layoutId: string) => ThenableParamsObserver;
  getLayoutObservation: (layoutId: string) => AppLayoutParamAccessObservation;
  recordLayoutFiniteRevalidate: (layoutId: string, revalidateSeconds: number) => void;
  recordLayoutParamScope: (layoutId: string, paramScopeKeys: readonly string[]) => void;
  runLayoutProbe: (layoutId: string, probe: () => unknown) => unknown;
}>;
type StaticLayoutObservationSkipCode = Extract<ClientReuseManifestRejectionCode, `SKIP_LAYOUT_${string}`>;
type StaticLayoutObservationSkipRejection = Readonly<{
  code: StaticLayoutObservationSkipCode;
  fields: ClientReuseManifestTraceFields;
}>;
declare function getStaticLayoutObservationSkipRejection(observation: AppLayoutParamAccessObservation): StaticLayoutObservationSkipRejection | null;
declare function isAppLayoutObservationUnsafeForStaticReuse(observation: AppLayoutParamAccessObservation): boolean;
declare function createAppLayoutParamAccessTracker(): AppLayoutParamAccessTracker;
//#endregion
export { AppLayoutParamAccessObservation, AppLayoutParamAccessTracker, StaticLayoutObservationSkipRejection, createAppLayoutParamAccessTracker, getStaticLayoutObservationSkipRejection, isAppLayoutObservationUnsafeForStaticReuse };