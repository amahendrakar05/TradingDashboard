import { installWindowNext } from "./window-next.js";
//#region src/client/app-nav-failure-handler.ts
function getPendingUrl() {
	if (typeof window === "undefined") return null;
	return window.next?.__pendingUrl ?? null;
}
function stageAppNavigationFailureTarget(href) {
	if (!process.env.__NEXT_APP_NAV_FAIL_HANDLING || typeof window === "undefined") return;
	installWindowNext({ __pendingUrl: new URL(href, window.location.href) });
}
function getAppNavigationFailureTarget(href) {
	const pendingUrl = getPendingUrl();
	if (pendingUrl === null || typeof window === "undefined") return null;
	return pendingUrl.href === new URL(href, window.location.href).href ? pendingUrl : null;
}
function clearAppNavigationFailureTarget(target) {
	if (typeof window === "undefined" || window.next?.__pendingUrl === void 0) return;
	if (target instanceof URL) {
		if (window.next.__pendingUrl !== target) return;
	} else if (target !== void 0 && window.next.__pendingUrl.href !== new URL(target, window.location.href).href) return;
	delete window.next.__pendingUrl;
}
function handleAppNavigationFailure(error) {
	if (!process.env.__NEXT_APP_NAV_FAIL_HANDLING || typeof window === "undefined") return false;
	const pendingUrl = getPendingUrl();
	if (pendingUrl === null || pendingUrl.href === window.location.href) return false;
	console.error("Error occurred during navigation, falling back to hard navigation", error);
	window.location.assign(pendingUrl.href);
	return true;
}
function installAppNavigationFailureListeners() {
	if (!process.env.__NEXT_APP_NAV_FAIL_HANDLING || typeof window === "undefined") return () => {};
	const listener = (event) => {
		handleAppNavigationFailure("reason" in event ? event.reason : event.error);
	};
	window.addEventListener("error", listener);
	window.addEventListener("unhandledrejection", listener);
	return () => {
		window.removeEventListener("error", listener);
		window.removeEventListener("unhandledrejection", listener);
	};
}
//#endregion
export { clearAppNavigationFailureTarget, getAppNavigationFailureTarget, handleAppNavigationFailure, installAppNavigationFailureListeners, stageAppNavigationFailureTarget };
