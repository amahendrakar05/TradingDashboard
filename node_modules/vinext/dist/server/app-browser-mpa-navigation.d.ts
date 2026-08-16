import { HistoryUpdateMode } from "./app-browser-navigation-controller.js";

//#region src/server/app-browser-mpa-navigation.d.ts
type AppBrowserMpaNavigationWindow = {
  location: Pick<Location, "assign" | "replace">;
  requestAnimationFrame?: (callback: FrameRequestCallback) => unknown;
  setTimeout(callback: () => void, timeout: number): unknown;
};
declare function hasPendingAppRouterPageRedirect(targetDocument: unknown): boolean;
declare class AppBrowserMpaNavigationScheduler {
  #private;
  reset(): void;
  navigate(targetWindow: AppBrowserMpaNavigationWindow, href: string, historyUpdateMode: HistoryUpdateMode): void;
}
//#endregion
export { AppBrowserMpaNavigationScheduler, AppBrowserMpaNavigationWindow, hasPendingAppRouterPageRedirect };