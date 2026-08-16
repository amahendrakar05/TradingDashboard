//#region src/shims/pages-router-runtime.ts
let pagesRouterPopStateHandler;
let stampInitialHistoryStateFn;
let pagesRouterRuntimeInstalled = false;
function setPagesRouterPopStateHandler(handler) {
	pagesRouterPopStateHandler = handler;
}
/**
* Register the function that stamps Next.js-shaped state onto the initial
* document entry (called once at install time). Router.ts registers this so
* the runtime module stays free of router internals.
*/
function setStampInitialHistoryState(fn) {
	stampInitialHistoryStateFn = fn;
}
function installPagesRouterRuntime() {
	if (typeof window === "undefined" || pagesRouterRuntimeInstalled) return;
	if (!pagesRouterPopStateHandler) throw new Error("[vinext] Pages Router runtime installed before next/router was initialized");
	pagesRouterRuntimeInstalled = true;
	stampInitialHistoryStateFn?.();
	window.addEventListener("popstate", pagesRouterPopStateHandler);
}
//#endregion
export { installPagesRouterRuntime, setPagesRouterPopStateHandler, setStampInitialHistoryState };
