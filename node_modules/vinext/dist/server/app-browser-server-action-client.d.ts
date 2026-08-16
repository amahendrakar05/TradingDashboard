import { AppElements, AppWireElements } from "./app-elements-wire.js";
import { navigationPlanner } from "./navigation-planner.js";
import { AppBrowserServerActionResult, ServerActionRevalidationKind } from "./app-browser-action-result.js";
import { AppRouterState } from "./app-browser-state.js";

//#region src/server/app-browser-server-action-client.d.ts
type ServerActionResult = AppBrowserServerActionResult<AppWireElements>;
type ClientServerActionInitiation = {
  href: string;
  navigationId: number;
  path: string;
  routerState: AppRouterState;
};
type ActionRedirectTarget = {
  href: string;
  type: string;
  status: number;
};
type ClientServerActionDeps = {
  basePath: string;
  clearClientNavigationCaches(): void;
  clientRscCompatibilityId: string | null;
  commitSameUrlNavigatePayload(elements: Promise<AppElements>, actionInitiation: ClientServerActionInitiation, returnValue: ServerActionResult["returnValue"] | undefined, revalidation: ServerActionRevalidationKind): Promise<unknown>;
  navigationPlanner: typeof navigationPlanner;
  performHardNavigation(url: string, historyMode?: "assign" | "replace"): void;
  renderRedirectPayload(elements: AppElements, target: ActionRedirectTarget, actionInitiation: ClientServerActionInitiation, revalidation: ServerActionRevalidationKind): void;
  syncCurrentHistoryState(previousNextUrl: string | null, bfcacheIds: Readonly<Record<string, string>>): void;
  syncServerActionHttpFallbackHead(status: number | null): void;
};
declare function invokeClientServerAction(id: string, args: unknown[], actionInitiation: ClientServerActionInitiation, deps: ClientServerActionDeps): Promise<unknown>;
//#endregion
export { ClientServerActionDeps, ClientServerActionInitiation, invokeClientServerAction };