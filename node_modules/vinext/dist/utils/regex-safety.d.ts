//#region src/utils/regex-safety.d.ts
type RegexSafetyIssue = "nested repetition" | "ambiguous alternatives under repetition" | "ambiguous sequence expansion" | "overlapping sequential repetition" | "analysis budget exceeded";
declare function analyzeRegexSafety(pattern: string, options?: {
  ignoreCase?: boolean;
}): RegexSafetyIssue | null;
declare function regexAtomsMayOverlap(left: string, right: string, ignoreCase?: boolean): boolean;
//#endregion
export { RegexSafetyIssue, analyzeRegexSafety, regexAtomsMayOverlap };