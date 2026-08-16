import { markAppPagePropsForUseCache } from "../shims/internal/app-page-props-cache-key.js";
import { isNextRouterError } from "../shims/navigation-errors.js";
import "../shims/navigation-server.js";
import { isPromiseLike } from "../utils/promise.js";
import { probeAppPageComponent, probeAppPageLayouts } from "./app-page-execution.js";
import { collectAppPageSearchParams } from "./app-page-head.js";
import { makeObservedAppPageSearchParamsThenable } from "./app-page-search-params-observation.js";
import { Fragment, isValidElement } from "react";
//#region src/server/app-page-probe.ts
const DEFAULT_SUBTREE_PROBE_MAX_DEPTH = 32;
const DEFAULT_SUBTREE_PROBE_MAX_NODES = 1e3;
const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const REACT_LAZY_TYPE = Symbol.for("react.lazy");
const REACT_MEMO_TYPE = Symbol.for("react.memo");
const REACT_CLIENT_REFERENCE_TYPE = Symbol.for("react.client.reference");
var AppPageSubtreeProbeLimitError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "AppPageSubtreeProbeLimitError";
	}
};
var AppPageSubtreeProbeUnsupportedIterableError = class extends Error {
	constructor() {
		super("App page layout subtree probe cannot safely inspect iterable children");
		this.name = "AppPageSubtreeProbeUnsupportedIterableError";
	}
};
function isIterable(value) {
	return Boolean(value && typeof value !== "string" && typeof value === "object" && Symbol.iterator in value && typeof value[Symbol.iterator] === "function");
}
function isProbeReactElement(value) {
	return isValidElement(value);
}
function isObjectLike(value) {
	return (typeof value === "object" || typeof value === "function") && value !== null;
}
function isUnknownFunction(value) {
	return typeof value === "function";
}
function isReactClientReference(value) {
	return isObjectLike(value) && Reflect.get(value, "$$typeof") === REACT_CLIENT_REFERENCE_TYPE;
}
function readReactMemoType(value) {
	if (!isObjectLike(value) || Reflect.get(value, "$$typeof") !== REACT_MEMO_TYPE) return null;
	return { innerType: Reflect.get(value, "type") };
}
function readReactLazyType(value) {
	if (!isObjectLike(value) || Reflect.get(value, "$$typeof") !== REACT_LAZY_TYPE) return null;
	const init = Reflect.get(value, "_init");
	if (!isUnknownFunction(init)) return null;
	return {
		init,
		payload: Reflect.get(value, "_payload")
	};
}
function readReactForwardRefRender(value) {
	if (!isObjectLike(value) || Reflect.get(value, "$$typeof") !== REACT_FORWARD_REF_TYPE) return null;
	const render = Reflect.get(value, "render");
	return isUnknownFunction(render) ? render : null;
}
async function resolveReactLazyType(lazyType) {
	try {
		return lazyType.init(lazyType.payload);
	} catch (error) {
		if (!isPromiseLike(error)) throw error;
		await error;
		return lazyType.init(lazyType.payload);
	}
}
/**
* Invokes server-component children returned by a layout probe so per-layout
* skip eligibility observes data dependencies created below the layout's
* immediate function body. The real RSC render remains authoritative; probe
* failures only make static-layout skip fall back to render-and-send.
*/
async function probeReactServerSubtree(node, options = {}) {
	const maxDepth = options.maxDepth ?? DEFAULT_SUBTREE_PROBE_MAX_DEPTH;
	const maxNodes = options.maxNodes ?? DEFAULT_SUBTREE_PROBE_MAX_NODES;
	let visitedNodes = 0;
	const enterProbeNode = (depth) => {
		if (depth > maxDepth) throw new AppPageSubtreeProbeLimitError("App page layout subtree probe exceeded max depth");
		visitedNodes += 1;
		if (visitedNodes > maxNodes) throw new AppPageSubtreeProbeLimitError("App page layout subtree probe exceeded max nodes");
	};
	const renderElementType = async (type, props, depth, wrapperDepth = 0) => {
		if (wrapperDepth > maxDepth) throw new AppPageSubtreeProbeLimitError("App page layout subtree probe exceeded max depth");
		if (isReactClientReference(type)) return false;
		if (isUnknownFunction(type)) {
			await visit(type(props), depth + 1);
			return true;
		}
		const memoType = readReactMemoType(type);
		if (memoType) return renderElementType(memoType.innerType, props, depth, wrapperDepth + 1);
		const lazyType = readReactLazyType(type);
		if (lazyType) return renderElementType(await resolveReactLazyType(lazyType), props, depth, wrapperDepth + 1);
		const forwardRefRender = readReactForwardRefRender(type);
		if (forwardRefRender) {
			await visit(forwardRefRender(props, null), depth + 1);
			return true;
		}
		return false;
	};
	const visit = async (value, depth) => {
		enterProbeNode(depth);
		if (value == null || typeof value === "boolean" || typeof value === "number") return;
		if (typeof value === "string" || typeof value === "bigint") return;
		if (isPromiseLike(value)) {
			await visit(await value, depth);
			return;
		}
		if (Array.isArray(value)) {
			for (const child of value) await visit(child, depth + 1);
			return;
		}
		if (isIterable(value) && !isProbeReactElement(value)) throw new AppPageSubtreeProbeUnsupportedIterableError();
		if (!isProbeReactElement(value)) return;
		if (value.type === Fragment || typeof value.type === "string") {
			await visit(value.props.children, depth + 1);
			return;
		}
		if (await renderElementType(value.type, value.props, depth)) return;
		await visit(value.props.children, depth + 1);
	};
	await visit(node, 0);
}
async function probeReactServerSubtreeForDynamicUsage(node) {
	try {
		await probeReactServerSubtree(node);
	} catch (error) {
		if (isNextRouterError(error)) return;
		throw error;
	}
}
/**
* Build a probePage() invocation for the App Router request lifecycle.
*
* The generated RSC entry calls this once per request after route matching to
* eagerly invoke the page component. Surfacing redirect()/notFound() throws
* here lets the probe lifecycle turn them into proper HTTP responses before
* RSC streaming begins (see `probeAppPageBeforeRender`).
*
* The helper exists to keep the generated entry thin (a single delegation
* call) and to make the search-params wiring directly unit-testable. A bug
* here previously slipped through because the entry hand-rolled the call and
* read a non-existent key off `collectAppPageSearchParams`'s return value
* (see https://github.com/cloudflare/vinext/issues/1235).
*
* Returns `null` when the route has no page component (eg. interception-only
* routes), matching the caller contract on `probePage`.
*/
function probeAppPage(options) {
	const { pageComponent, asyncRouteParams, searchParams } = options;
	if (typeof pageComponent !== "function") return null;
	const { pageSearchParams } = collectAppPageSearchParams(searchParams);
	const result = pageComponent(markAppPagePropsForUseCache({
		params: asyncRouteParams,
		searchParams: makeObservedAppPageSearchParamsThenable(pageSearchParams, { observeReactPromiseStatus: true })
	}));
	if (isPromiseLike(result)) return result.then(async (resolved) => {
		await probeReactServerSubtreeForDynamicUsage(resolved);
		return resolved;
	});
	if (isValidElement(result) || Array.isArray(result)) return probeReactServerSubtreeForDynamicUsage(result).then(() => result);
	return result;
}
/**
* Fan out the per-request page probes for the App Router dispatch lifecycle.
*
* A single request can render more than one page component: the matched page,
* each active parallel-route slot page, and an interception page when one
* matches. Each must be probed so searchParams access anywhere in the rendered
* tree bails the request out of the query-invariant static cache.
*
* Extracted out of the generated RSC entry so the fan-out is directly
* unit-testable and the entry stays codegen glue (see AGENTS.md "Generated
* Entry Modules Should Stay Thin"). Returns a list of resolved promises so the
* caller can `Promise.all` them.
*
* The fan-out is scoped to the page components that render for this request:
*
* - **Interception override:** when an interception matches it replaces the
*   page of the slot named by `intercept.slotKey` (the element builder sets
*   `overrides[slotKey].pageModule` to the interception page, which wins over
*   `slot.page` in `app-page-route-wiring.tsx`). We probe the interception page
*   in place of that slot's own page rather than probing both — probing the
*   overridden slot page would mark an otherwise-static request dynamic for a
*   component that never renders.
* - **Non-overridden slots:** `slot.page?.default` is exactly what renders.
*   `app-page-route-wiring.tsx` resolves a slot to `overrideOrPageComponent ??
*   defaultComponent`, so whenever a slot has a `page.tsx` that page renders.
*   When a slot has only a `default.tsx` (including the soft-nav case at
*   `app-page-route-wiring.tsx:741` that skips an already-mounted slot), there
*   is no `slot.page?.default`, so `probeAppPage` short-circuits to `null` and
*   probes nothing — a no-op, not an over-bail.
*
* Interception only fires for RSC navigations (`resolveAppPageInterceptState`
* returns `kind: "none"` when `!isRscRequest`, app-page-request.ts:324), so the
* interception handling here is gated on `isRscRequest`. For non-RSC (HTML)
* requests the matched route renders normally, so we probe every slot's own
* page and skip the interception probe entirely. The remaining "source-route"
* interception case (where a *different* route renders, app-page-request.ts:342)
* never reaches this probe: `dispatchAppPage` returns the intercepted response
* before calling `probePage`, so by the time this runs any matched interception
* is the current-route override case above.
*
* A `default.tsx` that itself awaits `searchParams` is not probed here, but the
* real render still observes that access and skips the query-invariant cache
* write (the same loading.tsx backstop), so this cannot under-bail.
*/
function buildAppPageProbes(options) {
	const { route, pageComponent, asyncRouteParams, searchParams, matchedParams } = options;
	const intercept = options.isRscRequest ? options.intercept : null;
	const probes = [probeAppPage({
		pageComponent,
		asyncRouteParams,
		searchParams
	})];
	const overriddenSlotKey = intercept?.slotKey ?? null;
	for (const [slotKey, slot] of Object.entries(route.slots ?? {})) {
		if (overriddenSlotKey !== null && slotKey === overriddenSlotKey) continue;
		probes.push(probeAppPage({
			pageComponent: slot?.page?.default,
			asyncRouteParams,
			searchParams
		}));
	}
	if (intercept) probes.push(probeAppPage({
		pageComponent: intercept.page?.default,
		asyncRouteParams: options.makeThenableParams(intercept.matchedParams ?? matchedParams),
		searchParams
	}));
	return probes.map((probe) => Promise.resolve(probe));
}
async function probeAppPageBeforeRender(options) {
	let layoutFlags = {};
	if (options.skipProbes) return {
		response: null,
		layoutFlags
	};
	if (options.layoutCount > 0) {
		const layoutProbeResult = await probeAppPageLayouts({
			layoutCount: options.layoutCount,
			async onLayoutError(layoutError, layoutIndex) {
				const specialError = options.resolveSpecialError(layoutError);
				if (!specialError) return null;
				return options.renderLayoutSpecialError(specialError, layoutIndex);
			},
			probeLayoutAt: options.probeLayoutAt,
			runWithSuppressedHookWarning(probe) {
				return options.runWithSuppressedHookWarning(probe);
			},
			classification: options.classification
		});
		layoutFlags = layoutProbeResult.layoutFlags;
		if (layoutProbeResult.response) return {
			response: layoutProbeResult.response,
			layoutFlags
		};
	}
	if (options.hasLoadingBoundary || options.probePageBeforeRender === false) return {
		response: null,
		layoutFlags
	};
	return {
		response: await probeAppPageComponent({
			awaitAsyncResult: true,
			async onError(pageError) {
				const specialError = options.resolveSpecialError(pageError);
				if (specialError) return options.renderPageSpecialError(specialError);
				return null;
			},
			probePage: options.probePage,
			runWithSuppressedHookWarning(probe) {
				return options.runWithSuppressedHookWarning(probe);
			}
		}),
		layoutFlags
	};
}
//#endregion
export { buildAppPageProbes, probeAppPage, probeAppPageBeforeRender, probeReactServerSubtree };
