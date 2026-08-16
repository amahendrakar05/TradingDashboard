//#region src/shims/pages-router-runtime.d.ts
type PagesRouterPopStateHandler = (event: PopStateEvent) => void;
declare function setPagesRouterPopStateHandler(handler: PagesRouterPopStateHandler): void;
/**
 * Register the function that stamps Next.js-shaped state onto the initial
 * document entry (called once at install time). Router.ts registers this so
 * the runtime module stays free of router internals.
 */
declare function setStampInitialHistoryState(fn: () => void): void;
declare function installPagesRouterRuntime(): void;
//#endregion
export { installPagesRouterRuntime, setPagesRouterPopStateHandler, setStampInitialHistoryState };