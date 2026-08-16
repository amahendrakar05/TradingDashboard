import "../../utils/protocol-headers.js";
import { getDeploymentId } from "../../utils/deployment-id.js";
//#region src/shims/internal/pages-data-fetch-dedup.ts
/**
* In-flight request dedup for the Pages Router `/_next/data/<id>/<page>.json`
* endpoint.
*
* Why this exists: when a user (or app code) triggers several near-simultaneous
* navigations to the same gSSP route — e.g. clicking the same `<Link>` multiple
* times before the first navigation lands — each call to `Router.push` would
* otherwise enter its own `navigateClientData()` flow and dispatch its own
* `fetch()` against the data endpoint. That balloons server load and breaks
* Next.js' documented "one fetch per unique data URL" guarantee.
*
* Ported from Next.js: `fetchNextData()` in
* `packages/next/src/shared/lib/router/router.ts`. Next.js maintains an
* `inflightCache` (keyed by the resolved data URL) and reuses the existing
* Promise when a concurrent caller asks for the same URL. The entry is
* dropped once the fetch settles (success or rejection) so the next
* navigation re-fetches fresh.
*
* Design notes:
*
* - Callers receive a cloned Response, so each can independently consume the
*   body (`.json()`, `.text()`, etc.). The originating Response is never read
*   directly by anyone, which keeps subsequent clones legal even after one
*   caller has consumed its copy.
*
* - Each caller owns one waiter. Cancelling a waiter rejects only that caller;
*   the shared request continues and self-evicts when it settles. This mirrors
*   Next.js: a superseded data request may still reach the server, but its
*   result is ignored by the cancelled navigation.
*
* - The map is module-scoped (one per realm). The Pages Router runs in the
*   browser only, so a single `Map` is sufficient.
*/
/** Inflight fetch entries keyed by the resolved data request identity. */
const inflight = /* @__PURE__ */ new Map();
const staticDataCache = Object.create(null);
const staticDataSources = /* @__PURE__ */ new Map();
function getStaticDataKey(dataHref) {
	if (typeof window === "undefined") return dataHref;
	const previewVariant = window.__NEXT_DATA__?.isPreview === true ? "preview" : "normal";
	try {
		return `${new URL(dataHref, window.location.href).href}\n${previewVariant}`;
	} catch {
		return `${dataHref}\n${previewVariant}`;
	}
}
function cloneStaticResponse(cached, signal) {
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
	if (!signal) return cached.then((response) => response.clone());
	return new Promise((resolve, reject) => {
		const abort = () => reject(new DOMException("Aborted", "AbortError"));
		signal.addEventListener("abort", abort, { once: true });
		cached.then((response) => {
			signal.removeEventListener("abort", abort);
			resolve(response.clone());
		}, (error) => {
			signal.removeEventListener("abort", abort);
			reject(error);
		});
	});
}
function getPagesStaticDataCache() {
	return staticDataCache;
}
function fetchCachedPagesData(dataHref, init) {
	const key = getStaticDataKey(dataHref);
	let cached = staticDataSources.get(key);
	if (cached === void 0) {
		const { signal: _signal, ...sharedInit } = init ?? {};
		cached = dedupedPagesDataFetch(dataHref, sharedInit).then((response) => {
			const expectedDeploymentId = getDeploymentId() ?? null;
			const responseDeploymentId = response.headers.get("x-nextjs-deployment-id");
			if (!response.ok || response.headers.get("x-middleware-cache") === "no-cache" || response.headers.get("x-middleware-skip") !== null || responseDeploymentId !== null && responseDeploymentId !== expectedDeploymentId) {
				delete staticDataCache[key];
				staticDataSources.delete(key);
			}
			return response;
		}).catch((error) => {
			delete staticDataCache[key];
			staticDataSources.delete(key);
			throw error;
		});
		staticDataSources.set(key, cached);
		const publicCached = cached.then((response) => response.clone());
		publicCached.catch(() => {});
		staticDataCache[key] = publicCached;
	}
	return cloneStaticResponse(cached, init?.signal ?? void 0);
}
function fetchStaticPagesData(dataHref, init) {
	return fetchCachedPagesData(dataHref, init);
}
function fetchUncachedPagesData(dataHref, init) {
	return fetch(dataHref, init).then(async (response) => {
		const body = await response.arrayBuffer();
		return new Response(body, {
			headers: response.headers,
			status: response.status,
			statusText: response.statusText
		});
	});
}
function evictPagesDataCache(dataHref) {
	const key = getStaticDataKey(dataHref);
	delete staticDataCache[key];
	staticDataSources.delete(key);
}
function getInflightKey(dataHref, init) {
	let resolvedHref = dataHref;
	if (typeof window !== "undefined") try {
		resolvedHref = new URL(dataHref, window.location.href).href;
	} catch {}
	const deploymentId = new Headers(init?.headers).get("x-deployment-id") ?? "";
	const previewVariant = typeof window !== "undefined" && window.__NEXT_DATA__?.isPreview === true ? "preview" : "normal";
	return `${resolvedHref}\n${deploymentId}\n${previewVariant}`;
}
function cloneSharedResponse(key, entry, signal) {
	entry.waiters += 1;
	return new Promise((resolve, reject) => {
		let released = false;
		const release = () => {
			if (released) return;
			released = true;
			entry.waiters -= 1;
		};
		const abort = () => {
			release();
			reject(new DOMException("Aborted", "AbortError"));
		};
		signal?.addEventListener("abort", abort, { once: true });
		entry.promise.then((response) => {
			signal?.removeEventListener("abort", abort);
			release();
			resolve(response.clone());
		}, (error) => {
			signal?.removeEventListener("abort", abort);
			release();
			reject(error);
		});
	});
}
/**
* Dedupe a `fetch()` against the `_next/data` endpoint. Multiple concurrent
* callers for the same resolved URL and deployment ID share one underlying
* network request.
*
* Each call returns a freshly-cloned `Response` so consumers can read the
* body independently. Once the in-flight Promise settles (resolve or reject)
* the entry is removed, and the next call will hit the network again.
*
* Errors propagate to every concurrent caller — the in-flight entry is
* dropped on failure so the next navigation can retry.
*/
function dedupedPagesDataFetch(dataHref, init) {
	const key = getInflightKey(dataHref, init);
	const signal = init?.signal ?? void 0;
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
	let entry = inflight.get(key);
	if (!entry) {
		const controller = new AbortController();
		let currentEntry;
		currentEntry = {
			controller,
			promise: fetch(dataHref, {
				...init,
				signal: controller.signal
			}).finally(() => {
				currentEntry.settled = true;
				if (inflight.get(key) === currentEntry) inflight.delete(key);
			}),
			settled: false,
			waiters: 0
		};
		inflight.set(key, currentEntry);
		entry = currentEntry;
	}
	return cloneSharedResponse(key, entry, signal);
}
/**
* Drop every cached in-flight entry. Intended for tests; production code
* does not need to call this because entries self-evict on settle.
*/
function clearPagesDataInflight() {
	for (const entry of inflight.values()) entry.controller.abort();
	inflight.clear();
	staticDataSources.clear();
	for (const key of Object.keys(staticDataCache)) delete staticDataCache[key];
}
//#endregion
export { clearPagesDataInflight, dedupedPagesDataFetch, evictPagesDataCache, fetchCachedPagesData, fetchStaticPagesData, fetchUncachedPagesData, getPagesStaticDataCache };
