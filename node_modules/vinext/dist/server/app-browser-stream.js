import { decodeRscEmbeddedChunk } from "./app-rsc-embedded-chunks.js";
import { ensureNavigationRuntimeRscBootstrap, getNavigationRuntime } from "../client/navigation-runtime.js";
//#region src/server/app-browser-stream.ts
function getVinextBrowserGlobal() {
	return globalThis;
}
function createUnexpectedRscStreamCloseError() {
	return /* @__PURE__ */ new Error("The connection to the page was unexpectedly closed, possibly due to the stop button being clicked, loss of Wi-Fi, or an unstable internet connection.");
}
/**
* Convert embedded chunks back to a ReadableStream of Uint8Array chunks.
*/
function chunksToReadableStream(chunks) {
	return new ReadableStream({ start(controller) {
		for (const chunk of chunks) controller.enqueue(decodeRscEmbeddedChunk(chunk));
		controller.close();
	} });
}
function getNavigationRuntimeRscBootstrap() {
	return getNavigationRuntime()?.bootstrap.rsc ?? null;
}
/**
* Create a ReadableStream from progressively-embedded RSC chunks.
*
* The server pushes chunks into the typed navigation runtime via inline
* <script> tags. We monkey-patch `push()` so new chunks stream to React
* immediately instead of polling with setTimeout.
*/
function createProgressiveRscStream() {
	let cancelStream;
	return new ReadableStream({
		start(controller) {
			const vinext = getVinextBrowserGlobal();
			const runtimeRsc = getNavigationRuntimeRscBootstrap();
			const initialChunks = runtimeRsc?.rsc ?? vinext.__VINEXT_RSC_CHUNKS__ ?? [];
			for (const chunk of initialChunks) controller.enqueue(decodeRscEmbeddedChunk(chunk));
			if (runtimeRsc?.done || vinext.__VINEXT_RSC_DONE__) {
				controller.close();
				return;
			}
			let closed = false;
			let cancelDocumentCompletionCheck;
			const cancelPendingDocumentCompletionCheck = () => {
				const cancel = cancelDocumentCompletionCheck;
				cancelDocumentCompletionCheck = void 0;
				cancel?.();
			};
			const closeOnce = () => {
				if (!closed) {
					closed = true;
					cancelPendingDocumentCompletionCheck();
					controller.close();
				}
			};
			const scheduleCloseOnce = () => {
				if (typeof queueMicrotask === "function") queueMicrotask(closeOnce);
				else Promise.resolve().then(closeOnce);
			};
			const errorOnce = () => {
				if (!closed) {
					closed = true;
					cancelPendingDocumentCompletionCheck();
					controller.error(createUnexpectedRscStreamCloseError());
				}
			};
			cancelStream = () => {
				if (!closed) {
					closed = true;
					cancelPendingDocumentCompletionCheck();
				}
			};
			const liveRuntimeRsc = getNavigationRuntime() === null ? null : ensureNavigationRuntimeRscBootstrap();
			const arr = liveRuntimeRsc?.rsc ?? (vinext.__VINEXT_RSC_CHUNKS__ ??= []);
			arr.push = function(...chunks) {
				const length = Array.prototype.push.apply(this, chunks);
				if (closed) return length;
				for (const chunk of chunks) controller.enqueue(decodeRscEmbeddedChunk(chunk));
				if (liveRuntimeRsc?.done || vinext.__VINEXT_RSC_DONE__) closeOnce();
				return length;
			};
			if (liveRuntimeRsc) {
				let done = Boolean(liveRuntimeRsc.done);
				Object.defineProperty(liveRuntimeRsc, "done", {
					configurable: true,
					enumerable: true,
					get() {
						return done;
					},
					set(value) {
						done = Boolean(value);
						if (done) scheduleCloseOnce();
					}
				});
			} else {
				let done = Boolean(vinext.__VINEXT_RSC_DONE__);
				Object.defineProperty(vinext, "__VINEXT_RSC_DONE__", {
					configurable: true,
					enumerable: true,
					get() {
						return done;
					},
					set(value) {
						done = Boolean(value);
						if (done) scheduleCloseOnce();
					}
				});
			}
			if (typeof document !== "undefined") if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", errorOnce);
				cancelDocumentCompletionCheck = () => document.removeEventListener("DOMContentLoaded", errorOnce);
			} else {
				const timeoutId = setTimeout(errorOnce);
				cancelDocumentCompletionCheck = () => clearTimeout(timeoutId);
			}
		},
		cancel() {
			cancelStream?.();
		}
	});
}
//#endregion
export { chunksToReadableStream, createProgressiveRscStream, getVinextBrowserGlobal };
