//#region src/server/edge-api-runtime.ts
function isEdgeApiRuntime(runtime) {
	return runtime === "edge" || runtime === "experimental-edge";
}
//#endregion
export { isEdgeApiRuntime };
