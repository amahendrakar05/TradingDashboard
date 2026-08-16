import { isInsideUnifiedScope, runWithUnifiedStateMutation } from "../shims/unified-request-context.js";
import { peekDynamicUsage, peekRenderRequestApiUsage } from "../shims/headers.js";
import { _peekRequestScopedCacheLife, _peekUnstableCacheObservations } from "../shims/cache-request-state.js";
import { getCollectedFetchTags, peekCacheableFetchObservations, peekDynamicFetchObservations } from "../shims/fetch-cache.js";
import { isPromiseLike } from "../utils/promise.js";
//#region src/server/app-layout-param-observation.ts
const STATIC_LAYOUT_OBSERVATION_SKIP_RULES = [
	["SKIP_LAYOUT_PARAMS_OBSERVATION_INCOMPLETE", (observation) => observation.completeness !== "complete"],
	["SKIP_LAYOUT_PARAMS_PRESENT", (observation) => observation.paramScopeKeys.length > 0],
	["SKIP_LAYOUT_PARAMS_OBSERVED", (observation) => observation.observed],
	["SKIP_LAYOUT_DYNAMIC_USAGE_OBSERVED", (observation) => observation.dynamicUsageObserved],
	["SKIP_LAYOUT_REQUEST_API_OBSERVED", (observation) => observation.requestApis.length > 0],
	["SKIP_LAYOUT_REVALIDATE_PRESENT", (observation) => observation.finiteRevalidateSeconds !== null],
	["SKIP_LAYOUT_CACHE_LIFE_OBSERVED", (observation) => observation.cacheLifeObserved],
	["SKIP_LAYOUT_UNSTABLE_CACHE_OBSERVED", (observation) => observation.unstableCaches.length > 0],
	["SKIP_LAYOUT_CACHE_TAGS_OBSERVED", (observation) => observation.cacheTags.length > 0],
	["SKIP_LAYOUT_CACHEABLE_FETCHES_OBSERVED", (observation) => observation.cacheableFetchCount > 0],
	["SKIP_LAYOUT_DYNAMIC_FETCHES_OBSERVED", (observation) => observation.dynamicFetchCount > 0]
];
function createStaticLayoutObservationTraceFields(observation) {
	return {
		cacheLifeObserved: observation.cacheLifeObserved,
		cacheTags: observation.cacheTags,
		cacheableFetchCount: observation.cacheableFetchCount,
		dynamicFetchCount: observation.dynamicFetchCount,
		dynamicUsageObserved: observation.dynamicUsageObserved,
		finiteRevalidateSeconds: observation.finiteRevalidateSeconds,
		observedParamKeys: observation.keys,
		paramScopeKeys: observation.paramScopeKeys,
		requestApis: observation.requestApis,
		unstableCacheCount: observation.unstableCaches.length,
		unstableCacheKeyHashes: observation.unstableCaches.map((cache) => cache.keyHash),
		unstableCacheRevalidates: observation.unstableCaches.map((cache) => String(cache.revalidate)),
		unstableCacheTagCounts: observation.unstableCaches.map((cache) => String(cache.tagCount)),
		unstableCacheTagHashes: observation.unstableCaches.map((cache) => cache.tagHash ?? "none")
	};
}
function getStaticLayoutObservationSkipRejection(observation) {
	for (const [code, matches] of STATIC_LAYOUT_OBSERVATION_SKIP_RULES) if (matches(observation)) return {
		code,
		fields: createStaticLayoutObservationTraceFields(observation)
	};
	return null;
}
function isAppLayoutObservationUnsafeForStaticReuse(observation) {
	return getStaticLayoutObservationSkipRejection(observation) !== null;
}
function createAppLayoutParamAccessTracker() {
	const observations = /* @__PURE__ */ new Map();
	const ensureObservation = (layoutId) => {
		const existing = observations.get(layoutId);
		if (existing) return existing;
		const created = {
			cacheLifeObserved: false,
			cacheTags: /* @__PURE__ */ new Set(),
			cacheableFetches: /* @__PURE__ */ new Set(),
			dynamicFetches: /* @__PURE__ */ new Set(),
			dynamicUsageObserved: false,
			finiteRevalidateSeconds: null,
			keys: /* @__PURE__ */ new Set(),
			observed: false,
			paramScopeKeys: /* @__PURE__ */ new Set(),
			probeComplete: false,
			requestApis: /* @__PURE__ */ new Set(),
			unstableCaches: /* @__PURE__ */ new Map()
		};
		observations.set(layoutId, created);
		return created;
	};
	const markObserved = (layoutId, keys) => {
		const observation = ensureObservation(layoutId);
		observation.observed = true;
		for (const key of keys) observation.keys.add(key);
	};
	const markProbeComplete = (layoutId) => {
		ensureObservation(layoutId).probeComplete = true;
	};
	const runWithIsolatedProbeDependencies = (probe) => {
		if (!isInsideUnifiedScope()) return probe();
		return runWithUnifiedStateMutation((ctx) => {
			ctx.cacheableFetchUrls = /* @__PURE__ */ new Set();
			ctx.currentRequestTags = [];
			ctx.currentFetchSoftTags = [];
			ctx.dynamicFetchUrls = /* @__PURE__ */ new Set();
			ctx.dynamicUsageDetected = false;
			ctx.renderRequestApiUsage = /* @__PURE__ */ new Set();
			ctx.requestScopedCacheLife = null;
			ctx.unstableCacheObservations = /* @__PURE__ */ new Map();
		}, probe);
	};
	const recordProbeDependencies = (layoutId) => {
		const observation = ensureObservation(layoutId);
		if (peekDynamicUsage()) observation.dynamicUsageObserved = true;
		if (_peekRequestScopedCacheLife() !== null) observation.cacheLifeObserved = true;
		for (const tag of getCollectedFetchTags()) observation.cacheTags.add(tag);
		for (const url of peekCacheableFetchObservations()) observation.cacheableFetches.add(url);
		for (const url of peekDynamicFetchObservations()) observation.dynamicFetches.add(url);
		for (const requestApi of peekRenderRequestApiUsage()) observation.requestApis.add(requestApi);
		for (const unstableCache of _peekUnstableCacheObservations()) observation.unstableCaches.set(unstableCache.keyHash, unstableCache);
	};
	return {
		createThenableParamsObserver(layoutId) {
			return { observeParamAccess(keys) {
				markObserved(layoutId, keys);
			} };
		},
		getLayoutObservation(layoutId) {
			const observation = observations.get(layoutId);
			if (!observation) return {
				cacheLifeObserved: false,
				cacheTags: [],
				cacheableFetchCount: 0,
				completeness: "unknown",
				dynamicFetchCount: 0,
				dynamicUsageObserved: false,
				finiteRevalidateSeconds: null,
				keys: [],
				observed: false,
				paramScopeKeys: [],
				requestApis: [],
				unstableCaches: []
			};
			return {
				cacheLifeObserved: observation.cacheLifeObserved,
				cacheTags: [...observation.cacheTags].sort(),
				cacheableFetchCount: observation.cacheableFetches.size,
				completeness: observation.probeComplete ? "complete" : "unknown",
				dynamicFetchCount: observation.dynamicFetches.size,
				dynamicUsageObserved: observation.dynamicUsageObserved,
				finiteRevalidateSeconds: observation.finiteRevalidateSeconds,
				keys: [...observation.keys].sort(),
				observed: observation.observed,
				paramScopeKeys: [...observation.paramScopeKeys].sort(),
				requestApis: [...observation.requestApis].sort(),
				unstableCaches: [...observation.unstableCaches.values()].sort((a, b) => a.keyHash.localeCompare(b.keyHash))
			};
		},
		recordLayoutFiniteRevalidate(layoutId, revalidateSeconds) {
			if (!Number.isFinite(revalidateSeconds) || revalidateSeconds <= 0) return;
			const observation = ensureObservation(layoutId);
			observation.finiteRevalidateSeconds = observation.finiteRevalidateSeconds === null ? revalidateSeconds : Math.min(observation.finiteRevalidateSeconds, revalidateSeconds);
		},
		recordLayoutParamScope(layoutId, paramScopeKeys) {
			const observation = ensureObservation(layoutId);
			for (const key of paramScopeKeys) observation.paramScopeKeys.add(key);
		},
		runLayoutProbe(layoutId, probe) {
			return runWithIsolatedProbeDependencies(() => {
				const result = probe();
				if (!isPromiseLike(result)) {
					recordProbeDependencies(layoutId);
					markProbeComplete(layoutId);
					return result;
				}
				return Promise.resolve(result).then((resolved) => {
					recordProbeDependencies(layoutId);
					markProbeComplete(layoutId);
					return resolved;
				}, (error) => {
					recordProbeDependencies(layoutId);
					throw error;
				});
			});
		}
	};
}
//#endregion
export { createAppLayoutParamAccessTracker, getStaticLayoutObservationSkipRejection, isAppLayoutObservationUnsafeForStaticReuse };
