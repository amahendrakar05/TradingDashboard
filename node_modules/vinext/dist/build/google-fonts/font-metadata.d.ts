//#region src/build/google-fonts/font-metadata.d.ts
type VariableAxisDescriptor = {
  tag: string;
  min: number;
  max: number;
  defaultValue: number;
};
type FontFamilyMetadata = {
  /** Available weight values, plus the literal "variable" if a variable face exists. */weights: string[]; /** Available styles, e.g. ["normal"], ["italic"], or both. */
  styles: string[]; /** Variable axes for this family. Absent when the family has no variable face. */
  axes?: VariableAxisDescriptor[]; /** Preloadable subsets (e.g. "latin", "latin-ext", "vietnamese"). */
  subsets: string[];
};
declare const googleFontsMetadata: Record<string, FontFamilyMetadata>;
//#endregion
export { googleFontsMetadata };