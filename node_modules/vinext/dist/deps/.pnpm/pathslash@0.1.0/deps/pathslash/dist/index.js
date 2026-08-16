import nodePath from "node:path";
//#region ../../node_modules/.pnpm/pathslash@0.1.0/node_modules/pathslash/dist/index.mjs
const BACKSLASH_RE = /\\/g;
const isWindows = process.platform === "win32";
/**
* Flip backslashes to forward slashes, used to slash-ify `node:path.win32`
* output. `\\?\` (extended-length) paths are left untouched: there a forward
* slash is a literal character, not a separator.
*/
const toForwardSlash = (path) => path.startsWith("\\\\?\\") ? path : path.replace(BACKSLASH_RE, "/");
/**
* Normalize separators to `/`, safely. On Windows it converts `\` to `/`. On
* POSIX it does nothing, because there a backslash is a legal filename character
* and rewriting it would corrupt the path.
*/
function toSlash(path) {
	return isWindows ? toForwardSlash(path) : path;
}
const w = nodePath.win32;
function slashed(fn) {
	return (...args) => toForwardSlash(fn(...args));
}
const win32 = {
	resolve: slashed(w.resolve),
	normalize: slashed(w.normalize),
	join: slashed(w.join),
	relative: slashed(w.relative),
	dirname: slashed(w.dirname),
	format: slashed(w.format),
	parse: (path) => {
		const parsed = w.parse(path);
		parsed.root = toForwardSlash(parsed.root);
		parsed.dir = toForwardSlash(parsed.dir);
		return parsed;
	},
	basename: w.basename,
	extname: w.extname,
	isAbsolute: w.isAbsolute,
	matchesGlob: w.matchesGlob,
	toNamespacedPath: w.toNamespacedPath,
	delimiter: w.delimiter,
	sep: "/"
};
const posix = { ...nodePath.posix };
posix.posix = win32.posix = posix;
posix.win32 = win32.win32 = win32;
const path = isWindows ? win32 : posix;
const { basename, delimiter, dirname, extname, format, isAbsolute, join, matchesGlob, normalize, parse, relative, resolve, sep, toNamespacedPath } = path;
//#endregion
export { path as default, posix, toSlash, win32 };
