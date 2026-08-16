import { flattenPluginOptions } from "../utils/plugin-options.js";
//#region src/cache/cache-adapters-virtual.ts
/**
* Code generation for the `virtual:vinext-cache-adapters` module, resolved by
* the vinext vite plugin from the user's `cache` config ({@link VinextCacheConfig}).
*
* The generated module exports `registerConfiguredCacheAdapters(env)`, which the
* server entries call on each request. It self-guards (adapters instantiate once
* per isolate) and is a no-op when nothing is configured. Registration is
* resilient: a factory that throws (e.g. a KV adapter on the Node.js server,
* where the binding can't exist) is logged and skipped rather than failing every
* request, so the same config can be registered from every runtime/router entry.
*
* Descriptor `options` are inlined into the generated module and forwarded to the
* factory at runtime, so a config-time builder like `kvDataAdapter({ binding })`
* never touches the Workers runtime — instantiation is deferred to the first
* request.
*/
/** Public virtual module id imported by the server entries. */
const VIRTUAL_CACHE_ADAPTERS = "virtual:vinext-cache-adapters";
const VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY = "__vinextCacheConfig";
async function findVinextCacheConfigInPlugins(plugins) {
	const flattened = await flattenPluginOptions(plugins);
	for (const plugin of flattened) {
		if (!plugin || typeof plugin !== "object") continue;
		const cacheConfig = plugin[VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY];
		if (cacheConfig) return cacheConfig;
	}
	return null;
}
async function loadVinextCacheConfigFromViteConfig(vite, root) {
	return await findVinextCacheConfigInPlugins((await vite.loadConfigFromFile({
		command: "build",
		mode: "production"
	}, void 0, root))?.config.plugins);
}
/**
* Serialize descriptor options into a JS expression for inlining. Plain JSON is
* a valid JS literal; `undefined` when there are no options. Throws a clear
* config-time error (not a runtime one) if options are not serializable.
*/
function inlineOptions(adapter, options) {
	if (options === void 0) return "undefined";
	try {
		return JSON.stringify(options);
	} catch (cause) {
		throw new Error(`[vinext] cache adapter "${adapter}" options must be JSON-serializable.`, { cause });
	}
}
/**
* Generate the source of the `virtual:vinext-cache-adapters` module for the
* given config. Always exports `registerConfiguredCacheAdapters(env)`.
*/
function generateCacheAdaptersModule(cache) {
	const data = cache?.data;
	const cdn = cache?.cdn;
	if (!data?.adapter && !cdn?.adapter) return [
		"// vinext: no cache.cdn/cache.data adapter configured — registration is a no-op.",
		"export function registerConfiguredCacheAdapters() {}",
		""
	].join("\n");
	const lines = ["// vinext: generated from the `cache` option in your vinext() plugin config."];
	if (data?.adapter) {
		lines.push(`import __vinextDataAdapterFactory from ${JSON.stringify(data.adapter)};`);
		lines.push(`import { setDataCacheHandler } from "vinext/shims/cache-handler";`);
	}
	if (cdn?.adapter) {
		lines.push(`import __vinextCdnAdapterFactory from ${JSON.stringify(cdn.adapter)};`);
		lines.push(`import { setCdnCacheAdapter } from "vinext/shims/cdn-cache";`);
	}
	lines.push("", "// A factory that throws (e.g. a missing binding on an incompatible runtime)", "// is logged and skipped so the default handler stays in place.", "function __vinextFormatAdapterError(error) {", "  if (error instanceof Error && error.message) return error.message;", "  try {", "    return String(error);", "  } catch {", "    return '<unknown error>';", "  }", "}", "", "let __vinextCacheAdaptersRegistered = false;", "", "export function registerConfiguredCacheAdapters(env) {", "  if (typeof process !== 'undefined' && process.env?.__VINEXT_PRERENDER_PATH_DISCOVERY === '1') return;", "  if (__vinextCacheAdaptersRegistered) return;", "  __vinextCacheAdaptersRegistered = true;");
	if (data?.adapter) lines.push("  try {", `    setDataCacheHandler(__vinextDataAdapterFactory({ env, options: ${inlineOptions(data.adapter, data.options)} }));`, "  } catch (error) {", "    console.warn(\"[vinext] failed to initialize the configured data cache adapter; using the default handler.\\n\" + __vinextFormatAdapterError(error));", "  }");
	if (cdn?.adapter) lines.push("  try {", `    setCdnCacheAdapter(__vinextCdnAdapterFactory({ env, options: ${inlineOptions(cdn.adapter, cdn.options)} }));`, "  } catch (error) {", "    console.warn(\"[vinext] failed to initialize the configured CDN cache adapter; using the default adapter.\\n\" + __vinextFormatAdapterError(error));", "  }");
	lines.push("}", "");
	return lines.join("\n");
}
//#endregion
export { VINEXT_CACHE_CONFIG_PLUGIN_PROPERTY, VIRTUAL_CACHE_ADAPTERS, findVinextCacheConfigInPlugins, generateCacheAdaptersModule, loadVinextCacheConfigFromViteConfig };
