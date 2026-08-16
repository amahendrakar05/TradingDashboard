"use client";
//#region src/shims/internal/app-prefetch-fetch-queue.ts
const APP_PREFETCH_FETCH_SLOT_RELEASE_KEY = Symbol.for("vinext.appPrefetchFetchSlotRelease");
const MAX_DEFAULT_APP_PREFETCH_REQUESTS = 4;
const defaultAppPrefetchQueue = [];
let activeDefaultAppPrefetchRequests = 0;
let defaultAppPrefetchDrainScheduled = false;
function drainDefaultAppPrefetchQueue() {
	defaultAppPrefetchDrainScheduled = false;
	while (activeDefaultAppPrefetchRequests < MAX_DEFAULT_APP_PREFETCH_REQUESTS) {
		const run = defaultAppPrefetchQueue.shift();
		if (!run) return;
		activeDefaultAppPrefetchRequests += 1;
		run();
	}
}
function scheduleDefaultAppPrefetchDrain() {
	if (defaultAppPrefetchDrainScheduled) return;
	defaultAppPrefetchDrainScheduled = true;
	queueMicrotask(drainDefaultAppPrefetchQueue);
}
function releaseAppPrefetchFetchSlot(response) {
	const release = response[APP_PREFETCH_FETCH_SLOT_RELEASE_KEY];
	if (release === void 0) return;
	response[APP_PREFETCH_FETCH_SLOT_RELEASE_KEY] = void 0;
	release();
}
/**
* Low-priority App Router prefetches share a small request queue. The consumer
* must either snapshot the returned Response with snapshotRscResponse() or call
* releaseAppPrefetchFetchSlot() when it drops the response without consuming it.
*/
function scheduleAppPrefetchFetch(fetcher, priority) {
	if (priority === "high") return fetcher();
	return new Promise((resolve, reject) => {
		defaultAppPrefetchQueue.push(() => {
			let didRelease = false;
			const release = () => {
				if (didRelease) return;
				didRelease = true;
				activeDefaultAppPrefetchRequests -= 1;
				drainDefaultAppPrefetchQueue();
			};
			try {
				fetcher().then((response) => {
					response[APP_PREFETCH_FETCH_SLOT_RELEASE_KEY] = release;
					resolve(response);
				}, (error) => {
					release();
					reject(error);
				});
			} catch (error) {
				release();
				reject(error);
			}
		});
		scheduleDefaultAppPrefetchDrain();
	});
}
//#endregion
export { releaseAppPrefetchFetchSlot, scheduleAppPrefetchFetch };
