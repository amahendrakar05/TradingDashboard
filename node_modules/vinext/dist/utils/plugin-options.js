//#region src/utils/plugin-options.ts
async function flattenPluginOptions(value) {
	if (value instanceof Promise) return flattenPluginOptions(await value);
	if (Array.isArray(value)) return (await Promise.all(value.map((item) => flattenPluginOptions(item)))).flat();
	return value ? [value] : [];
}
//#endregion
export { flattenPluginOptions };
