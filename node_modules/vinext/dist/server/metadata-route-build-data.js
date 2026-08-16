import { routePatternParts } from "../routing/route-pattern.js";
import { getMetadataRouteKind } from "./metadata-routes.js";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { imageSize } from "image-size";
//#region src/server/metadata-route-build-data.ts
function createMetadataContentHash(buffer) {
	return createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}
function readMetadataRouteFile(route) {
	try {
		return fs.readFileSync(route.filePath);
	} catch (error) {
		const reason = error instanceof Error && error.message ? `: ${error.message}` : "";
		throw new Error(`[vinext] Failed to read metadata route file ${route.filePath} for ${route.servedUrl}${reason}`, { cause: error });
	}
}
function readMetadataRouteTextFile(filePath, route) {
	try {
		return fs.readFileSync(filePath, "utf8");
	} catch (error) {
		const reason = error instanceof Error && error.message ? `: ${error.message}` : "";
		throw new Error(`[vinext] Failed to read metadata route file ${filePath} for ${route.servedUrl}${reason}`, { cause: error });
	}
}
function readMetadataRouteAltText(route) {
	return route.altFilePath ? readMetadataRouteTextFile(route.altFilePath, route) : void 0;
}
function readMetadataImageDimensions(buffer, route) {
	try {
		const dimensions = imageSize(buffer);
		return {
			width: dimensions.width,
			height: dimensions.height
		};
	} catch (error) {
		const reason = error instanceof Error && error.message ? `: ${error.message}` : "";
		throw new Error(`[vinext] Failed to read metadata image dimensions for ${route.filePath} (${route.servedUrl})${reason}`, { cause: error });
	}
}
function resolveIconSizes(routeKind, isSvgRoute, dimensions) {
	if (routeKind !== "favicon" && routeKind !== "icon" && routeKind !== "apple") return;
	if (isSvgRoute) return "any";
	if (dimensions.width && dimensions.height) return `${dimensions.width}x${dimensions.height}`;
	return "any";
}
function createMetadataHeadData(input) {
	const { route, contentHash, dimensions, altText } = input;
	const routeKind = getMetadataRouteKind(route);
	if (!routeKind) return null;
	if (routeKind === "manifest") return {
		kind: "manifest",
		href: route.servedUrl
	};
	const href = `${route.servedUrl}?${contentHash}`;
	const isSvgRoute = route.contentType === "image/svg+xml" || route.servedUrl.toLowerCase().endsWith(".svg");
	if (routeKind === "favicon" || routeKind === "icon" || routeKind === "apple") return {
		kind: routeKind,
		href,
		type: route.contentType,
		sizes: resolveIconSizes(routeKind, isSvgRoute, dimensions)
	};
	return {
		kind: routeKind,
		href,
		type: route.contentType,
		width: dimensions.width,
		height: dimensions.height,
		alt: altText
	};
}
function createBaseEntryData(route, contentHash) {
	return {
		type: route.type,
		isDynamic: route.isDynamic,
		routePrefix: route.routePrefix,
		routeSegments: route.routeSegments ?? [],
		servedUrl: route.servedUrl,
		contentType: route.contentType,
		contentHash
	};
}
function readStaticMetadataImageDimensions(route, buffer) {
	return route.contentType.startsWith("image/") ? readMetadataImageDimensions(buffer, route) : {};
}
function createMetadataRouteEntryData(route) {
	const buffer = readMetadataRouteFile(route);
	const contentHash = createMetadataContentHash(buffer);
	const entryData = createBaseEntryData(route, contentHash);
	if (route.isDynamic) {
		if (route.type === "manifest") return {
			...entryData,
			headData: {
				kind: "manifest",
				href: route.servedUrl
			}
		};
		return entryData;
	}
	return {
		...entryData,
		headData: createMetadataHeadData({
			route,
			contentHash,
			dimensions: readStaticMetadataImageDimensions(route, buffer),
			altText: readMetadataRouteAltText(route)
		}),
		fileDataBase64: buffer.toString("base64")
	};
}
function pushEntryProperty(lines, key, value) {
	if (value !== void 0) lines.push(`${key}: ${JSON.stringify(value)},`);
}
function createMetadataRoutePatternParts(route) {
	if (!route.isDynamic || !route.servedUrl.includes("[")) return null;
	return routePatternParts(route.servedUrl);
}
function getDynamicMetadataRouteModuleName(route, moduleNames) {
	if (!route.isDynamic) return;
	const moduleName = moduleNames.get(route.filePath);
	if (!moduleName) throw new Error(`[vinext] Missing generated module import for dynamic metadata route ${route.filePath}`);
	return moduleName;
}
function createMetadataRouteEntrySource(input) {
	const { entryData, moduleName, patternParts } = input;
	const lines = [];
	pushEntryProperty(lines, "type", entryData.type);
	pushEntryProperty(lines, "isDynamic", entryData.isDynamic);
	pushEntryProperty(lines, "routePrefix", entryData.routePrefix);
	pushEntryProperty(lines, "routeSegments", entryData.routeSegments);
	pushEntryProperty(lines, "servedUrl", entryData.servedUrl);
	pushEntryProperty(lines, "contentType", entryData.contentType);
	pushEntryProperty(lines, "contentHash", entryData.contentHash);
	pushEntryProperty(lines, "headData", entryData.headData);
	pushEntryProperty(lines, "fileDataBase64", entryData.fileDataBase64);
	if (moduleName) lines.push(`module: ${moduleName},`);
	if (patternParts) lines.push(`patternParts: ${JSON.stringify(patternParts)},`);
	return `  {\n    ${lines.join("\n    ")}\n  }`;
}
function createMetadataRouteEntriesSource(routes, moduleNames) {
	return routes.map((route) => createMetadataRouteEntrySource({
		entryData: createMetadataRouteEntryData(route),
		moduleName: getDynamicMetadataRouteModuleName(route, moduleNames),
		patternParts: createMetadataRoutePatternParts(route)
	}));
}
//#endregion
export { createMetadataRouteEntriesSource, createMetadataRouteEntryData, createMetadataRouteEntrySource };
