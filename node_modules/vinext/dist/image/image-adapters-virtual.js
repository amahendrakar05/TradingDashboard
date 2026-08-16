//#region src/image/image-adapters-virtual.ts
/** Public virtual module id imported by the server entries. */
const VIRTUAL_IMAGE_ADAPTERS = "virtual:vinext-image-adapters";
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
		throw new Error(`[vinext] image adapter "${adapter}" options must be JSON-serializable.`, { cause });
	}
}
/**
* Generate the source of the `virtual:vinext-image-adapters` module for the
* given config. Always exports `registerConfiguredImageOptimizer(env)`.
*/
function generateImageAdaptersModule(images) {
	const optimizer = images?.optimizer;
	if (!optimizer?.adapter) return [
		"// vinext: no images.optimizer adapter configured — registration is a no-op.",
		"export function registerConfiguredImageOptimizer() {}",
		""
	].join("\n");
	return [
		"// vinext: generated from the `images` option in your vinext() plugin config.",
		`import __vinextImageOptimizerFactory from ${JSON.stringify(optimizer.adapter)};`,
		`import { setImageOptimizer } from "vinext/server/image-optimization";`,
		"",
		"// A factory that throws (e.g. a missing binding on an incompatible runtime)",
		"// is logged and skipped so images fall back to unoptimized passthrough.",
		"function __vinextFormatAdapterError(error) {",
		"  if (error instanceof Error && error.message) return error.message;",
		"  try {",
		"    return String(error);",
		"  } catch {",
		"    return '<unknown error>';",
		"  }",
		"}",
		"",
		"let __vinextImageOptimizerRegistered = false;",
		"",
		"export function registerConfiguredImageOptimizer(env) {",
		"  if (typeof process !== 'undefined' && process.env?.__VINEXT_PRERENDER_PATH_DISCOVERY === '1') return;",
		"  if (__vinextImageOptimizerRegistered) return;",
		"  __vinextImageOptimizerRegistered = true;",
		"  try {",
		`    setImageOptimizer(__vinextImageOptimizerFactory({ env, options: ${inlineOptions(optimizer.adapter, optimizer.options)} }));`,
		"  } catch (error) {",
		"    console.warn(\"[vinext] failed to initialize the configured image optimizer; serving images unoptimized.\\n\" + __vinextFormatAdapterError(error));",
		"  }",
		"}",
		""
	].join("\n");
}
//#endregion
export { VIRTUAL_IMAGE_ADAPTERS, generateImageAdaptersModule };
