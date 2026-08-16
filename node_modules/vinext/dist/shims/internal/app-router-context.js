import * as React$1 from "react";
//#region src/shims/internal/app-router-context.ts
/**
* Shim for next/dist/shared/lib/app-router-context.shared-runtime
*
* Used by: @clerk/nextjs, next-intl, next-nprogress-bar, nextjs-toploader,
* next-view-transitions. Mostly type-only imports in published .d.ts files.
*
* We export the types and minimal context objects so these libraries resolve.
*/
const APP_ROUTER_CONTEXT_KEY = Symbol.for("vinext.appRouterContext");
const GLOBAL_LAYOUT_ROUTER_CONTEXT_KEY = Symbol.for("vinext.globalLayoutRouterContext");
const LAYOUT_ROUTER_CONTEXT_KEY = Symbol.for("vinext.layoutRouterContext");
const MISSING_SLOT_CONTEXT_KEY = Symbol.for("vinext.missingSlotContext");
const TEMPLATE_CONTEXT_KEY = Symbol.for("vinext.templateContext");
function getOrCreateContext(key, defaultValue) {
	if (typeof React$1.createContext !== "function") return null;
	const globalState = globalThis;
	if (!globalState[key]) globalState[key] = React$1.createContext(defaultValue);
	return globalState[key] ?? null;
}
const AppRouterContext = getOrCreateContext(APP_ROUTER_CONTEXT_KEY, null);
const GlobalLayoutRouterContext = getOrCreateContext(GLOBAL_LAYOUT_ROUTER_CONTEXT_KEY, null);
const LayoutRouterContext = getOrCreateContext(LAYOUT_ROUTER_CONTEXT_KEY, null);
const MissingSlotContext = getOrCreateContext(MISSING_SLOT_CONTEXT_KEY, /* @__PURE__ */ new Set());
const TemplateContext = getOrCreateContext(TEMPLATE_CONTEXT_KEY, null);
//#endregion
export { AppRouterContext, GlobalLayoutRouterContext, LayoutRouterContext, MissingSlotContext, TemplateContext };
