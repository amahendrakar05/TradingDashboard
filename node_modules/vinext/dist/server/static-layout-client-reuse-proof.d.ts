import { ArtifactCompatibilityEnvelope } from "./artifact-compatibility.js";

//#region src/server/static-layout-client-reuse-proof.d.ts
type StaticLayoutClientReuseProofInput = Readonly<{
  artifactCompatibility: ArtifactCompatibilityEnvelope;
  layoutId: string;
  rootBoundaryId: string | null;
  routeId: string;
  variantCacheKey: string;
}>;
declare function createStaticLayoutClientReuseRouteId(layoutId: string): string;
declare function createStaticLayoutClientReusePayloadHash(input: StaticLayoutClientReuseProofInput): string;
declare function createStaticLayoutClientReuseArtifactCompatibility(input: StaticLayoutClientReuseProofInput): ArtifactCompatibilityEnvelope;
//#endregion
export { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId };