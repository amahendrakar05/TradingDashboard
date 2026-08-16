//#region src/utils/record.ts
function isUnknownRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
//#endregion
export { isUnknownRecord };
