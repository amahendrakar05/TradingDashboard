//#region src/build/google-fonts/validate.d.ts
type GoogleFontOptions = {
  weight?: string | string[];
  style?: string | string[];
  preload?: boolean;
  display?: string;
  axes?: string[];
  fallback?: string[];
  adjustFontFallback?: boolean;
  variable?: string;
  subsets?: string[];
};
type ValidatedGoogleFontOptions = {
  fontFamily: string;
  weights: string[];
  styles: string[];
  display: string;
  preload: boolean;
  selectedVariableAxes?: string[];
  fallback?: string[];
  adjustFontFallback: boolean;
  variable?: string;
  subsets: string[];
};
declare function validateGoogleFontOptions(fontFamily: string, options: GoogleFontOptions): ValidatedGoogleFontOptions;
//#endregion
export { validateGoogleFontOptions };