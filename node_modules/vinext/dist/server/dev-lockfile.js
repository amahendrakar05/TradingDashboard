import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/server/dev-lockfile.ts
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
const LOCK_DIR_RELATIVE = path.join(".vinext", "dev");
const LOCK_FILE_NAME = "lock.json";
/**
* Returns the absolute path to the lock file for a given project root.
*/
function getLockfilePath(root) {
	return path.join(root, LOCK_DIR_RELATIVE, LOCK_FILE_NAME);
}
/**
* Reads and parses the lock file at the given path. Returns `undefined` if the
* file doesn't exist or can't be parsed.
*/
function readLockfile(lockfilePath) {
	let content;
	try {
		content = fs.readFileSync(lockfilePath, "utf-8");
	} catch {
		return;
	}
	try {
		const parsed = JSON.parse(content);
		if (typeof parsed.pid === "number" && typeof parsed.port === "number" && typeof parsed.hostname === "string" && typeof parsed.appUrl === "string" && typeof parsed.startedAt === "number" && typeof parsed.cwd === "string") return parsed;
		return;
	} catch {
		return;
	}
}
/**
* Returns true if a process with the given PID is running.
*
* Uses `process.kill(pid, 0)`, which sends a null signal — it doesn't actually
* kill the process, it just checks if it exists. Throws `ESRCH` if the process
* doesn't exist, or `EPERM` if it exists but we don't have permission to
* signal it (in which case it's still running, just owned by someone else).
*/
function isPidAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return err.code === "EPERM";
	}
}
/**
* Writes the lock file with the given content. Creates the parent directory
* if it doesn't exist.
*
* Mode `0o600` because the lock file contains a PID that, in principle, lets
* other users on the machine send signals to this user's dev server.
* Restricting reads is defense-in-depth: the PID is also discoverable via
* `ps` and the port via `netstat`/`ss`, so this isn't load-bearing.
*/
function writeLockfile(lockfilePath, info) {
	fs.mkdirSync(path.dirname(lockfilePath), { recursive: true });
	fs.writeFileSync(lockfilePath, JSON.stringify(info, null, 2), { mode: 384 });
}
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
function formatAlreadyRunningError(opts) {
	const { existing, cwd, lockfilePath } = opts;
	if (!existing) return [
		"Another vinext dev server appears to be running in this directory.",
		"",
		`Stale lock file: ${path.relative(cwd, lockfilePath)}`,
		"Remove it manually if no server is running, then re-run `vinext dev`."
	].join("\n");
	const killCommand = process.platform === "win32" ? `taskkill /PID ${existing.pid} /F` : `kill ${existing.pid}`;
	return [
		"Another vinext dev server is already running.",
		"",
		`- Local:        ${existing.appUrl}`,
		`- PID:          ${existing.pid}`,
		`- Dir:          ${existing.cwd}`,
		"",
		`You can access the existing server at ${existing.appUrl},`,
		`or run \`${killCommand}\` to stop it and start a new one.`
	].join("\n");
}
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
function tryAcquireLockfile(opts) {
	const { root, info, takeOverStale = true, unlockOnExit = true } = opts;
	const lockfilePath = getLockfilePath(root);
	const existing = readLockfile(lockfilePath);
	if (existing) {
		if (isPidAlive(existing.pid)) return {
			ok: false,
			existing,
			lockfilePath
		};
		if (!takeOverStale) return {
			ok: false,
			existing,
			lockfilePath
		};
	}
	writeLockfile(lockfilePath, info);
	const ownerPid = info.pid;
	let released = false;
	const release = () => {
		if (released) return;
		released = true;
		try {
			const current = readLockfile(lockfilePath);
			if (current && current.pid === ownerPid) fs.unlinkSync(lockfilePath);
		} catch {}
	};
	let exitListener;
	if (unlockOnExit) {
		exitListener = () => release();
		process.on("exit", exitListener);
	}
	return {
		ok: true,
		lockfile: {
			path: lockfilePath,
			update(next) {
				try {
					writeLockfile(lockfilePath, next);
				} catch {}
			},
			release() {
				release();
				if (exitListener) {
					process.off("exit", exitListener);
					exitListener = void 0;
				}
			}
		}
	};
}
//#endregion
export { formatAlreadyRunningError, getLockfilePath, isPidAlive, readLockfile, tryAcquireLockfile };
