//#region src/server/app-hydration-cache-publication.ts
function createHydrationCachePublication() {
	let state = "pending";
	let pendingPublication = null;
	let invalidatePublishedCandidate = null;
	const publishPendingCandidate = () => {
		if (state !== "committed" && state !== "complete" || pendingPublication === null) return;
		const publishCandidate = pendingPublication;
		pendingPublication = null;
		invalidatePublishedCandidate = publishCandidate();
	};
	return {
		commit() {
			if (state !== "pending") return;
			state = "committed";
			publishPendingCandidate();
		},
		complete() {
			if (state === "committed") state = "complete";
		},
		fail() {
			if (state === "complete" || state === "invalidated") return;
			state = "invalidated";
			pendingPublication = null;
			invalidatePublishedCandidate?.();
			invalidatePublishedCandidate = null;
		},
		invalidate() {
			if (state === "invalidated") return;
			state = "invalidated";
			pendingPublication = null;
			invalidatePublishedCandidate?.();
			invalidatePublishedCandidate = null;
		},
		publish(publishCandidate) {
			if (state === "invalidated") return;
			pendingPublication = publishCandidate;
			publishPendingCandidate();
		}
	};
}
//#endregion
export { createHydrationCachePublication };
