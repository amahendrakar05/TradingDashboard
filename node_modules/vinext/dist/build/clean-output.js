import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/build/clean-output.ts
function resolveOutDir(root, outDir) {
	const resolvedRoot = path.resolve(root);
	if (!outDir) return path.join(resolvedRoot, "dist");
	return path.isAbsolute(outDir) ? outDir : path.resolve(resolvedRoot, outDir);
}
function isPathInsideOrEqual(parent, child) {
	const relative = path.relative(parent, child);
	return relative === "" || !relative.startsWith("..") && !path.isAbsolute(relative);
}
function shouldCleanBuildOutput(options) {
	if (options.emptyOutDir === false) return false;
	if (options.emptyOutDir === true) return true;
	return isPathInsideOrEqual(path.resolve(options.root), resolveOutDir(options.root, options.outDir));
}
function cleanBuildOutput(options) {
	const outDir = resolveOutDir(options.root, options.outDir);
	if (!shouldCleanBuildOutput(options)) return {
		cleaned: false,
		outDir
	};
	fs.rmSync(outDir, {
		recursive: true,
		force: true
	});
	return {
		cleaned: true,
		outDir
	};
}
//#endregion
export { cleanBuildOutput };
