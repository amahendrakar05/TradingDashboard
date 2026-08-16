//#region src/shims/internal/pages-router-accessor.ts
const PAGES_NAVIGATION_ACCESSOR_KEY = Symbol.for("vinext.navigation.pagesNavigationContextAccessor");
function getPagesNavigationContext() {
	const accessor = globalThis[PAGES_NAVIGATION_ACCESSOR_KEY];
	if (!accessor) return null;
	try {
		return accessor();
	} catch {
		return null;
	}
}
//#endregion
export { getPagesNavigationContext };
