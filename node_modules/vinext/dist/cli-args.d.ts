//#region src/cli-args.d.ts
/**
 * CLI argument parser for the vinext CLI.
 *
 * Parses flags for `vinext dev`, `vinext start`, `vinext build`, etc.
 * Validates that value-taking flags (`--port`, `--hostname`) have actual values
 * rather than silently consuming the next flag or returning NaN/undefined.
 */
type ParsedArgs = {
  port?: number;
  hostname?: string;
  help?: boolean;
  verbose?: boolean;
  turbopack?: boolean;
  experimental?: boolean;
  prerenderAll?: boolean;
  prerenderConcurrency?: number;
  precompress?: boolean;
  positionals?: string[];
};
/**
 * Parse CLI arguments into a structured object.
 *
 * Handles both `--flag value` and `--flag=value` forms for value-taking flags.
 *
 * Used by `vinext dev`, `build`, `start`, `lint`, `check`, and `init` commands.
 * The `deploy` command uses `parseDeployArgs` (a `node:util` wrapper) for its
 * own flag set including `--env`, `--skip-build`, etc.
 */
declare function parseArgs(args: string[]): ParsedArgs;
//#endregion
export { parseArgs };