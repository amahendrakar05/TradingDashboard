//#region src/build/google-fonts/build-url.d.ts
type FontAxes = {
  /** Weight values: explicit faces ("400") or a variable range ("400..800"). */wght?: string[]; /** Ital values, "0" (normal) and/or "1" (italic). */
  ital?: string[]; /** Other variable axes the caller wants to include, e.g. `[["opsz","14..32"]]`. */
  variableAxes?: [string, string][];
};
declare function buildGoogleFontsUrl(fontFamily: string, axes: FontAxes, display: string): string;
//#endregion
export { FontAxes, buildGoogleFontsUrl };