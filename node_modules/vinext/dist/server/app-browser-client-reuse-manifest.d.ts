import { DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS } from "./client-reuse-manifest.js";
import { AppRouterState } from "./app-browser-state.js";

//#region src/server/app-browser-client-reuse-manifest.d.ts
type ClientReuseManifestLimits = typeof DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS;
type VisibleAppState = Pick<AppRouterState, "elements" | "visibleCommitVersion">;
type CreateClientReuseManifestHeaderOptions = Readonly<{
  limits?: ClientReuseManifestLimits;
}>;
declare function createClientReuseManifestHeaderFromVisibleAppState(state: VisibleAppState, options?: CreateClientReuseManifestHeaderOptions): string | null;
//#endregion
export { createClientReuseManifestHeaderFromVisibleAppState };