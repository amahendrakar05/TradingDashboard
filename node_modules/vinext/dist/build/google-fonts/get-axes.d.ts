import { FontAxes } from "./build-url.js";

//#region src/build/google-fonts/get-axes.d.ts
declare function getFontAxes(fontFamily: string, weights: string[], styles: string[], selectedVariableAxes?: string[]): FontAxes;
//#endregion
export { getFontAxes };