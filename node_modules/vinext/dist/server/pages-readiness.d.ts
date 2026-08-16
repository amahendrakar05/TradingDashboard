import { VinextNextData } from "../client/vinext-next-data.js";
import { PagesPageModule } from "./pages-page-data.js";

//#region src/server/pages-readiness.d.ts
/**
 * Shared Pages Router readiness modeling.
 *
 * The initial `router.isReady` value for the `next/navigation` compat hooks is
 * derived from the page/_app data-fetching exports plus the configured-rewrites
 * flag. The client recomputes readiness from those flags and its live URL,
 * matching the Pages Router constructor; server-only readiness remains in the
 * request context. See `getPagesNavigationIsReadyFromSerializedState` in
 * `shims/router.ts`.
 */
/**
 * The serialized readiness flags (gssp/gsp/gip/appGip/autoExport +
 * `__vinext.hasRewrites`) that gate the initial Pages Router `router.isReady`.
 * The field names/types are projected from the canonical `VinextNextData` so
 * this stays in lockstep with the `__NEXT_DATA__` shape it feeds into.
 */
type PagesReadinessNextData = Pick<VinextNextData, "gssp" | "gsp" | "gip" | "appGip" | "autoExport" | "nextExport"> & {
  __vinext: Pick<NonNullable<VinextNextData["__vinext"]>, "hasRewrites">;
};
/**
 * Build the readiness flags for a Pages Router render. Shared by the dev and
 * production Pages render paths.
 */
declare function buildPagesReadinessNextData(options: {
  pageModule: PagesPageModule;
  appComponent: {
    getInitialProps?: unknown;
    origGetInitialProps?: unknown;
  } | null | undefined;
  hasRewrites: boolean;
}): PagesReadinessNextData;
//#endregion
export { buildPagesReadinessNextData };