import { googleFontsMetadata } from "./font-metadata.js";
//#region src/build/google-fonts/get-axes.ts
const formatAvailableValues = (values) => values.map((val) => `\`${val}\``).join(", ");
function getFontAxes(fontFamily, weights, styles, selectedVariableAxes) {
	const hasItalic = styles.includes("italic");
	const hasNormal = styles.includes("normal");
	const ital = hasItalic ? [...hasNormal ? ["0"] : [], "1"] : void 0;
	if (weights[0] === "variable") {
		const allAxes = googleFontsMetadata[fontFamily].axes;
		if (!allAxes) throw new Error("invariant variable font without axes");
		if (selectedVariableAxes) {
			const definableAxes = allAxes.map(({ tag }) => tag).filter((tag) => tag !== "wght");
			if (definableAxes.length === 0) throw new Error(`Font \`${fontFamily}\` has no definable \`axes\``);
			if (!Array.isArray(selectedVariableAxes)) throw new Error(`Invalid axes value for font \`${fontFamily}\`, expected an array of axes.\nAvailable axes: ${formatAvailableValues(definableAxes)}`);
			for (const key of selectedVariableAxes) if (!definableAxes.includes(key)) throw new Error(`Invalid axes value \`${key}\` for font \`${fontFamily}\`.\nAvailable axes: ${formatAvailableValues(definableAxes)}`);
		}
		let weightAxis;
		let variableAxes;
		for (const { tag, min, max } of allAxes) if (tag === "wght") weightAxis = `${min}..${max}`;
		else if (selectedVariableAxes?.includes(tag)) {
			if (!variableAxes) variableAxes = [];
			variableAxes.push([tag, `${min}..${max}`]);
		}
		return {
			wght: weightAxis ? [weightAxis] : void 0,
			ital,
			variableAxes
		};
	}
	return {
		wght: weights,
		ital,
		variableAxes: void 0
	};
}
//#endregion
export { getFontAxes };
