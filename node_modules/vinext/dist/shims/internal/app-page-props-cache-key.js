//#region src/shims/internal/app-page-props-cache-key.ts
const APP_PAGE_PROPS_CACHE_KEY_MARKER = Symbol.for("vinext.appPagePropsCacheKeyMarker");
function markAppPagePropsForUseCache(props) {
	Object.defineProperty(props, APP_PAGE_PROPS_CACHE_KEY_MARKER, {
		configurable: false,
		enumerable: false,
		value: true,
		writable: false
	});
	return props;
}
function isMarkedAppPagePropsObject(value) {
	return Reflect.get(value, APP_PAGE_PROPS_CACHE_KEY_MARKER) === true;
}
//#endregion
export { isMarkedAppPagePropsObject, markAppPagePropsForUseCache };
