//#region src/shims/internal/utils.ts
/**
* Standard Next.js error shape.
*/
function execOnce(fn) {
	let used = false;
	let result;
	return ((...args) => {
		if (!used) {
			used = true;
			result = fn(...args);
		}
		return result;
	});
}
function getLocationOrigin() {
	if (typeof window !== "undefined") return window.location.origin;
	return "http://localhost";
}
function getURL() {
	if (typeof window !== "undefined") return window.location.href;
	return "http://localhost/";
}
const SP = typeof performance !== "undefined";
const ST = SP && typeof performance.mark === "function";
//#endregion
export { SP, ST, execOnce, getLocationOrigin, getURL };
