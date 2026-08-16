//#region src/server/app-client-reference-preloader.ts
const resolvedPreload = Promise.resolve();
function createClientReferencePreloader(options) {
	let allReferencesPreloaded = false;
	let allReferencesPreloadPromise = null;
	const preloadedReferences = /* @__PURE__ */ new Set();
	const referencePreloadPromises = /* @__PURE__ */ new Map();
	function preloadReference(id, clientRequire) {
		if (preloadedReferences.has(id)) return resolvedPreload;
		const existing = referencePreloadPromises.get(id);
		if (existing) return existing;
		const preloadPromise = clientRequire(id).catch((error) => {
			options.onPreloadError?.(id, error);
		}).then(() => {
			preloadedReferences.add(id);
		}).finally(() => {
			referencePreloadPromises.delete(id);
		});
		referencePreloadPromises.set(id, preloadPromise);
		return preloadPromise;
	}
	function preloadReferenceSet(referenceIds, refs, clientRequire) {
		const pending = [];
		for (const id of referenceIds) if (Object.hasOwn(refs, id)) pending.push(preloadReference(id, clientRequire));
		if (pending.length === 0) return resolvedPreload;
		return Promise.all(pending).then(() => {});
	}
	return { preload(referenceIds) {
		const refs = options.getReferences();
		const clientRequire = options.getClientRequire();
		if (!refs || !clientRequire) return resolvedPreload;
		if (referenceIds) return preloadReferenceSet(referenceIds, refs, clientRequire);
		if (allReferencesPreloaded) return resolvedPreload;
		if (allReferencesPreloadPromise) return allReferencesPreloadPromise;
		allReferencesPreloadPromise = preloadReferenceSet(Object.keys(refs), refs, clientRequire).then(() => {
			allReferencesPreloaded = true;
		}).finally(() => {
			allReferencesPreloadPromise = null;
		});
		return allReferencesPreloadPromise;
	} };
}
//#endregion
export { createClientReferencePreloader };
