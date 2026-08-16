import { OperationLane } from "./operation-token.js";
import { ServerActionResultFacts } from "./navigation-planner.js";

//#region src/server/app-browser-action-result.d.ts
type AppBrowserServerActionResult<TRoot> = {
  root?: TRoot;
  returnValue?: {
    ok: boolean;
    data: unknown;
  };
};
type ServerActionRevalidationKind = "dynamicOnly" | "none" | "staticAndDynamic";
type ServerActionInitiationSnapshot<TRouterState> = {
  href: string;
  navigationId: number;
  path: string;
  routerState: TRouterState;
};
/**
 * Structural discriminator: matches on `"returnValue"` or `"root"` keys.
 * This is safe because {@link AppWireElements} keys are prefixed (`route:`,
 * `slot:`, `__route`, etc.) and will never collide with these property names.
 * If the wire format ever adds a `"root"` key, this guard must be updated.
 */
declare function isServerActionResult<TRoot>(value: unknown): value is AppBrowserServerActionResult<TRoot>;
declare function shouldClearClientNavigationCachesForServerActionResult<TRoot>(result: AppBrowserServerActionResult<TRoot> | TRoot, revalidation?: ServerActionRevalidationKind): boolean;
declare function parseServerActionRevalidationHeader(headers: Pick<Headers, "get">): ServerActionRevalidationKind;
declare function resolveServerActionOperationLane(revalidation: ServerActionRevalidationKind): Extract<OperationLane, "refresh" | "server-action">;
declare function normalizeServerActionThrownValue(data: unknown, responseStatus: number): unknown;
declare function shouldSyncServerActionHttpFallbackHead<TRoot>(result: AppBrowserServerActionResult<TRoot> | TRoot): boolean;
declare function readInvalidServerActionResponseError(response: Pick<Response, "headers" | "status" | "text">, hasRedirectLocation: boolean): Promise<Error | null>;
type ServerActionResultResponseFactsInput = {
  actionRedirectHref: string | null;
  actionRedirectType: string | null;
  clientCompatibilityId: string | null;
  contentTypeHeader: string | null;
  compatibilityIdHeader: string | null;
  currentHref: string;
  origin: string;
  responseUrl: string | null;
};
/**
 * Converts raw browser response data into the narrow facts expected by the
 * navigation planner. This is the single place where redirect-type
 * normalisation and RSC content-type detection happen for server-action
 * compatibility checks.
 */
declare function createServerActionResultFacts(input: ServerActionResultResponseFactsInput): ServerActionResultFacts;
declare function shouldScheduleRefreshForDiscardedServerAction(revalidation: ServerActionRevalidationKind): boolean;
declare function createServerActionInitiationSnapshot<TRouterState>(options: {
  href: string;
  navigationId: number;
  origin?: string;
  routerState: TRouterState;
}): ServerActionInitiationSnapshot<TRouterState>;
type DiscardedServerActionRefreshScheduler = {
  markNavigationSettled(): void;
  markNavigationStart(): void;
  schedule(): void;
};
type DiscardedServerActionRefreshSchedulerOptions = {
  queueTask?: (callback: () => void) => void;
  runRefresh: () => void;
};
declare function createDiscardedServerActionRefreshScheduler(options: DiscardedServerActionRefreshSchedulerOptions): DiscardedServerActionRefreshScheduler;
//#endregion
export { AppBrowserServerActionResult, ServerActionResultResponseFactsInput, ServerActionRevalidationKind, createDiscardedServerActionRefreshScheduler, createServerActionInitiationSnapshot, createServerActionResultFacts, isServerActionResult, normalizeServerActionThrownValue, parseServerActionRevalidationHeader, readInvalidServerActionResponseError, resolveServerActionOperationLane, shouldClearClientNavigationCachesForServerActionResult, shouldScheduleRefreshForDiscardedServerAction, shouldSyncServerActionHttpFallbackHead };