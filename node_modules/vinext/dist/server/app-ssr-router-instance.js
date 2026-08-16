import { assertSafeNavigationUrl } from "../shims/url-safety.js";
import "./app-bfcache-id.js";
//#region src/server/app-ssr-router-instance.ts
function validateNavigationHref(href) {
	assertSafeNavigationUrl(href);
}
const ssrAppRouterInstance = {
	bfcacheId: "0",
	back() {},
	forward() {},
	refresh() {},
	push(href, _options) {
		validateNavigationHref(href);
	},
	replace(href, _options) {
		validateNavigationHref(href);
	},
	prefetch(href) {
		validateNavigationHref(href);
	}
};
if (process.env.__NEXT_GESTURE_TRANSITION) ssrAppRouterInstance.experimental_gesturePush = validateNavigationHref;
//#endregion
export { ssrAppRouterInstance };
