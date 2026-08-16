//#region src/shims/error.react-server.ts
function unstable_catchError() {
	throw new Error("`unstable_catchError` can only be used in Client Components.");
}
//#endregion
export { unstable_catchError };
