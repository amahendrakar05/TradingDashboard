import { escapeCSSString } from "../../shims/font-utils.js";
import fallback_metrics_data_default from "./fallback-metrics-data.json.js";
//#region src/build/google-fonts/fallback-metrics.ts
const EXPECTED_METRIC_LENGTH = 6;
const fallbackMetrics = fallback_metrics_data_default;
function formatName(value) {
	return value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, "");
}
function formatOverrideValue(value) {
	return Math.abs(value * 100).toFixed(2);
}
function getFallbackFontOverrideMetrics(fontFamily) {
	const metric = fallbackMetrics[formatName(fontFamily)];
	if (!metric || metric.length !== EXPECTED_METRIC_LENGTH) return void 0;
	const [serifFlag, ascent, descent, lineGap, unitsPerEm, xWidthAvg] = metric;
	if (unitsPerEm === 0) return void 0;
	const fallbackFont = serifFlag === 1 ? "Times New Roman" : "Arial";
	const fallbackMetric = fallbackMetrics[formatName(fallbackFont)];
	if (!fallbackMetric || fallbackMetric.length !== EXPECTED_METRIC_LENGTH) return void 0;
	const [, , , , fallbackUnitsPerEm, fallbackXWidthAvg] = fallbackMetric;
	if (fallbackUnitsPerEm === 0) return void 0;
	const mainFontAvgWidth = xWidthAvg / unitsPerEm;
	const fallbackFontAvgWidth = fallbackXWidthAvg / fallbackUnitsPerEm;
	const sizeAdjust = xWidthAvg && fallbackFontAvgWidth ? mainFontAvgWidth / fallbackFontAvgWidth : 1;
	return {
		fallbackFont,
		ascentOverride: `${formatOverrideValue(ascent / (unitsPerEm * sizeAdjust))}%`,
		descentOverride: `${formatOverrideValue(descent / (unitsPerEm * sizeAdjust))}%`,
		lineGapOverride: `${formatOverrideValue(lineGap / (unitsPerEm * sizeAdjust))}%`,
		sizeAdjust: `${formatOverrideValue(sizeAdjust)}%`
	};
}
function buildFallbackFontFace(family, metrics) {
	return `@font-face {
  font-family: ${`'${escapeCSSString(family)} Fallback'`};
  src: local("${escapeCSSString(metrics.fallbackFont)}");
  ascent-override: ${metrics.ascentOverride};
  descent-override: ${metrics.descentOverride};
  line-gap-override: ${metrics.lineGapOverride};
  size-adjust: ${metrics.sizeAdjust};
}\n`;
}
//#endregion
export { buildFallbackFontFace, getFallbackFontOverrideMetrics };
