//#region src/utils/number.ts
function isNonNegativeSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
//#endregion
export { isNonNegativeSafeInteger };
