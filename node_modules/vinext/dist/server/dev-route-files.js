import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { METADATA_FILE_MAP, matchMetadataFileBaseName } from "./metadata-routes.js";
//#region src/server/dev-route-files.ts
const APP_ROUTER_STRUCTURE_FILES = [
	"page",
	"route",
	"layout",
	"default",
	"template",
	"loading",
	"error",
	"not-found",
	"forbidden",
	"unauthorized"
];
function isInsideDirectory(dir, filePath) {
	const relativePath = path.relative(dir, filePath);
	return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}
function relativeParts(dir, filePath) {
	return path.relative(dir, filePath).split(path.sep).filter(Boolean);
}
function isPrivateAppPath(parts) {
	return parts.slice(0, -1).some((part) => part.startsWith("_"));
}
function visibleRoutePrefix(parts) {
	const visibleParts = parts.slice(0, -1).filter((part) => !(part.startsWith("(") && part.endsWith(")")) && !part.startsWith("@"));
	return visibleParts.length === 0 ? "" : `/${visibleParts.join("/")}`;
}
function stripLastExtension(fileName) {
	const extension = path.extname(fileName);
	return {
		baseName: extension ? fileName.slice(0, -extension.length) : fileName,
		extension
	};
}
function isAppRouterStructureFile(fileName, matcher) {
	const { baseName } = stripLastExtension(fileName);
	return APP_ROUTER_STRUCTURE_FILES.includes(baseName) && matcher.extensionRegex.test(fileName);
}
function isRootGlobalError(parts, matcher) {
	if (parts.length !== 1) return false;
	const fileName = parts[0];
	if (!fileName) return false;
	const { baseName } = stripLastExtension(fileName);
	return baseName === "global-error" && matcher.extensionRegex.test(fileName);
}
function isMetadataRouteFile(parts) {
	const fileName = parts[parts.length - 1];
	if (!fileName) return false;
	if (fileName.endsWith(".alt.txt")) {
		const imageBaseName = fileName.slice(0, -8);
		return matchMetadataFileBaseName("opengraph-image", imageBaseName) !== null || matchMetadataFileBaseName("twitter-image", imageBaseName) !== null;
	}
	const { baseName, extension } = stripLastExtension(fileName);
	if (!extension) return false;
	const routePrefix = visibleRoutePrefix(parts);
	for (const [metaType, config] of Object.entries(METADATA_FILE_MAP)) {
		if (!matchMetadataFileBaseName(metaType, baseName)) continue;
		if (!config.nestable && routePrefix !== "") return false;
		if (config.staticExtensions.includes(extension)) return true;
		if (config.dynamicExtensions.includes(extension)) return true;
	}
	return false;
}
function shouldInvalidateAppRouteFile(appDir, filePath, matcher) {
	if (!isInsideDirectory(appDir, filePath)) return false;
	const parts = relativeParts(appDir, filePath);
	if (parts.length === 0 || isPrivateAppPath(parts)) return false;
	const fileName = parts[parts.length - 1];
	if (!fileName) return false;
	return isAppRouterStructureFile(fileName, matcher) || isRootGlobalError(parts, matcher) || isMetadataRouteFile(parts);
}
//#endregion
export { shouldInvalidateAppRouteFile };
