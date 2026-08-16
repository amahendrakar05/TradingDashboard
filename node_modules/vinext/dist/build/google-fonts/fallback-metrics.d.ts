//#region src/build/google-fonts/fallback-metrics.d.ts
type AdjustFontFallback = {
  fallbackFont: string;
  ascentOverride: string;
  descentOverride: string;
  lineGapOverride: string;
  sizeAdjust: string;
};
declare function getFallbackFontOverrideMetrics(fontFamily: string): AdjustFontFallback | undefined;
declare function buildFallbackFontFace(family: string, metrics: AdjustFontFallback): string;
//#endregion
export { buildFallbackFontFace, getFallbackFontOverrideMetrics };