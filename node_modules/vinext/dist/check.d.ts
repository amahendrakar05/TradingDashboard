//#region src/check.d.ts
/**
 * vinext check — compatibility scanner for Next.js apps
 *
 * Scans an existing Next.js app and produces a compatibility report
 * showing what will work, what needs changes, and an overall score.
 */
type Status = "supported" | "partial" | "unsupported";
type CheckItem = {
  name: string;
  status: Status;
  detail?: string;
  files?: string[];
};
type CheckResult = {
  imports: CheckItem[];
  config: CheckItem[];
  libraries: CheckItem[];
  conventions: CheckItem[];
  summary: {
    supported: number;
    partial: number;
    unsupported: number;
    total: number;
    score: number;
  };
};
/**
 * Report whether `content` makes a free use of the CommonJS globals `__dirname` or
 * `__filename` in real code — i.e. not inside a string literal, comment, regex
 * literal, or plain template literal. Identifiers inside a template expression
 * (`` `${__dirname}` ``) DO count, since that is real code.
 *
 * This is a hand-written single-pass scanner rather than a regex on purpose. The
 * previous implementation used an alternation regex whose string-body sub-pattern
 * `(?:[^"\\]|\\.)*` is a star over an alternation group; V8 cannot compile that into
 * a tight loop, so it pushes one backtrack frame per character and overflows the
 * regex stack ("Maximum call stack size exceeded") on very large files — e.g. a
 * multi-megabyte minified bundle or a long/unterminated string literal. This scanner
 * runs in O(n) time and O(template-nesting) stack, so it cannot blow up on large input.
 *
 * It is a lexer-grade scanner, not a parser: it tracks just enough state (string /
 * template / comment / regex contexts, and whether a `/` is in expression position)
 * to avoid mistaking quotes inside one context for the start of another. Where the
 * division-vs-regex distinction is ambiguous it biases toward division, because a
 * misread division is usually harmless (it never consumes a following identifier)
 * whereas a misread regex would swallow the rest of the line and could hide a later
 * __dirname.
 *
 * Known limitation: telling a value-position regex literal apart from division after
 * a `}` needs real parser context (was the `}` a block or an object?). We bias to
 * division, so a regex used in value position — e.g. a statement-start regex after a
 * block `}`, like `function f(){} /'/.test(x)` — is read as division; if its body
 * contains an unpaired quote/backtick, that quote opens a string that can mask a
 * __dirname *on the same line*. This is rare in hand-written source, the multi-line
 * case is unaffected (string scanning stops at the newline), and the check is only
 * advisory — so we accept it rather than pull in a full parser.
 */
declare function hasFreeCjsGlobal(content: string): boolean;
/**
 * Scan source files for `import ... from 'next/...'` statements.
 */
declare function scanImports(root: string): CheckItem[];
/**
 * Analyze next.config.js/mjs/ts for supported and unsupported options.
 */
declare function analyzeConfig(root: string): CheckItem[];
/**
 * Check package.json dependencies for known libraries.
 */
declare function checkLibraries(root: string): CheckItem[];
/**
 * Check file conventions (pages, app directory, middleware, etc.)
 */
declare function checkConventions(root: string): CheckItem[];
/**
 * Run the full compatibility check.
 */
declare function runCheck(root: string): CheckResult;
/**
 * Format the check result as a colored terminal report.
 */
declare function formatReport(result: CheckResult, opts?: {
  calledFromInit?: boolean;
}): string;
//#endregion
export { CheckResult, analyzeConfig, checkConventions, checkLibraries, formatReport, hasFreeCjsGlobal, runCheck, scanImports };