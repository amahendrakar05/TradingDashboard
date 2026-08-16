//#region src/client/app-nav-failure-handler.d.ts
declare function stageAppNavigationFailureTarget(href: string): void;
declare function getAppNavigationFailureTarget(href: string): URL | null;
declare function clearAppNavigationFailureTarget(target?: string | URL): void;
declare function handleAppNavigationFailure(error: unknown): boolean;
declare function installAppNavigationFailureListeners(): () => void;
//#endregion
export { clearAppNavigationFailureTarget, getAppNavigationFailureTarget, handleAppNavigationFailure, installAppNavigationFailureListeners, stageAppNavigationFailureTarget };