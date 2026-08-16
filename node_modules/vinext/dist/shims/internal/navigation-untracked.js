import { getNavigationContext } from "../navigation-context-state.js";
import { getPagesNavigationContext } from "./pages-router-accessor.js";
import { getClientNavigationState, useClientNavigationRenderSnapshot } from "../navigation.js";
//#region src/shims/internal/navigation-untracked.ts
/**
* Internal navigation-untracked pathname hook.
*
* Used by `unstable_catchError` error boundaries to avoid subscribing to
* pathname changes. This is NOT part of the public `next/navigation` API.
*
* Ported from Next.js:
*   https://github.com/vercel/next.js/blob/v16.2.6/packages/next/src/client/components/navigation-untracked.ts
*/
const isServer = typeof window === "undefined";
function getPathnameSnapshot() {
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return pagesCtx.pathname;
	return getClientNavigationState()?.cachedPathname ?? "/";
}
/**
* Returns the current pathname without registering it as a tracked render
* dependency. Unlike `usePathname()`, this does not use `useSyncExternalStore`
* and therefore does not cause the component to re-render on navigation.
*
* Server: returns the pathname from context, or `"/"` when no navigation context
* is available (the client will hydrate with the real value). The `"/"` fallback
* deliberately matches vinext's `usePathname()` behavior rather than Next.js's
* null context default. Returns `null` only when the render is a missing-params
* shell — vinext does not yet implement fallback-route-param detection, so this
* path is not currently reachable.
*
* Client: prefers the render snapshot **only during an active navigation**
* transition (`navigationSnapshotActiveCount > 0`) so the hook returns the
* pending URL, not the stale committed one. After commit, falls back to the
* cached pathname so user `pushState`/`replaceState` calls are immediately
* reflected.
*
* Used by `unstable_catchError` error boundaries to avoid unnecessary re-renders.
*
* @internal
*/
function useUntrackedPathname() {
	if (isServer) {
		const ctx = getNavigationContext();
		if (ctx) return ctx.pathname;
		const pagesCtx = getPagesNavigationContext();
		return pagesCtx ? pagesCtx.pathname : "/";
	}
	const renderSnapshot = useClientNavigationRenderSnapshot();
	if (renderSnapshot && (getClientNavigationState()?.navigationSnapshotActiveCount ?? 0) > 0) return renderSnapshot.pathname;
	const pagesCtx = getPagesNavigationContext();
	if (pagesCtx) return pagesCtx.pathname;
	return getPathnameSnapshot();
}
//#endregion
export { useUntrackedPathname };
