import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
//#region src/plugins/middleware-server-only.ts
/**
* Allow `import 'server-only'` from neutral server targets (and any module
* reachable from them) in the SSR environment.
*
* Background: middleware runs server-side, so importing `server-only` is
* semantically correct. However, vinext bundles middleware into the SSR
* environment (via `virtual:vinext-server-entry`), and @vitejs/plugin-rsc's
* `rsc:validate-imports` plugin treats any non-RSC environment as a "client"
* build, rejecting `server-only` imports with:
*
*   'server-only' cannot be imported in client build ('ssr' environment)
*
* Next.js solves this with webpack `issuerLayer` rules: middleware,
* instrumentation, and Pages API routes sit in server-only or neutral layers
* where `server-only` is aliased to a no-op while `client-only` still errors. See
*   packages/next/src/build/webpack-config.ts ("Alias server-only and
*   client-only to proper exports based on bundling layers")
*
* Vite has no per-layer aliasing within a single environment, so we mirror
* the behavior with import-chain taint tracking:
*
*   1. Seed a `tainted` set with the middleware entry path (and its
*      canonical realpath), and recognize other neutral server entry modules
*      such as Pages API routes through `isNeutralServerModule`.
*   2. For every resolveId call from a tainted importer, resolve the import
*      via `this.resolve(..., { skipSelf: true })` and add the resolved id
*      to the tainted set. This propagates the taint along the import graph
*      synchronously, before plugin-rsc's `order: "pre"` validate-imports
*      handler sees the next `server-only` request.
*   3. When a tainted module imports `server-only` in a non-RSC environment,
*      short-circuit to the no-op shim path so plugin-rsc's filter (which
*      matches the bare `^server-only$` specifier) never fires for that
*      import.
*
* The taint set is scoped to the middleware chain only — `server-only`
* imports from anywhere else (including client component code traversing
* through the SSR environment for `react-dom/server.edge` rendering) still
* hit the rsc:validate-imports rejection, preserving the original safety
* net for accidental client-side `server-only` leakage.
*
* Ported from Next.js handling of `WEBPACK_LAYERS.middleware` /
* `WEBPACK_LAYERS.GROUP.neutralTarget`:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack-config.ts
*/
function createMiddlewareServerOnlyPlugin(options) {
	const tainted = /* @__PURE__ */ new Set();
	function canonicalizeId(id) {
		const queryIndex = id.indexOf("?");
		return toSlash(queryIndex === -1 ? id : id.slice(0, queryIndex));
	}
	function isTainted(id) {
		if (!id) return false;
		return tainted.has(canonicalizeId(id));
	}
	function addTainted(id) {
		tainted.add(canonicalizeId(id));
	}
	return {
		name: "vinext:middleware-server-only",
		// @vitejs/plugin-rsc's `rsc:validate-imports` (which is a normal-priority
		enforce: "pre",
		buildStart() {
			tainted.clear();
			const middlewarePath = options.getMiddlewarePath();
			if (middlewarePath) addTainted(middlewarePath);
			const canonical = options.getCanonicalMiddlewarePath();
			if (canonical) addTainted(canonical);
		},
		resolveId: {
			order: "pre",
			async handler(id, importer, opts) {
				if (this.environment?.name === "rsc") return;
				if (!importer) return;
				if (!isTainted(importer) && !options.isNeutralServerModule?.(canonicalizeId(importer))) return;
				if (id === "server-only") return {
					id: options.serverOnlyShimPath,
					moduleSideEffects: false
				};
				const resolved = await this.resolve(id, importer, {
					...opts,
					skipSelf: true
				});
				if (resolved && !resolved.external) addTainted(resolved.id);
			}
		}
	};
}
//#endregion
export { createMiddlewareServerOnlyPlugin };
