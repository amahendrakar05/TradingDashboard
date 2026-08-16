import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import { isNonNegativeSafeInteger } from "../utils/number.js";
//#region src/server/app-history-state.ts
const VINEXT_PREVIOUS_NEXT_URL_HISTORY_STATE_KEY = "__vinext_previousNextUrl";
const VINEXT_HISTORY_INDEX_HISTORY_STATE_KEY = "__vinext_historyIndex";
const VINEXT_BFCACHE_IDS_HISTORY_STATE_KEY = "__vinext_bfcacheIds";
const VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY = "__vinext_bfcacheVersion";
var HistoryStateSnapshotCache = class {
	#maxEntries;
	#snapshots = /* @__PURE__ */ new Map();
	constructor(options) {
		this.#maxEntries = options.maxEntries;
	}
	clear() {
		this.#snapshots.clear();
	}
	remember(options) {
		if (options.historyIndex === null) return;
		this.#snapshots.delete(options.historyIndex);
		this.#snapshots.set(options.historyIndex, {
			bfcacheVersion: options.bfcacheVersion,
			state: options.state
		});
		if (this.#snapshots.size <= this.#maxEntries) return;
		const oldestIndex = this.#snapshots.keys().next().value;
		if (typeof oldestIndex === "number") this.#snapshots.delete(oldestIndex);
	}
	resolveRestore(options) {
		const targetHistoryIndex = readHistoryStateTraversalIndex(options.historyState);
		if (targetHistoryIndex === null) return {
			kind: "skip",
			reason: "missing-history-index",
			targetHistoryIndex
		};
		const snapshot = this.#snapshots.get(targetHistoryIndex);
		if (!snapshot) return {
			kind: "skip",
			reason: "missing-snapshot",
			targetHistoryIndex
		};
		if (options.guarded) return {
			kind: "skip",
			reason: "guarded",
			targetHistoryIndex
		};
		if (snapshot.bfcacheVersion !== options.currentBfcacheVersion) {
			this.#snapshots.delete(targetHistoryIndex);
			return {
				kind: "skip",
				reason: "stale-bfcache-version",
				targetHistoryIndex
			};
		}
		return {
			kind: "restore",
			state: snapshot.state,
			targetHistoryIndex
		};
	}
};
var RestorableClientStateController = class {
	#currentBfcacheVersion;
	#pendingCacheInvalidationGuards = 0;
	#snapshots;
	constructor(options) {
		const initialHistoryBfcacheVersion = readHistoryStateBfcacheVersion(options.initialHistoryState);
		this.#currentBfcacheVersion = initialHistoryBfcacheVersion === null ? 0 : initialHistoryBfcacheVersion + 1;
		this.#snapshots = new HistoryStateSnapshotCache({ maxEntries: options.maxHistoryStateSnapshots });
	}
	get currentBfcacheVersion() {
		return this.#currentBfcacheVersion;
	}
	beginCacheInvalidationGuard() {
		this.#pendingCacheInvalidationGuards += 1;
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.#pendingCacheInvalidationGuards = Math.max(0, this.#pendingCacheInvalidationGuards - 1);
		};
	}
	isCacheInvalidationGuarded() {
		return this.#pendingCacheInvalidationGuards > 0;
	}
	isCurrentBfcacheVersion(historyState) {
		return isHistoryStateBfcacheVersionCurrent(historyState, this.#currentBfcacheVersion);
	}
	readCurrentBfcacheVersionHistoryIds(historyState) {
		if (this.isCacheInvalidationGuarded()) return null;
		const ids = readHistoryStateBfcacheIds(historyState);
		if (ids === null) return null;
		return this.isCurrentBfcacheVersion(historyState) ? ids : null;
	}
	#invalidateBfcacheIds() {
		this.#currentBfcacheVersion += 1;
	}
	invalidateClientState() {
		this.#snapshots.clear();
		this.#invalidateBfcacheIds();
	}
	rememberHistoryStateSnapshot(options) {
		this.#snapshots.remember({
			bfcacheVersion: this.#currentBfcacheVersion,
			historyIndex: options.historyIndex,
			state: options.state
		});
	}
	resolveHistoryStateSnapshotRestore(historyState) {
		return this.#snapshots.resolveRestore({
			currentBfcacheVersion: this.#currentBfcacheVersion,
			guarded: this.isCacheInvalidationGuarded(),
			historyState
		});
	}
};
function cloneHistoryState(state) {
	if (!state || typeof state !== "object") return {};
	const nextState = {};
	for (const [key, value] of Object.entries(state)) nextState[key] = value;
	return nextState;
}
function readHistoryStateRecord(state) {
	if (!state || typeof state !== "object" || Array.isArray(state)) return null;
	return state;
}
function createHistoryStateWithPreviousNextUrl(state, previousNextUrl) {
	return createHistoryStateWithNavigationMetadata(state, { previousNextUrl });
}
function createHistoryStateWithNavigationMetadata(state, metadata) {
	const nextState = cloneHistoryState(state);
	const bfcacheIdsWereCleared = metadata.bfcacheIds !== void 0 && (metadata.bfcacheIds === null || Object.keys(metadata.bfcacheIds).length === 0);
	if (metadata.previousNextUrl === null) delete nextState[VINEXT_PREVIOUS_NEXT_URL_HISTORY_STATE_KEY];
	else nextState[VINEXT_PREVIOUS_NEXT_URL_HISTORY_STATE_KEY] = metadata.previousNextUrl;
	if (metadata.traversalIndex !== void 0) if (isNonNegativeSafeInteger(metadata.traversalIndex)) nextState[VINEXT_HISTORY_INDEX_HISTORY_STATE_KEY] = metadata.traversalIndex;
	else delete nextState[VINEXT_HISTORY_INDEX_HISTORY_STATE_KEY];
	if (metadata.bfcacheIds !== void 0) if (bfcacheIdsWereCleared) {
		delete nextState[VINEXT_BFCACHE_IDS_HISTORY_STATE_KEY];
		delete nextState[VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY];
	} else nextState[VINEXT_BFCACHE_IDS_HISTORY_STATE_KEY] = { ...metadata.bfcacheIds };
	if (metadata.bfcacheVersion !== void 0) if (bfcacheIdsWereCleared) delete nextState[VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY];
	else if (isNonNegativeSafeInteger(metadata.bfcacheVersion)) nextState[VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY] = metadata.bfcacheVersion;
	else delete nextState[VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY];
	return Object.keys(nextState).length > 0 ? nextState : null;
}
function createExternalHistoryStatePreservingMetadata(callerState, currentHistoryState) {
	const previousNextUrl = readHistoryStatePreviousNextUrl(currentHistoryState);
	const traversalIndex = readHistoryStateTraversalIndex(currentHistoryState);
	const bfcacheIds = readHistoryStateBfcacheIds(currentHistoryState);
	const bfcacheVersion = readHistoryStateBfcacheVersion(currentHistoryState);
	if (previousNextUrl === null && traversalIndex === null && bfcacheIds === null) return callerState;
	return createHistoryStateWithNavigationMetadata(callerState, {
		bfcacheIds,
		bfcacheVersion: bfcacheIds === null ? void 0 : bfcacheVersion,
		previousNextUrl,
		traversalIndex
	});
}
function readHistoryStatePreviousNextUrl(state) {
	const value = readHistoryStateRecord(state)?.[VINEXT_PREVIOUS_NEXT_URL_HISTORY_STATE_KEY];
	return typeof value === "string" ? value : null;
}
function isBfcacheSegmentId(id) {
	const parsed = AppElementsWire.parseElementKey(id);
	return parsed?.kind === "layout" || parsed?.kind === "page" || parsed?.kind === "slot" || parsed?.kind === "template";
}
function readHistoryStateBfcacheIds(state) {
	const value = readHistoryStateRecord(state)?.[VINEXT_BFCACHE_IDS_HISTORY_STATE_KEY];
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const ids = {};
	for (const [key, id] of Object.entries(value)) {
		if (!isBfcacheSegmentId(key) || typeof id !== "string") return null;
		ids[key] = id;
	}
	return ids;
}
function readHistoryStateBfcacheVersion(state) {
	const value = readHistoryStateRecord(state)?.[VINEXT_BFCACHE_VERSION_HISTORY_STATE_KEY];
	return isNonNegativeSafeInteger(value) ? value : null;
}
/**
* Whether a history entry's stored bfcache version matches the document's
* current version. A missing/invalid stored version (null) is NEVER current:
* coercing it to 0 would let un-versioned entries (older builds / external
* pushState) pass the gate on a fresh document whose current version is 0,
* defeating the document-scoped stale-id rejection. App-written entries always
* carry an explicit version, so the legitimate first-document path (0 === 0)
* still matches.
*/
function isHistoryStateBfcacheVersionCurrent(state, currentVersion) {
	const version = readHistoryStateBfcacheVersion(state);
	return version !== null && version === currentVersion;
}
function createHashOnlyHistoryStatePreservingNavigationMetadata(state) {
	const previousNextUrl = readHistoryStatePreviousNextUrl(state);
	const bfcacheIds = readHistoryStateBfcacheIds(state);
	const bfcacheVersion = readHistoryStateBfcacheVersion(state);
	if (previousNextUrl === null && bfcacheIds === null) return null;
	return createHistoryStateWithNavigationMetadata(null, {
		bfcacheIds,
		bfcacheVersion: bfcacheIds === null ? void 0 : bfcacheVersion,
		previousNextUrl
	});
}
function readHistoryStateTraversalIndex(state) {
	const value = readHistoryStateRecord(state)?.[VINEXT_HISTORY_INDEX_HISTORY_STATE_KEY];
	return isNonNegativeSafeInteger(value) ? value : null;
}
function resolveHistoryTraversalIntent(options) {
	const targetHistoryIndex = readHistoryStateTraversalIndex(options.historyState);
	let direction = "unknown";
	if (options.currentHistoryIndex !== null && targetHistoryIndex !== null) {
		if (targetHistoryIndex < options.currentHistoryIndex) direction = "back";
		else if (targetHistoryIndex > options.currentHistoryIndex) direction = "forward";
	}
	return {
		direction,
		historyState: options.historyState,
		targetHistoryIndex
	};
}
//#endregion
export { HistoryStateSnapshotCache, RestorableClientStateController, createExternalHistoryStatePreservingMetadata, createHashOnlyHistoryStatePreservingNavigationMetadata, createHistoryStateWithNavigationMetadata, createHistoryStateWithPreviousNextUrl, isHistoryStateBfcacheVersionCurrent, readHistoryStateBfcacheIds, readHistoryStateBfcacheVersion, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent };
