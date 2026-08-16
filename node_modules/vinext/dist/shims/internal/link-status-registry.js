//#region src/shims/internal/link-status-registry.ts
let linkSetterForMostRecentNavigation = null;
let currentNavigationIsLinkInitiated = false;
/**
* Mark `setter` as the link that started the most recent navigation, resetting
* the previously-tracked link's pending state to idle so only the last-clicked
* link shows a pending state.
*/
function setLinkForCurrentNavigation(setter) {
	if (linkSetterForMostRecentNavigation && linkSetterForMostRecentNavigation !== setter) linkSetterForMostRecentNavigation(false);
	linkSetterForMostRecentNavigation = setter;
	currentNavigationIsLinkInitiated = true;
}
/**
* Stop tracking `setter` if it is the current navigation link. Called when a
* <Link> finishes its own navigation or unmounts so we never hold a stale
* reference to an unmounted component's setter.
*/
function clearLinkForCurrentNavigation(setter) {
	if (linkSetterForMostRecentNavigation === setter) linkSetterForMostRecentNavigation = null;
}
/**
* Reset any link that is currently showing a pending state. Invoked at the
* start of every App Router navigation so that navigations not initiated by the
* tracked link — `router.push`/`router.replace`, form submissions, shallow
* routing, and browser back/forward — clear a stale pending indicator. A
* link-initiated navigation registers itself first via
* `setLinkForCurrentNavigation`; the matching call here consumes that marker and
* keeps the link pending.
*/
function notifyLinkNavigationStart() {
	if (currentNavigationIsLinkInitiated) {
		currentNavigationIsLinkInitiated = false;
		return;
	}
	if (linkSetterForMostRecentNavigation) {
		linkSetterForMostRecentNavigation(false);
		linkSetterForMostRecentNavigation = null;
	}
}
//#endregion
export { clearLinkForCurrentNavigation, notifyLinkNavigationStart, setLinkForCurrentNavigation };
