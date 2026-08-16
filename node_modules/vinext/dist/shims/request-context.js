import { getOrCreateAls } from "./internal/als-registry.js";
import { getRequestContext, isInsideUnifiedScope, runWithUnifiedStateMutation } from "./unified-request-context.js";
//#region src/shims/request-context.ts
/**
* Request ExecutionContext — AsyncLocalStorage-backed accessor.
*
* Makes the Cloudflare Workers `ExecutionContext` (which provides
* `waitUntil`) available to any code on the call stack during a request
* without requiring it to be threaded through every function signature.
*
* Usage:
*
*   // In the worker entry, wrap the handler:
*   import { runWithExecutionContext } from "vinext/shims/request-context";
*   export default {
*     fetch(request, env, ctx) {
*       return runWithExecutionContext(ctx, () => handler.fetch(request, env, ctx));
*     }
*   };
*
*   // Anywhere downstream:
*   import { getRequestExecutionContext } from "vinext/shims/request-context";
*   const ctx = getRequestExecutionContext(); // null on Node.js dev
*   ctx?.waitUntil(somePromise);
*/
const _als = getOrCreateAls("vinext.requestContext.als");
const OPEN_NEXT_CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");
let openNextCloudflareContextFallback;
function installOpenNextCloudflareContextBridge() {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, OPEN_NEXT_CLOUDFLARE_CONTEXT_SYMBOL);
	if (descriptor && !descriptor.configurable) return;
	openNextCloudflareContextFallback = descriptor && "value" in descriptor ? descriptor.value : descriptor?.get?.call(globalThis);
	Object.defineProperty(globalThis, OPEN_NEXT_CLOUDFLARE_CONTEXT_SYMBOL, {
		configurable: true,
		get() {
			const ctx = getRequestExecutionContext();
			return ctx ? { ctx } : openNextCloudflareContextFallback;
		},
		set(value) {
			openNextCloudflareContextFallback = value;
		}
	});
}
installOpenNextCloudflareContextBridge();
function runWithExecutionContext(ctx, fn) {
	if (isInsideUnifiedScope()) return runWithUnifiedStateMutation((uCtx) => {
		uCtx.executionContext = ctx;
	}, fn);
	return _als.run(ctx, fn);
}
/**
* Get the `ExecutionContext` for the current request, or `null` when called
* outside a `runWithExecutionContext()` scope (e.g. on Node.js dev server).
*
* Use `ctx?.waitUntil(promise)` to schedule background work that must
* complete before the Worker isolate is torn down.
*/
function getRequestExecutionContext() {
	if (isInsideUnifiedScope()) return getRequestContext().executionContext;
	return _als.getStore() ?? null;
}
//#endregion
export { getRequestExecutionContext, runWithExecutionContext };
