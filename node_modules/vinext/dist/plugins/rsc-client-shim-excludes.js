//#region src/plugins/rsc-client-shim-excludes.ts
const RSC_CLIENT_SHIM_OPTIMIZE_DEPS_EXCLUDE = Object.freeze([
	"vinext/shims/error-boundary",
	"vinext/shims/form",
	"vinext/shims/layout-segment-context",
	"vinext/shims/link",
	"vinext/shims/script",
	"vinext/shims/slot",
	"vinext/shims/offline"
]);
const VINEXT_OPTIMIZE_DEPS_EXCLUDE = Object.freeze([
	"vinext",
	"@vercel/og",
	"private-next-instrumentation-client",
	...RSC_CLIENT_SHIM_OPTIMIZE_DEPS_EXCLUDE
]);
const SSR_EXTERNAL_REACT_ENTRIES = Object.freeze([
	"react",
	"react-dom",
	"react-dom/server.edge",
	"react-dom/static.edge",
	"react/jsx-runtime",
	"react/jsx-dev-runtime",
	"react-server-dom-webpack/client.edge"
]);
function mergeOptimizeDepsExclude(...excludeGroups) {
	const seen = /* @__PURE__ */ new Set();
	for (const group of excludeGroups) for (const entry of group) {
		if (seen.has(entry)) continue;
		seen.add(entry);
	}
	return [...seen];
}
//#endregion
export { SSR_EXTERNAL_REACT_ENTRIES, VINEXT_OPTIMIZE_DEPS_EXCLUDE, mergeOptimizeDepsExclude };
