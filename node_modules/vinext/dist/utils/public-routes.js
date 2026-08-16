import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import fs from "node:fs";
//#region src/utils/public-routes.ts
function scanPublicFileRoutes(root) {
	const publicDir = path.join(root, "public");
	const routes = [];
	const visitedDirs = /* @__PURE__ */ new Set();
	function walk(dir) {
		let realDir;
		try {
			realDir = fs.realpathSync(dir);
		} catch {
			return;
		}
		if (visitedDirs.has(realDir)) return;
		visitedDirs.add(realDir);
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(fullPath);
				continue;
			}
			if (entry.isSymbolicLink()) {
				let stat;
				try {
					stat = fs.statSync(fullPath);
				} catch {
					continue;
				}
				if (stat.isDirectory()) {
					walk(fullPath);
					continue;
				}
				if (!stat.isFile()) continue;
			} else if (!entry.isFile()) continue;
			const relativePath = path.relative(publicDir, fullPath);
			routes.push("/" + relativePath);
		}
	}
	if (fs.existsSync(publicDir)) try {
		walk(publicDir);
	} catch {}
	routes.sort();
	return routes;
}
//#endregion
export { scanPublicFileRoutes };
