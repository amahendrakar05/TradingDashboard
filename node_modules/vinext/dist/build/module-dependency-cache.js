//#region src/build/module-dependency-cache.ts
function createModuleDependencyCache(collect) {
	const cache = /* @__PURE__ */ new Map();
	return function getModuleDependencies(moduleId) {
		const cached = cache.get(moduleId);
		if (cached) return cached;
		const pending = collect(moduleId);
		cache.set(moduleId, pending);
		return pending;
	};
}
//#endregion
export { createModuleDependencyCache };
