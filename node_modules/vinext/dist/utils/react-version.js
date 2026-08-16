import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { createRequire } from "node:module";
import fs from "node:fs";
//#region src/utils/react-version.ts
function getDependencyUpgradeDeps(root, recommendations) {
	const req = createRequire(path.join(root, "package.json"));
	for (const [dependency, recommendation] of Object.entries(recommendations)) try {
		const version = findPackageVersion(req.resolve(dependency), dependency);
		if (version && isVersionBelow(version, recommendation.minimumVersion)) return recommendation.upgrades;
	} catch {
		continue;
	}
	return [];
}
function getReactUpgradeDeps(root) {
	return getDependencyUpgradeDeps(root, { react: {
		minimumVersion: [
			19,
			2,
			6
		],
		upgrades: ["react@latest", "react-dom@latest"]
	} });
}
function isVersionBelow(version, minimum) {
	const current = version.split(".").map((part) => parseInt(part, 10));
	for (let index = 0; index < minimum.length; index++) if ((current[index] ?? 0) !== minimum[index]) return (current[index] ?? 0) < minimum[index];
	return false;
}
/** Walk up from a resolved module entry to find its package version. */
function findPackageVersion(resolvedEntry, packageName) {
	let dir = path.dirname(resolvedEntry);
	while (dir !== path.dirname(dir)) {
		const candidate = path.join(dir, "package.json");
		try {
			const pkg = JSON.parse(fs.readFileSync(candidate, "utf-8"));
			if (pkg.name === packageName) return pkg.version ?? null;
		} catch {}
		dir = path.dirname(dir);
	}
	return null;
}
//#endregion
export { getReactUpgradeDeps };
