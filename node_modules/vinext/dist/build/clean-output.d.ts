//#region src/build/clean-output.d.ts
type CleanBuildOutputOptions = {
  root: string;
  outDir?: string;
  emptyOutDir?: boolean;
};
type CleanBuildOutputResult = {
  cleaned: boolean;
  outDir: string;
};
declare function cleanBuildOutput(options: CleanBuildOutputOptions): CleanBuildOutputResult;
//#endregion
export { cleanBuildOutput };