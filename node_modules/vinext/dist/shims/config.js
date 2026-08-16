//#region src/shims/config.ts
let runtimeConfig = {
	serverRuntimeConfig: {},
	publicRuntimeConfig: {}
};
/**
* Set the runtime config. Called during app bootstrap (by the plugin)
* with values from next.config.js.
*/
function setConfig(configValue) {
	runtimeConfig = configValue;
}
/**
* Get the current runtime config.
* Default export — matches `import getConfig from "next/config"`.
*/
function getConfig() {
	return runtimeConfig;
}
//#endregion
export { getConfig as default, setConfig };
