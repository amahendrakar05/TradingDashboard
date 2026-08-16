import { getOrCreateAls } from "./internal/als-registry.js";
import { makeHangingPromise } from "./internal/make-hanging-promise.js";
//#region src/shims/ppr-fallback-shell.ts
const pprFallbackShellAls = getOrCreateAls("vinext.pprFallbackShell.als");
const pprFallbackShellCacheTaskStackAls = getOrCreateAls("vinext.pprFallbackShell.cacheTaskStack.als");
function noop() {}
function scheduleAfterTask(callback) {
	let firstTimer = setTimeout(() => {
		firstTimer = null;
		secondTimer = setTimeout(() => {
			secondTimer = null;
			callback();
		}, 0);
	}, 0);
	let secondTimer = null;
	return () => {
		if (firstTimer !== null) {
			clearTimeout(firstTimer);
			firstTimer = null;
		}
		if (secondTimer !== null) {
			clearTimeout(secondTimer);
			secondTimer = null;
		}
	};
}
function resolveCacheReadyIfSettled(state) {
	if (state.pendingCacheTasks !== 0) return;
	const resolvers = state.cacheReadyResolvers.splice(0);
	for (const resolve of resolvers) resolve();
}
function cancelPendingCacheReady(state) {
	if (state.pendingCacheReadyCleanup === null) return;
	state.pendingCacheReadyCleanup();
	state.pendingCacheReadyCleanup = null;
}
function scheduleCacheReadyIfSettled(state) {
	if (state.pendingCacheTasks !== 0 || state.pendingCacheReadyCleanup !== null) return;
	state.pendingCacheReadyCleanup = scheduleAfterTask(() => {
		state.pendingCacheReadyCleanup = null;
		resolveCacheReadyIfSettled(state);
		if (state.phase === "final") scheduleAbortIfReady(state);
	});
}
function scheduleAbortIfReady(state) {
	if (state.phase !== "final" || !state.isFinalRenderStarted || !state.hasDynamicBoundary || state.pendingCacheTasks > 0 || state.pendingCacheReadyCleanup !== null || state.isAbortScheduled) return;
	state.isAbortScheduled = true;
	state.pendingAbortCleanup = scheduleAfterTask(() => {
		state.pendingAbortCleanup = null;
		state.isAbortScheduled = false;
		if (state.phase === "final" && state.hasDynamicBoundary && state.pendingCacheTasks === 0 && state.pendingCacheReadyCleanup === null && !state.reactAbortController.signal.aborted) {
			state.reactAbortController.abort();
			state.abortController.abort();
		}
	});
}
function completeCacheTask(state, task) {
	if (!task.isPending) return;
	task.isPending = false;
	if (task.epoch !== state.cacheEpoch) return;
	state.pendingCacheTasks--;
	scheduleCacheReadyIfSettled(state);
}
function ignoreCacheTask(state, task) {
	if (!task.isPending || task.isIgnored) return;
	task.isIgnored = true;
	completeCacheTask(state, task);
}
function createPprFallbackShellState(options) {
	const abortController = new AbortController();
	return {
		abortController,
		reactAbortController: abortController,
		cacheEpoch: 0,
		cacheReadyResolvers: [],
		fallbackParamNames: new Set(options.fallbackParamNames),
		hasDynamicBoundary: false,
		isFinalRenderStarted: false,
		isAbortScheduled: false,
		pendingAbortCleanup: null,
		pendingCacheReadyCleanup: null,
		pendingCacheTasks: 0,
		phase: "warmup",
		routePattern: options.routePattern
	};
}
function runWithPprFallbackShellState(state, fn) {
	return pprFallbackShellAls.run(state, fn);
}
function getPprFallbackShellState() {
	return pprFallbackShellAls.getStore() ?? null;
}
function trackPprFallbackShellCacheTask(fn, cacheVariant) {
	const state = getPprFallbackShellState();
	if (state === null || cacheVariant === "private") return fn();
	cancelPendingCacheReady(state);
	state.pendingCacheTasks++;
	const task = {
		epoch: state.cacheEpoch,
		isIgnored: false,
		isPending: true
	};
	const parentStack = pprFallbackShellCacheTaskStackAls.getStore() ?? [];
	let promise;
	try {
		promise = pprFallbackShellCacheTaskStackAls.run([...parentStack, task], fn);
	} catch (error) {
		completeCacheTask(state, task);
		return Promise.reject(error);
	}
	return promise.finally(() => {
		if (!task.isIgnored) completeCacheTask(state, task);
	});
}
function createPprFallbackShellSuspensePromiseForState(state, expression) {
	markPprFallbackShellDynamicBoundaryForState(state);
	if (state.phase === "final") scheduleAbortIfReady(state);
	const promise = makeHangingPromise(state.abortController.signal, state.routePattern, expression);
	promise.catch(noop);
	return promise;
}
function markPprFallbackShellDynamicBoundaryForState(state) {
	state.hasDynamicBoundary = true;
	for (const task of pprFallbackShellCacheTaskStackAls.getStore() ?? []) ignoreCacheTask(state, task);
	scheduleCacheReadyIfSettled(state);
}
function markPprFallbackShellDynamicBoundary() {
	const state = getPprFallbackShellState();
	if (state === null || state.fallbackParamNames.size === 0) return;
	markPprFallbackShellDynamicBoundaryForState(state);
}
function createPprFallbackShellSuspensePromise(expression) {
	const state = getPprFallbackShellState();
	if (state === null) return null;
	return createPprFallbackShellSuspensePromiseForState(state, expression);
}
function waitForPprFallbackShellCacheReady(state) {
	if (state.phase !== "warmup") return Promise.resolve();
	return new Promise((resolve) => {
		state.cacheReadyResolvers.push(resolve);
		scheduleCacheReadyIfSettled(state);
	});
}
function preparePprFallbackShellFinalRender(state) {
	cancelPendingCacheReady(state);
	if (state.pendingAbortCleanup !== null) {
		state.pendingAbortCleanup();
		state.pendingAbortCleanup = null;
	}
	state.abortController = new AbortController();
	state.reactAbortController = new AbortController();
	state.cacheEpoch++;
	state.cacheReadyResolvers.length = 0;
	state.hasDynamicBoundary = false;
	state.isFinalRenderStarted = false;
	state.isAbortScheduled = false;
	state.pendingCacheTasks = 0;
	state.phase = "final";
}
function beginPprFallbackShellFinalRender(state) {
	if (state.phase !== "final") return;
	state.isFinalRenderStarted = true;
	scheduleAbortIfReady(state);
}
function isPprFallbackShellAbortError(error) {
	if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") return true;
	return error instanceof Error && error.name === "HangingPromiseRejectionError";
}
//#endregion
export { beginPprFallbackShellFinalRender, createPprFallbackShellState, createPprFallbackShellSuspensePromise, createPprFallbackShellSuspensePromiseForState, getPprFallbackShellState, isPprFallbackShellAbortError, markPprFallbackShellDynamicBoundary, preparePprFallbackShellFinalRender, runWithPprFallbackShellState, trackPprFallbackShellCacheTask, waitForPprFallbackShellCacheReady };
