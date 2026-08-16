//#region src/utils/sorted-array.ts
function findSortedStringPosition(values, candidate) {
	let lower = 0;
	let upper = values.length;
	while (lower < upper) {
		const middle = lower + Math.floor((upper - lower) / 2);
		if (values[middle] === candidate) return {
			found: true,
			index: middle
		};
		if (values[middle] < candidate) lower = middle + 1;
		else upper = middle;
	}
	return {
		found: false,
		index: lower
	};
}
//#endregion
export { findSortedStringPosition };
