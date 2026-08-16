import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
//#region src/shims/root-params.ts
function createRootParamsUsageError(message) {
	return new Error(message);
}
const _FALLBACK_KEY = Symbol.for("vinext.rootParams.fallback");
const _g = globalThis;
const _als = getOrCreateAls("vinext.rootParams.als");
const _usageAls = getOrCreateAls("vinext.rootParams.usage.als");
const _fallbackState = _g[_FALLBACK_KEY] ??= { rootParams: null };
function getState() {
	if (isInsideUnifiedScope()) return getRequestContext();
	return _als.getStore() ?? _fallbackState;
}
function pickRootParams(params, rootParamNames) {
	const picked = {};
	for (const name of rootParamNames ?? []) picked[name] = params[name];
	return picked;
}
function setRootParams(params) {
	getState().rootParams = params;
}
function getRootParam(name) {
	const usage = _usageAls.getStore();
	if (usage?.kind === "server-action" && usage.phase === "active") throw createRootParamsUsageError(`\`import('next/root-params').${name}()\` was used inside a Server Action. This is not supported. Functions from 'next/root-params' can only be called in the context of a route.`);
	if (usage?.kind === "route-handler" && usage.phase === "active") throw createRootParamsUsageError(`Route ${usage.routePattern} used \`import('next/root-params').${name}()\` inside a Route Handler. Support for this API in Route Handlers is planned for a future version of Next.js.`);
	return Promise.resolve(getState().rootParams?.[name]);
}
function runWithRootParamsUsage(usage, fn, controller) {
	const state = {
		...usage,
		phase: "active"
	};
	if (controller) controller.transitionToRender = () => {
		if (usage.kind === "server-action") state.phase = "render";
	};
	return _usageAls.run(state, fn);
}
function createRootParamsUsageController() {
	return { transitionToRender() {} };
}
function runWithRootParamsScope(params, fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((ctx) => {
		ctx.rootParams = params;
	}, fn);
	else return _als.run({ rootParams: params }, fn);
}
//#endregion
export { createRootParamsUsageController, getRootParam, pickRootParams, runWithRootParamsScope, runWithRootParamsUsage, setRootParams };
