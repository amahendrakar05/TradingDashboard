//#region src/shims/internal/make-hanging-promise.ts
/**
* makeHangingPromise — returns a promise that never resolves during prerendering.
*
* When prerendering, `io()` must return a hanging promise to prevent
* React from executing past the IO boundary. The promise never resolves—it only
* rejects if the render signal is aborted (e.g., due to a dynamic error or
* cache-fill completion).
*
* Ported from Next.js: packages/next/src/server/dynamic-rendering-utils.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/dynamic-rendering-utils.ts
*/
var HangingPromiseRejectionError = class extends Error {
	constructor(route, expression) {
		super(`Route ${route} used ${expression} during prerendering but the render was aborted. This is expected when prerendering is cut short (e.g. due to a dynamic access).`);
		this.name = "HangingPromiseRejectionError";
	}
};
const abortListenersBySignal = /* @__PURE__ */ new WeakMap();
function suppressUnhandledRejection() {}
function makeHangingPromise(signal, route, expression) {
	if (signal.aborted) {
		const rejected = Promise.reject(new HangingPromiseRejectionError(route, expression));
		rejected.catch(suppressUnhandledRejection);
		return rejected;
	}
	const hangingPromise = new Promise((_, reject) => {
		const boundRejection = reject.bind(null, new HangingPromiseRejectionError(route, expression));
		const currentListeners = abortListenersBySignal.get(signal);
		if (currentListeners) currentListeners.push(boundRejection);
		else {
			const listeners = [boundRejection];
			abortListenersBySignal.set(signal, listeners);
			signal.addEventListener("abort", () => {
				for (let i = 0; i < listeners.length; i++) listeners[i]();
				listeners.length = 0;
			}, { once: true });
		}
	});
	hangingPromise.catch(suppressUnhandledRejection);
	return hangingPromise;
}
//#endregion
export { makeHangingPromise };
