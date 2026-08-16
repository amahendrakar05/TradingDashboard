import { markDynamicUsage, markRenderRequestApiUsage, throwIfInsideCacheScope, throwIfStaticGenerationAccessError } from "../shims/headers.js";
import { makeThenableParams } from "../shims/thenable-params.js";
//#region src/server/app-page-search-params-observation.ts
function markAppPageSearchParamsAccess(markDynamic) {
	throwIfStaticGenerationAccessError();
	throwIfInsideCacheScope("searchParams");
	if (markDynamic) markDynamicUsage();
	markRenderRequestApiUsage("searchParams");
}
function createAppPageSearchParamsObserver(options = {}) {
	return { observeParamAccess() {
		markAppPageSearchParamsAccess(options.markDynamic !== false);
	} };
}
function makeObservedAppPageSearchParamsThenable(pageSearchParams, options = {}) {
	const observer = createAppPageSearchParamsObserver(options);
	if (options.observeReactPromiseStatus === true) return makeThenableParams(pageSearchParams, {
		...observer,
		observeReactPromiseStatus: true
	});
	return makeThenableParams(pageSearchParams, observer);
}
//#endregion
export { createAppPageSearchParamsObserver, makeObservedAppPageSearchParamsThenable };
