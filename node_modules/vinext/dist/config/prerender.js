import { isUnknownRecord } from "../utils/record.js";
import { flattenPluginOptions } from "../utils/plugin-options.js";
import { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, findVinextCacheConfigInPlugins, loadVinextCacheConfigFromViteConfig } from "../cache/cache-adapters-virtual.js";
//#region src/config/prerender.ts
const VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY = "__vinextPrerenderConfig";
const VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY = "__vinextRouteRootConfig";
function normalizeVinextPrerenderConfig(config) {
	if (config === void 0) return null;
	if (config === true) return { routes: "*" };
	if (!isUnknownRecord(config)) throw new Error("[vinext] Invalid `prerender` config. Use `true` or `{ routes: \"*\" }`.");
	if (config.routes === "*") return { routes: "*" };
	throw new Error("[vinext] Unsupported `prerender.routes` config. Currently only `routes: \"*\"` is supported.");
}
async function findVinextPrerenderConfigInPlugins(plugins) {
	const flattened = await flattenPluginOptions(plugins);
	for (const plugin of flattened) {
		if (!isUnknownRecord(plugin)) continue;
		const prerenderConfig = plugin[VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY];
		if (prerenderConfig) return prerenderConfig;
	}
	return null;
}
async function findVinextRouteRootConfigInPlugins(plugins) {
	const flattened = await flattenPluginOptions(plugins);
	for (const plugin of flattened) {
		if (!isUnknownRecord(plugin)) continue;
		const routeRootConfig = plugin[VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY];
		if (routeRootConfig) return routeRootConfig;
	}
	return null;
}
async function loadVinextPrerenderConfigFromViteConfig(vite, root) {
	return await findVinextPrerenderConfigInPlugins((await vite.loadConfigFromFile({
		command: "build",
		mode: "production"
	}, void 0, root))?.config.plugins);
}
async function loadVinextRouteRootConfigFromViteConfig(vite, root) {
	return await findVinextRouteRootConfigInPlugins((await vite.loadConfigFromFile({
		command: "build",
		mode: "production"
	}, void 0, root))?.config.plugins);
}
function resolveVinextPrerenderDecision(options) {
	if (options.prerenderAllFlag) return {
		routes: "*",
		reason: "flag"
	};
	if (options.nextOutput === "export") return {
		routes: "*",
		reason: "next-export"
	};
	if (options.vinextPrerenderConfig?.routes === "*") return {
		routes: "*",
		reason: "vinext-config"
	};
	return null;
}
function formatVinextPrerenderLabel(decision) {
	if (decision.reason === "next-export") return "Pre-rendering all routes (output: 'export')...";
	if (decision.reason === "vinext-config") return "Pre-rendering all routes (vinext prerender config)...";
	return "Pre-rendering all routes...";
}
//#endregion
export { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VINEXT_PRERENDER_CONFIG_PLUGIN_PROPERTY, VINEXT_ROUTE_ROOT_CONFIG_PLUGIN_PROPERTY, findVinextCacheConfigInPlugins, findVinextPrerenderConfigInPlugins, findVinextRouteRootConfigInPlugins, formatVinextPrerenderLabel, loadVinextCacheConfigFromViteConfig, loadVinextPrerenderConfigFromViteConfig, loadVinextRouteRootConfigFromViteConfig, normalizeVinextPrerenderConfig, resolveVinextPrerenderDecision };
