//#region src/server/app-browser-mpa-navigation.ts
const NEXT_APP_ROUTER_PAGE_REDIRECT_MARKER_ID = "__next-page-redirect";
function hasPendingAppRouterPageRedirect(targetDocument) {
	if (typeof targetDocument !== "object" || targetDocument === null) return false;
	if (!("getElementById" in targetDocument)) return false;
	const { getElementById } = targetDocument;
	if (typeof getElementById !== "function") return false;
	return getElementById.call(targetDocument, NEXT_APP_ROUTER_PAGE_REDIRECT_MARKER_ID) !== null;
}
var AppBrowserMpaNavigationScheduler = class {
	#pendingNavigation = null;
	#nextToken = 0;
	reset() {
		this.#pendingNavigation = null;
	}
	navigate(targetWindow, href, historyUpdateMode) {
		const pendingNavigation = this.#pendingNavigation;
		if (pendingNavigation?.href === href && pendingNavigation.historyUpdateMode === historyUpdateMode) return;
		const token = this.#nextToken + 1;
		this.#nextToken = token;
		this.#pendingNavigation = {
			href,
			historyUpdateMode,
			token
		};
		const navigate = () => {
			const currentNavigation = this.#pendingNavigation;
			if (currentNavigation?.href !== href || currentNavigation.historyUpdateMode !== historyUpdateMode || currentNavigation.token !== token) return;
			if (historyUpdateMode === "replace") targetWindow.location.replace(href);
			else targetWindow.location.assign(href);
		};
		if (typeof targetWindow.requestAnimationFrame === "function") {
			targetWindow.requestAnimationFrame(() => {
				targetWindow.setTimeout(navigate, 0);
			});
			return;
		}
		targetWindow.setTimeout(navigate, 0);
	}
};
//#endregion
export { AppBrowserMpaNavigationScheduler, hasPendingAppRouterPageRedirect };
