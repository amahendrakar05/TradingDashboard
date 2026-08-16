//#region src/server/dev-lockfile.d.ts
/**
 * Dev server lock file.
 *
 * Writes the running dev server's PID, port, and URL into a lock file at
 * `<root>/.vinext/dev/lock.json`. When a second `vinext dev` process starts in
 * the same project directory, it reads the lock file and either fails with an
 * actionable error or, if the previous process is dead, takes over the lock.
 *
 * This is especially useful for AI coding agents, which frequently attempt to
 * start `vinext dev` without knowing a server is already running.
 *
 * Ported behaviorally from Next.js:
 *   https://github.com/vercel/next.js/blob/canary/packages/next/src/build/lockfile.ts
 *
 * Differences vs Next.js:
 * - No native `flock()`. Next.js uses Rust SWC bindings for cross-platform
 *   advisory locking; vinext uses a JSON file plus a PID liveness check
 *   (`process.kill(pid, 0)`), which is good enough for the dev-server
 *   "another server is running" use case. Race conditions on lock acquisition
 *   are tolerated: at worst, two dev servers race and one fails to bind a port.
 * - Lock file lives in `<root>/.vinext/dev/lock.json` (mirroring Next.js'
 *   `.next/dev/lock` layout). `.vinext/` is already used by the fonts plugin
 *   to cache self-hosted Google Fonts, so this re-uses the same project-local
 *   state directory rather than polluting `node_modules`.
 */
/**
 * Information about a running dev server, stored inside the lock file itself.
 */
type DevServerInfo = {
  pid: number;
  port: number;
  hostname: string;
  appUrl: string;
  startedAt: number; /** Project directory the server is running in. Used to detect stale entries. */
  cwd: string;
};
type DevLockfile = {
  /** Update the lock file contents (e.g. once the port is known after listen). */update(info: DevServerInfo): void; /** Release the lock — deletes the file. Safe to call multiple times. */
  release(): void; /** Absolute path to the lock file. */
  path: string;
};
/**
 * Returns the absolute path to the lock file for a given project root.
 */
declare function getLockfilePath(root: string): string;
/**
 * Reads and parses the lock file at the given path. Returns `undefined` if the
 * file doesn't exist or can't be parsed.
 */
declare function readLockfile(lockfilePath: string): DevServerInfo | undefined;
/**
 * Returns true if a process with the given PID is running.
 *
 * Uses `process.kill(pid, 0)`, which sends a null signal — it doesn't actually
 * kill the process, it just checks if it exists. Throws `ESRCH` if the process
 * doesn't exist, or `EPERM` if it exists but we don't have permission to
 * signal it (in which case it's still running, just owned by someone else).
 */
declare function isPidAlive(pid: number): boolean;
type FormatErrorOptions = {
  /** Existing server info from the lock file, if readable. */existing: DevServerInfo | undefined; /** Project directory the new (failing) process is trying to run in. */
  cwd: string; /** Path to the lock file. */
  lockfilePath: string;
};
/**
 * Format the error message printed when another dev server is already running.
 *
 * Matches Next.js' error layout so AI agents and CLIs can parse the same
 * `- PID: ` / `- Local: ` lines.
 *
 * The `existing: undefined` branch below is defensive — `tryAcquireLockfile`
 * currently only returns `ok: false` with a defined `existing`, but the
 * formatter is exported and unit-tested separately, so it handles both shapes.
 */
declare function formatAlreadyRunningError(opts: FormatErrorOptions): string;
type AcquireOptions = {
  /** Project root. Lock file goes in `<root>/.vinext/dev/lock.json`. */root: string; /** Initial server info to write. Port/URL may be updated later via `update()`. */
  info: DevServerInfo;
  /**
   * If a lock file exists but its PID is dead, take over instead of failing.
   * Defaults to `true`. Set to `false` for testing.
   */
  takeOverStale?: boolean; /** Register `process.on('exit', release)`. Defaults to `true`. */
  unlockOnExit?: boolean;
};
type AcquireSuccess = {
  ok: true;
  lockfile: DevLockfile;
};
type AcquireFailure = {
  ok: false; /** The server info from the existing lock file, if readable. */
  existing: DevServerInfo | undefined; /** Absolute path to the lock file. */
  lockfilePath: string;
};
type AcquireResult = AcquireSuccess | AcquireFailure;
/**
 * Try to acquire the dev lock file for the given project root.
 *
 * Returns `{ ok: true, lockfile }` on success — the caller should call
 * `lockfile.release()` on shutdown (or rely on the exit listener registered
 * via `unlockOnExit`).
 *
 * Returns `{ ok: false, existing, lockfilePath }` if another live dev server
 * already holds the lock.
 */
declare function tryAcquireLockfile(opts: AcquireOptions): AcquireResult;
//#endregion
export { DevLockfile, DevServerInfo, formatAlreadyRunningError, getLockfilePath, isPidAlive, readLockfile, tryAcquireLockfile };