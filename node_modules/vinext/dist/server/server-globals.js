import { AsyncLocalStorage } from "node:async_hooks";
//#region src/server/server-globals.ts
/**
* Server runtime global setup shared by vinext's generated server entries.
*
* This module intentionally runs its installer at import time. Generated entry
* modules import user pages and layouts as static dependencies, so any global
* correction that must happen before user module evaluation has to live in a
* side-effect dependency. A runtime function call from the generated entry
* body would run after static user imports have already evaluated.
*/
function clearBrowserGlobal(name) {
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
	if (!descriptor && typeof Reflect.get(globalThis, name) === "undefined") return;
	if (!descriptor) Object.defineProperty(globalThis, name, {
		configurable: true,
		value: void 0,
		writable: true
	});
	else if (descriptor.configurable) Reflect.deleteProperty(globalThis, name);
	else Reflect.set(globalThis, name, void 0);
	if (typeof Reflect.get(globalThis, name) !== "undefined") throw new Error(`[vinext] Server runtime exposes a non-removable \`${name}\` global. This breaks Next.js SSR semantics where browser globals must be absent.`);
}
function installServerGlobals() {
	clearBrowserGlobal("window");
	clearBrowserGlobal("document");
	if (typeof Reflect.get(globalThis, "AsyncLocalStorage") === "undefined") Object.defineProperty(globalThis, "AsyncLocalStorage", {
		configurable: true,
		value: AsyncLocalStorage,
		writable: true
	});
}
installServerGlobals();
//#endregion
export { installServerGlobals };
