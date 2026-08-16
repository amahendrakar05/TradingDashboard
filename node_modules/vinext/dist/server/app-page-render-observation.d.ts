import { BoundaryOutcome, CacheProofOutputScope, RenderCacheability, RenderObservation, RenderObservationCompleteness, RenderRequestApiKind } from "./cache-proof.js";
import { ReactNode } from "react";

//#region src/server/app-page-render-observation.d.ts
type AppPageRenderObservationState = Readonly<{
  dynamicFetches: readonly string[];
  requestApis: readonly RenderRequestApiKind[];
}>;
declare function createEmptyAppPageRenderObservationState(): AppPageRenderObservationState;
declare function consumeAppPageRenderObservationState(): AppPageRenderObservationState;
declare function discardAppPageRenderState(): void;
declare function createAppPageRenderObservation(options: {
  boundaryOutcome: BoundaryOutcome;
  cacheTags: readonly string[];
  cacheability: RenderCacheability;
  cleanPathname: string;
  completeness: RenderObservationCompleteness;
  output: CacheProofOutputScope;
  params: Record<string, unknown>;
  state: AppPageRenderObservationState;
}): RenderObservation;
declare function createAppPageRscOutputScope(options: {
  element: ReactNode | Readonly<Record<string, ReactNode>>;
  mountedSlotsHeader?: string | null;
  renderEpoch: string | null;
  rootBoundaryId: string | null;
  routePattern: string;
}): CacheProofOutputScope;
declare function createAppPageHtmlOutputScope(options: {
  element: ReactNode | Readonly<Record<string, ReactNode>>;
  renderEpoch: string | null;
  rootBoundaryId: string | null;
  routePattern: string;
}): CacheProofOutputScope;
//#endregion
export { AppPageRenderObservationState, consumeAppPageRenderObservationState, createAppPageHtmlOutputScope, createAppPageRenderObservation, createAppPageRscOutputScope, createEmptyAppPageRenderObservationState, discardAppPageRenderState };