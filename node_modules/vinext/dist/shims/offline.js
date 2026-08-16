"use client";
//#region src/shims/offline.ts
/**
* next/offline shim
*
* Stub for the experimental `useOffline()` hook added in Next.js
* (vercel/next.js#92012). Returns `false` (online) unconditionally.
* Full offline retry behavior (navigation retry, prefetch pause/resume,
* OfflineProvider) will be implemented once the feature stabilizes upstream.
*/
function useOffline() {
	return false;
}
//#endregion
export { useOffline };
