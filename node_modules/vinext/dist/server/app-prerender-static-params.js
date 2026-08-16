import { isUnknownRecord } from "../utils/record.js";
import { pickRootParams, runWithRootParamsScope } from "../shims/root-params.js";
//#region src/server/app-prerender-static-params.ts
function isGenerateStaticParamsFunction(value) {
	return typeof value === "function";
}
function isLazyStaticParamsSource(value) {
	return typeof value === "object" && value !== null && "load" in value && typeof value.load === "function";
}
function isRootParams(value) {
	return isUnknownRecord(value);
}
/**
* Build a prerender `generateStaticParams` resolver for one route pattern.
*
* `sources` may mix eager functions (layout `generateStaticParams`, which stay
* eagerly imported) and lazy `{ load }` page sources (code-split page modules).
* Lazy sources are imported once on first invocation. The returned resolver:
*
*  - returns `null` when, after resolving every source, no `generateStaticParams`
*    export exists for the pattern — the sentinel the prerender driver uses to
*    skip the route (or error under `output: export`);
*  - otherwise composes all sources into the cartesian set of param objects.
*
* Returns `null` (no resolver) only when the pattern has zero sources at all.
*/
function createAppPrerenderStaticParamsResolver(sources, rootParamNames) {
	const usableSources = sources.filter((source) => isGenerateStaticParamsFunction(source) || isLazyStaticParamsSource(source));
	if (usableSources.length === 0) return null;
	const filterRootParams = (params) => pickRootParams(params, rootParamNames ?? []);
	let resolvedFns = null;
	let resolvePromise = null;
	const resolveFns = () => {
		if (resolvedFns) return Promise.resolve(resolvedFns);
		if (!resolvePromise) resolvePromise = (async () => {
			resolvedFns = (await Promise.all(usableSources.map(async (source) => {
				if (isGenerateStaticParamsFunction(source)) return source;
				const mod = await source.load();
				const fn = mod && typeof mod === "object" ? mod.generateStaticParams : void 0;
				return isGenerateStaticParamsFunction(fn) ? fn : null;
			}))).filter((fn) => fn !== null);
			return resolvedFns;
		})();
		return resolvePromise;
	};
	return async (input) => {
		const fns = await resolveFns();
		if (fns.length === 0) return null;
		if (fns.length === 1) {
			const single = fns[0];
			return runWithRootParamsScope(filterRootParams(input.params), async () => {
				const result = await single(input);
				if (!Array.isArray(result)) return [];
				for (const item of result) if (!isRootParams(item)) return [];
				return result;
			});
		}
		let paramSets = [input.params];
		for (const generateStaticParams of fns) {
			const nextParamSets = [];
			for (const parentParams of paramSets) {
				const result = await runWithRootParamsScope(filterRootParams(parentParams), async () => generateStaticParams({ params: parentParams }));
				if (!Array.isArray(result)) return [];
				for (const item of result) {
					if (!isRootParams(item)) return [];
					nextParamSets.push({
						...parentParams,
						...item
					});
				}
			}
			paramSets = nextParamSets;
		}
		return paramSets;
	};
}
async function callAppPrerenderStaticParams(options) {
	return runWithRootParamsScope(pickRootParams(options.params, options.rootParamNamesByPattern[options.pattern]), () => options.fn({ params: options.params }));
}
//#endregion
export { callAppPrerenderStaticParams, createAppPrerenderStaticParamsResolver };
