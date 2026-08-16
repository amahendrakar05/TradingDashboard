import { LayoutFlags } from "./app-elements-wire.js";
import { AppPageSpecialError, LayoutClassificationOptions } from "./app-page-execution.js";

//#region src/server/app-page-probe.d.ts
type ProbeReactServerSubtreeOptions = Readonly<{
  maxDepth?: number;
  maxNodes?: number;
}>;
/**
 * Invokes server-component children returned by a layout probe so per-layout
 * skip eligibility observes data dependencies created below the layout's
 * immediate function body. The real RSC render remains authoritative; probe
 * failures only make static-layout skip fall back to render-and-send.
 */
declare function probeReactServerSubtree(node: unknown, options?: ProbeReactServerSubtreeOptions): Promise<void>;
/**
 * Build a probePage() invocation for the App Router request lifecycle.
 *
 * The generated RSC entry calls this once per request after route matching to
 * eagerly invoke the page component. Surfacing redirect()/notFound() throws
 * here lets the probe lifecycle turn them into proper HTTP responses before
 * RSC streaming begins (see `probeAppPageBeforeRender`).
 *
 * The helper exists to keep the generated entry thin (a single delegation
 * call) and to make the search-params wiring directly unit-testable. A bug
 * here previously slipped through because the entry hand-rolled the call and
 * read a non-existent key off `collectAppPageSearchParams`'s return value
 * (see https://github.com/cloudflare/vinext/issues/1235).
 *
 * Returns `null` when the route has no page component (eg. interception-only
 * routes), matching the caller contract on `probePage`.
 */
declare function probeAppPage(options: {
  pageComponent: unknown;
  asyncRouteParams: unknown;
  searchParams: URLSearchParams | null | undefined;
}): unknown;
type AppPageProbeModule = Readonly<{
  default?: unknown;
}> | null | undefined;
type AppPageProbeSlot = Readonly<{
  page?: AppPageProbeModule;
}> | null | undefined;
type AppPageProbeRoute = Readonly<{
  slots?: Readonly<Record<string, AppPageProbeSlot>> | null;
}>;
type AppPageProbeIntercept = Readonly<{
  page?: AppPageProbeModule;
  matchedParams?: unknown;
  /**
   * Key of the parallel-route slot this interception overrides. At render
   * time the matched route's `slots[slotKey].page` is replaced by the
   * interception page (see app-page-element-builder.ts), so the slot's own
   * page never renders for this request.
   */
  slotKey?: string | null;
}> | null | undefined;
/**
 * Fan out the per-request page probes for the App Router dispatch lifecycle.
 *
 * A single request can render more than one page component: the matched page,
 * each active parallel-route slot page, and an interception page when one
 * matches. Each must be probed so searchParams access anywhere in the rendered
 * tree bails the request out of the query-invariant static cache.
 *
 * Extracted out of the generated RSC entry so the fan-out is directly
 * unit-testable and the entry stays codegen glue (see AGENTS.md "Generated
 * Entry Modules Should Stay Thin"). Returns a list of resolved promises so the
 * caller can `Promise.all` them.
 *
 * The fan-out is scoped to the page components that render for this request:
 *
 * - **Interception override:** when an interception matches it replaces the
 *   page of the slot named by `intercept.slotKey` (the element builder sets
 *   `overrides[slotKey].pageModule` to the interception page, which wins over
 *   `slot.page` in `app-page-route-wiring.tsx`). We probe the interception page
 *   in place of that slot's own page rather than probing both — probing the
 *   overridden slot page would mark an otherwise-static request dynamic for a
 *   component that never renders.
 * - **Non-overridden slots:** `slot.page?.default` is exactly what renders.
 *   `app-page-route-wiring.tsx` resolves a slot to `overrideOrPageComponent ??
 *   defaultComponent`, so whenever a slot has a `page.tsx` that page renders.
 *   When a slot has only a `default.tsx` (including the soft-nav case at
 *   `app-page-route-wiring.tsx:741` that skips an already-mounted slot), there
 *   is no `slot.page?.default`, so `probeAppPage` short-circuits to `null` and
 *   probes nothing — a no-op, not an over-bail.
 *
 * Interception only fires for RSC navigations (`resolveAppPageInterceptState`
 * returns `kind: "none"` when `!isRscRequest`, app-page-request.ts:324), so the
 * interception handling here is gated on `isRscRequest`. For non-RSC (HTML)
 * requests the matched route renders normally, so we probe every slot's own
 * page and skip the interception probe entirely. The remaining "source-route"
 * interception case (where a *different* route renders, app-page-request.ts:342)
 * never reaches this probe: `dispatchAppPage` returns the intercepted response
 * before calling `probePage`, so by the time this runs any matched interception
 * is the current-route override case above.
 *
 * A `default.tsx` that itself awaits `searchParams` is not probed here, but the
 * real render still observes that access and skips the query-invariant cache
 * write (the same loading.tsx backstop), so this cannot under-bail.
 */
declare function buildAppPageProbes(options: {
  route: AppPageProbeRoute;
  pageComponent: unknown;
  asyncRouteParams: unknown;
  searchParams: URLSearchParams | null | undefined;
  intercept?: AppPageProbeIntercept;
  /**
   * Whether this is an RSC navigation. Interception only fires for RSC
   * requests, so the interception probe is ignored when this is false.
   */
  isRscRequest: boolean; /** Fallback raw params used when an interception match omits its own. */
  matchedParams: unknown;
  makeThenableParams: (params: unknown) => unknown;
}): Promise<unknown>[];
type ProbeAppPageBeforeRenderResult = {
  response: Response | null;
  layoutFlags: LayoutFlags;
};
type ProbeAppPageBeforeRenderOptions = {
  hasLoadingBoundary: boolean;
  probePageBeforeRender?: boolean;
  skipProbes?: boolean;
  layoutCount: number;
  probeLayoutAt: (layoutIndex: number) => unknown;
  probePage: () => unknown;
  renderLayoutSpecialError: (specialError: AppPageSpecialError, layoutIndex: number) => Promise<Response>;
  renderPageSpecialError: (specialError: AppPageSpecialError) => Promise<Response>;
  resolveSpecialError: (error: unknown) => AppPageSpecialError | null;
  runWithSuppressedHookWarning<T>(probe: () => Promise<T>): Promise<T>; /** When provided, enables per-layout static/dynamic classification. */
  classification?: LayoutClassificationOptions | null;
};
declare function probeAppPageBeforeRender(options: ProbeAppPageBeforeRenderOptions): Promise<ProbeAppPageBeforeRenderResult>;
//#endregion
export { buildAppPageProbes, probeAppPage, probeAppPageBeforeRender, probeReactServerSubtree };