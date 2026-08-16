//#region src/utils/compare.ts
const compareStrings = (left, right) => {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
};
//#endregion
export { compareStrings };
