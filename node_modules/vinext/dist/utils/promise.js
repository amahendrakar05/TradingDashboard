//#region src/utils/promise.ts
function isPromiseLike(value) {
	return Boolean(value && (typeof value === "object" || typeof value === "function") && "then" in value && typeof value.then === "function");
}
//#endregion
export { isPromiseLike };
