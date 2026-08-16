import { RestorableClientStateController, createHistoryStateWithNavigationMetadata, readHistoryStateBfcacheIds, readHistoryStatePreviousNextUrl, readHistoryStateTraversalIndex, resolveHistoryTraversalIntent } from "./app-history-state.js";
//#region src/server/app-browser-history-controller.ts
function createCanonicalBrowserHistoryHref(href) {
	const url = new URL(href);
	return `${url.pathname}${url.search}${url.hash}`;
}
function stripVinextScrollState(state) {
	if (!state || typeof state !== "object") return state;
	const nextState = {};
	for (const [key, value] of Object.entries(state)) {
		if (key === "__vinext_scrollX" || key === "__vinext_scrollY") continue;
		nextState[key] = value;
	}
	return Object.keys(nextState).length > 0 ? nextState : null;
}
/**
* Owns App Router browser-history metadata and traversal bookkeeping behind a
* typed seam: traversal index allocation/commit, push/replace/traverse/hash-only
* history-state writes, BFCache epoch/snapshot invalidation through
* `RestorableClientStateController`, and restorable-snapshot candidate
* resolution.
*
* Ownership boundary: this is not a second router or visible-state authority. It
* resolves history facts and delegates visible restoration through an injected
* approved-commit callback. It never sets router state directly, never imports
* `applyApprovedVisibleCommit()`, and never bypasses the `ApprovedVisibleCommit`
* boundary owned by `AppBrowserNavigationController`.
*/
var AppBrowserHistoryController = class {
	#restorableClientState;
	#readHistoryState;
	#readCurrentHref;
	#pushHistoryState;
	#replaceHistoryState;
	#readVisibleNavigationMetadata;
	#currentHistoryTraversalIndex;
	#nextHistoryTraversalIndex;
	constructor(deps) {
		this.#readHistoryState = deps.readHistoryState;
		this.#readCurrentHref = deps.readCurrentHref;
		this.#pushHistoryState = deps.pushHistoryState;
		this.#replaceHistoryState = deps.replaceHistoryState;
		this.#readVisibleNavigationMetadata = deps.readVisibleNavigationMetadata;
		this.#restorableClientState = new RestorableClientStateController({
			initialHistoryState: deps.initialHistoryState,
			maxHistoryStateSnapshots: deps.maxHistoryStateSnapshots
		});
		this.#currentHistoryTraversalIndex = readHistoryStateTraversalIndex(deps.initialHistoryState) ?? 0;
		this.#nextHistoryTraversalIndex = this.#currentHistoryTraversalIndex;
	}
	get currentHistoryTraversalIndex() {
		return this.#currentHistoryTraversalIndex;
	}
	allocateNavigationHistoryTraversalIndex(historyUpdateMode) {
		switch (historyUpdateMode) {
			case "push": return this.#nextHistoryTraversalIndex + 1;
			case "replace": return this.#currentHistoryTraversalIndex;
			case void 0: return null;
			default: throw new Error("[vinext] Unknown history update mode: " + String(historyUpdateMode));
		}
	}
	commitHistoryTraversalIndex(index) {
		this.#currentHistoryTraversalIndex = index;
		if (index !== null) this.#nextHistoryTraversalIndex = Math.max(this.#nextHistoryTraversalIndex, index);
	}
	commitTraversalIndexFromHistoryState(historyState) {
		this.commitHistoryTraversalIndex(readHistoryStateTraversalIndex(historyState));
	}
	resolveTraversalIntent(historyState) {
		return resolveHistoryTraversalIntent({
			currentHistoryIndex: this.#currentHistoryTraversalIndex,
			historyState
		});
	}
	readCurrentBfcacheVersionHistoryIds(historyState) {
		return this.#restorableClientState.readCurrentBfcacheVersionHistoryIds(historyState);
	}
	isCacheInvalidationGuarded() {
		return this.#restorableClientState.isCacheInvalidationGuarded();
	}
	isCurrentBfcacheVersion(historyState) {
		return this.#restorableClientState.isCurrentBfcacheVersion(historyState);
	}
	beginCacheInvalidationGuard() {
		return this.#restorableClientState.beginCacheInvalidationGuard();
	}
	invalidateRestorableClientState() {
		this.#restorableClientState.invalidateClientState();
	}
	rememberHistoryStateSnapshot(state) {
		this.#restorableClientState.rememberHistoryStateSnapshot({
			historyIndex: this.#currentHistoryTraversalIndex,
			state
		});
	}
	commitHashOnlyNavigation(href, historyUpdateMode, scroll) {
		const navigationHistoryIndex = this.allocateNavigationHistoryTraversalIndex(historyUpdateMode);
		const historyState = this.#readHistoryState();
		const visible = this.#readVisibleNavigationMetadata();
		const previousNextUrl = visible ? visible.previousNextUrl : readHistoryStatePreviousNextUrl(historyState);
		const bfcacheIds = visible ? visible.bfcacheIds : this.#restorableClientState.readCurrentBfcacheVersionHistoryIds(historyState);
		const nextHistoryState = createHistoryStateWithNavigationMetadata(this.#createHashOnlyNavigationBaseHistoryState(historyUpdateMode, scroll), {
			bfcacheIds,
			bfcacheVersion: bfcacheIds === null ? void 0 : this.#restorableClientState.currentBfcacheVersion,
			previousNextUrl,
			traversalIndex: navigationHistoryIndex
		});
		if (historyUpdateMode === "replace") this.#replaceHistoryState(nextHistoryState, href);
		else this.#pushHistoryState(nextHistoryState, href);
		this.commitHistoryTraversalIndex(navigationHistoryIndex);
	}
	#createHashOnlyNavigationBaseHistoryState(historyUpdateMode, scroll) {
		if (historyUpdateMode !== "replace") return null;
		const historyState = this.#readHistoryState();
		return scroll ? stripVinextScrollState(historyState) : historyState;
	}
	/**
	* Writes the history entry for an approved push/replace/traverse commit and
	* advances the traversal index. `stageClientParams` runs at the exact point it
	* ran inline in the browser-entry commit effect so client-param staging stays
	* ordered relative to the history write. Mirrors Next.js committing tree state
	* into the history entry during the navigation commit.
	*/
	commitNavigationHistory(options) {
		const currentHref = this.#readCurrentHref();
		const origin = new URL(currentHref).origin;
		const targetHref = new URL(options.href, origin).href;
		const preserveExistingState = options.historyUpdateMode === "replace";
		const navigationHistoryIndex = options.targetHistoryIndex !== void 0 ? options.targetHistoryIndex : this.allocateNavigationHistoryTraversalIndex(options.historyUpdateMode);
		const historyState = createHistoryStateWithNavigationMetadata(preserveExistingState ? this.#readHistoryState() : null, {
			bfcacheIds: options.bfcacheIds,
			bfcacheVersion: this.#restorableClientState.currentBfcacheVersion,
			previousNextUrl: options.previousNextUrl,
			traversalIndex: navigationHistoryIndex
		});
		let wroteHistoryState = false;
		if (options.historyUpdateMode === "replace" && currentHref !== targetHref) {
			options.stageClientParams();
			this.#replaceHistoryState(historyState, options.href);
			wroteHistoryState = true;
			this.commitHistoryTraversalIndex(navigationHistoryIndex);
		} else if (options.historyUpdateMode === "push" && currentHref !== targetHref) {
			options.stageClientParams();
			this.#pushHistoryState(historyState, options.href);
			wroteHistoryState = true;
			this.commitHistoryTraversalIndex(navigationHistoryIndex);
		}
		if (!wroteHistoryState) {
			this.syncCurrentHistoryStatePreviousNextUrl(options.previousNextUrl, options.bfcacheIds);
			options.stageClientParams();
			if (options.targetHistoryIndex !== void 0) this.commitHistoryTraversalIndex(options.targetHistoryIndex);
		}
	}
	syncCurrentHistoryStatePreviousNextUrl(previousNextUrl, bfcacheIds) {
		if (this.#isHistoryStateNavigationMetadataInSync(this.#readHistoryState(), previousNextUrl, bfcacheIds)) return;
		const nextHistoryState = createHistoryStateWithNavigationMetadata(this.#readHistoryState(), {
			bfcacheIds,
			bfcacheVersion: bfcacheIds === void 0 ? void 0 : this.#restorableClientState.currentBfcacheVersion,
			previousNextUrl
		});
		this.#replaceHistoryState(nextHistoryState);
		if (this.#isHistoryStateNavigationMetadataInSync(this.#readHistoryState(), previousNextUrl, bfcacheIds)) return;
		this.#replaceHistoryState(nextHistoryState);
	}
	#isHistoryStateNavigationMetadataInSync(state, previousNextUrl, bfcacheIds) {
		return readHistoryStatePreviousNextUrl(state) === previousNextUrl && (bfcacheIds === void 0 || areBfcacheIdMapsEqual(readHistoryStateBfcacheIds(state), bfcacheIds) && this.#restorableClientState.isCurrentBfcacheVersion(state));
	}
	/** Initial history write performed before hydration starts. */
	writeBootstrapHistoryMetadata() {
		this.#replaceHistoryState(createHistoryStateWithNavigationMetadata(this.#readHistoryState(), {
			previousNextUrl: null,
			traversalIndex: this.#currentHistoryTraversalIndex
		}), createCanonicalBrowserHistoryHref(this.#readCurrentHref()));
	}
	/** History write performed on the first committed (hydrated) render. */
	writeHydratedHistoryMetadata(options) {
		this.#replaceHistoryState(createHistoryStateWithNavigationMetadata(this.#readHistoryState(), {
			bfcacheIds: options.bfcacheIds,
			bfcacheVersion: this.#restorableClientState.currentBfcacheVersion,
			previousNextUrl: options.previousNextUrl,
			traversalIndex: this.#currentHistoryTraversalIndex
		}));
	}
	/**
	* Resolves a restorable snapshot candidate for the given history entry and
	* commits the traversal index after, and only after, the injected
	* approved-visible-restore callback succeeds. The traversal-index commit and
	* client-param staging run inside `beforeCommit`, which the
	* `AppBrowserNavigationController` invokes only once the `ApprovedVisibleCommit`
	* is approved. Returns false when no snapshot is restorable or the restore is
	* not approved.
	*/
	restoreHistorySnapshot(options) {
		const decision = this.#restorableClientState.resolveHistoryStateSnapshotRestore(options.historyState);
		if (decision.kind === "skip") return false;
		return options.approveVisibleRestore({
			state: decision.state,
			beforeCommit: () => {
				this.commitHistoryTraversalIndex(decision.targetHistoryIndex);
				options.stageClientParams(decision.state.navigationSnapshot.params);
			}
		});
	}
};
function areBfcacheIdMapsEqual(a, b) {
	if (a === b) return true;
	if (a === null || b === null) return false;
	const aEntries = Object.entries(a);
	const bEntries = Object.entries(b);
	if (aEntries.length !== bEntries.length) return false;
	return aEntries.every(([key, value]) => b[key] === value);
}
//#endregion
export { AppBrowserHistoryController, createCanonicalBrowserHistoryHref };
