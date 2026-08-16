//#region src/client/dev-error-overlay-store.ts
const MAX_DEV_OVERLAY_ERRORS = 50;
let snapshot = {
	errors: [],
	index: 0,
	minimized: false
};
const listeners = /* @__PURE__ */ new Set();
let nextErrorId = 1;
function emit() {
	for (const fn of listeners) fn();
}
function subscribeOverlay(fn) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}
function getOverlaySnapshot() {
	return snapshot;
}
function reportToOverlay(error) {
	const id = nextErrorId++;
	const next = [...snapshot.errors, {
		...error,
		id
	}];
	const dropped = next.length > MAX_DEV_OVERLAY_ERRORS ? next.length - MAX_DEV_OVERLAY_ERRORS : 0;
	const errors = dropped > 0 ? next.slice(dropped) : next;
	snapshot = {
		errors,
		index: errors.length - 1,
		minimized: false
	};
	emit();
	return id;
}
function updateOverlayErrorStack(id, stack, ignoredStackFrames, codeFrame, projectRoot) {
	if (!snapshot.errors.some((error) => error.id === id)) return;
	snapshot = {
		...snapshot,
		errors: snapshot.errors.map((error) => error.id === id ? {
			...error,
			stack,
			ignoredStackFrames,
			codeFrame,
			projectRoot
		} : error)
	};
	emit();
}
function dismissOverlay() {
	if (snapshot.errors.length === 0 && snapshot.index === 0 && !snapshot.minimized) return;
	snapshot = {
		errors: [],
		index: 0,
		minimized: false
	};
	emit();
}
function setOverlayIndex(index) {
	if (index < 0 || index >= snapshot.errors.length) return;
	snapshot = {
		...snapshot,
		index
	};
	emit();
}
function minimizeOverlay() {
	if (snapshot.minimized) return;
	snapshot = {
		...snapshot,
		minimized: true
	};
	emit();
}
function expandOverlay() {
	if (!snapshot.minimized) return;
	snapshot = {
		...snapshot,
		minimized: false
	};
	emit();
}
//#endregion
export { dismissOverlay, expandOverlay, getOverlaySnapshot, minimizeOverlay, reportToOverlay, setOverlayIndex, subscribeOverlay, updateOverlayErrorStack };
