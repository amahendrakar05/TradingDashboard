import { googleFontsMetadata } from "./font-metadata.js";
//#region src/build/google-fonts/validate.ts
const ALLOWED_DISPLAY_VALUES = [
	"auto",
	"block",
	"swap",
	"fallback",
	"optional"
];
const formatAvailableValues = (values) => values.map((val) => `\`${val}\``).join(", ");
const dedupe = (values) => Array.from(new Set(values));
function validateGoogleFontOptions(fontFamily, options) {
	const { weight, style, display = "swap", axes, fallback, adjustFontFallback = true, variable, subsets = [] } = options;
	let preload = options.preload ?? true;
	const fontFamilyData = googleFontsMetadata[fontFamily];
	if (!fontFamilyData) throw new Error(`Unknown font \`${fontFamily}\``);
	if (axes !== void 0 && !Array.isArray(axes)) throw new Error(`Invalid axes value for font \`${fontFamily}\`, expected an array of axis names.`);
	const availableSubsets = fontFamilyData.subsets;
	if (availableSubsets.length === 0) preload = false;
	else if (preload) {
		if (subsets.length === 0) throw new Error(`Preload is enabled but no subsets were specified for font \`${fontFamily}\`. Please specify subsets or disable preloading if your intended subset can't be preloaded.\nAvailable subsets: ${formatAvailableValues(availableSubsets)}`);
		for (const subset of subsets) if (!availableSubsets.includes(subset)) throw new Error(`Unknown subset \`${subset}\` for font \`${fontFamily}\`.\nAvailable subsets: ${formatAvailableValues(availableSubsets)}`);
	}
	const fontWeights = fontFamilyData.weights;
	const fontStyles = fontFamilyData.styles;
	const weights = !weight ? [] : dedupe(Array.isArray(weight) ? weight : [weight]);
	const styles = !style ? [] : dedupe(Array.isArray(style) ? style : [style]);
	if (weights.length === 0) if (fontWeights.includes("variable")) weights.push("variable");
	else throw new Error(`Missing weight for font \`${fontFamily}\`.\nAvailable weights: ${formatAvailableValues(fontWeights)}`);
	if (weights.length > 1 && weights.includes("variable")) throw new Error(`Unexpected \`variable\` in weight array for font \`${fontFamily}\`. You only need \`variable\`, it includes all available weights.`);
	for (const selectedWeight of weights) if (!fontWeights.includes(selectedWeight)) throw new Error(`Unknown weight \`${selectedWeight}\` for font \`${fontFamily}\`.\nAvailable weights: ${formatAvailableValues(fontWeights)}`);
	if (styles.length === 0) if (fontStyles.length === 1) styles.push(fontStyles[0]);
	else styles.push("normal");
	for (const selectedStyle of styles) if (!fontStyles.includes(selectedStyle)) throw new Error(`Unknown style \`${selectedStyle}\` for font \`${fontFamily}\`.\nAvailable styles: ${formatAvailableValues(fontStyles)}`);
	if (!ALLOWED_DISPLAY_VALUES.includes(display)) throw new Error(`Invalid display value \`${display}\` for font \`${fontFamily}\`.\nAvailable display values: ${formatAvailableValues(ALLOWED_DISPLAY_VALUES)}`);
	if (axes) {
		if (!fontWeights.includes("variable")) throw new Error("Axes can only be defined for variable fonts.");
		if (weights[0] !== "variable") throw new Error("Axes can only be defined for variable fonts when the weight property is nonexistent or set to `variable`.");
	}
	return {
		fontFamily,
		weights,
		styles,
		display,
		preload,
		selectedVariableAxes: axes,
		fallback,
		adjustFontFallback,
		variable,
		subsets
	};
}
//#endregion
export { validateGoogleFontOptions };
