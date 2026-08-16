//#region src/build/google-fonts/sort-variants.ts
function sortFontsVariantValues(valA, valB) {
	if (valA.includes(",") && valB.includes(",")) {
		const [aPrefix, aSuffix] = valA.split(",", 2);
		const [bPrefix, bSuffix] = valB.split(",", 2);
		if (aPrefix === bPrefix) return parseInt(aSuffix) - parseInt(bSuffix);
		return parseInt(aPrefix) - parseInt(bPrefix);
	}
	return parseInt(valA) - parseInt(valB);
}
//#endregion
export { sortFontsVariantValues };
