//#region src/plugins/async-hooks-stub.ts
const ASYNC_HOOKS_STUB_ID = "\0vinext:async-hooks-stub";
/**
* Stubs node:async_hooks in client (browser) builds.
*
* Several shims (headers, cache, navigation-state, etc.) import
* AsyncLocalStorage from node:async_hooks. These shims are aliased
* globally via resolve.alias so they resolve in every environment.
* In client builds, Vite externalizes node:async_hooks to an empty
* __vite-browser-external stub with no named exports, causing Rollup
* errors. This plugin intercepts node:async_hooks in the client
* environment and provides a no-op AsyncLocalStorage — semantically
* correct since shims already guard with `_als.getStore() ?? fallback`.
*/
const asyncHooksStubPlugin = {
	name: "vinext:async-hooks-stub",
	enforce: "pre",
	resolveId: {
		filter: { id: /^(node:)?async_hooks$/ },
		handler(_id) {
			if (this.environment?.name === "client") return ASYNC_HOOKS_STUB_ID;
		}
	},
	load: {
		filter: { id: new RegExp(`^${ASYNC_HOOKS_STUB_ID}$`) },
		handler(id) {
			if (id === ASYNC_HOOKS_STUB_ID) return [
				"export class AsyncLocalStorage {",
				"  run(_store, fn, ...args) { return fn(...args); }",
				"  getStore() { return undefined; }",
				"  enterWith() {}",
				"  exit(fn, ...args) { return fn(...args); }",
				"  disable() {}",
				"}"
			].join("\n");
		}
	}
};
//#endregion
export { asyncHooksStubPlugin };
