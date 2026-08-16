import path from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { matchRoutePattern } from "../routing/route-pattern.js";
import fs from "node:fs";
//#region src/server/metadata-routes.ts
/**
* File-based metadata route handling.
*
* Next.js supports special files in the app/ directory that auto-generate
* metadata routes:
*   - sitemap.ts/.xml → /sitemap.xml (application/xml)
*   - robots.ts/.txt  → /robots.txt  (text/plain)
*   - manifest.ts/.json/.webmanifest → /manifest.webmanifest (application/manifest+json)
*   - icon.tsx/.png   → /icon (image/*)
*   - opengraph-image.tsx/.png → /opengraph-image (image/*)
*   - twitter-image.tsx/.png → /twitter-image (image/*)
*   - apple-icon.tsx/.png → /apple-icon (image/*)
*   - favicon.ico → /favicon.ico (image/x-icon)
*
* Dynamic versions (ts/tsx/js) export a default function that returns the data.
* Static versions (xml/txt/json/png/etc.) are served as-is.
*/
/** Map of metadata file base names to their URL path and content type. */
const METADATA_FILE_MAP = {
	sitemap: {
		urlPath: "/sitemap.xml",
		contentType: "application/xml",
		canBeDynamic: true,
		staticExtensions: [".xml"],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: true
	},
	robots: {
		urlPath: "/robots.txt",
		contentType: "text/plain",
		canBeDynamic: true,
		staticExtensions: [".txt"],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: false
	},
	manifest: {
		urlPath: "/manifest.webmanifest",
		contentType: "application/manifest+json",
		canBeDynamic: true,
		staticExtensions: [".json", ".webmanifest"],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: false
	},
	favicon: {
		urlPath: "/favicon.ico",
		contentType: "image/x-icon",
		canBeDynamic: false,
		staticExtensions: [".ico"],
		dynamicExtensions: [],
		nestable: false
	},
	icon: {
		urlPath: "/icon",
		contentType: "image/png",
		canBeDynamic: true,
		staticExtensions: [
			".ico",
			".jpg",
			".jpeg",
			".png",
			".svg"
		],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: true
	},
	"opengraph-image": {
		urlPath: "/opengraph-image",
		contentType: "image/png",
		canBeDynamic: true,
		staticExtensions: [
			".jpg",
			".jpeg",
			".png",
			".gif"
		],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: true
	},
	"twitter-image": {
		urlPath: "/twitter-image",
		contentType: "image/png",
		canBeDynamic: true,
		staticExtensions: [
			".jpg",
			".jpeg",
			".png",
			".gif"
		],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: true
	},
	"apple-icon": {
		urlPath: "/apple-icon",
		contentType: "image/png",
		canBeDynamic: true,
		staticExtensions: [
			".jpg",
			".jpeg",
			".png"
		],
		dynamicExtensions: [
			".tsx",
			".ts",
			".jsx",
			".js"
		],
		nestable: true
	}
};
/** Escape the five XML special characters in text content and attribute values. */
function escapeXml(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
/**
* Convert a sitemap array to XML string.
*/
function sitemapToXml(entries) {
	const hasAlternates = entries.some((entry) => Object.keys(entry.alternates ?? {}).length > 0);
	const hasImages = entries.some((entry) => Boolean(entry.images?.length));
	const hasVideos = entries.some((entry) => Boolean(entry.videos?.length));
	let content = "";
	content += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
	content += "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"";
	if (hasImages) content += " xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"";
	if (hasVideos) content += " xmlns:video=\"http://www.google.com/schemas/sitemap-video/1.1\"";
	if (hasAlternates) content += " xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n";
	else content += ">\n";
	for (const entry of entries) {
		content += "<url>\n";
		content += `<loc>${escapeXml(entry.url)}</loc>\n`;
		const languages = entry.alternates?.languages;
		if (languages && Object.keys(languages).length) for (const language in languages) content += `<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(languages[language])}" />\n`;
		if (entry.images?.length) for (const image of entry.images) content += `<image:image>\n<image:loc>${escapeXml(image)}</image:loc>\n</image:image>\n`;
		if (entry.videos?.length) for (const video of entry.videos) {
			const videoFields = [
				"<video:video>",
				`<video:title>${escapeXml(String(video.title))}</video:title>`,
				`<video:thumbnail_loc>${escapeXml(String(video.thumbnail_loc))}</video:thumbnail_loc>`,
				`<video:description>${escapeXml(String(video.description))}</video:description>`,
				video.content_loc && `<video:content_loc>${escapeXml(String(video.content_loc))}</video:content_loc>`,
				video.player_loc && `<video:player_loc>${escapeXml(String(video.player_loc))}</video:player_loc>`,
				video.duration && `<video:duration>${video.duration}</video:duration>`,
				video.view_count && `<video:view_count>${video.view_count}</video:view_count>`,
				video.tag && `<video:tag>${escapeXml(String(video.tag))}</video:tag>`,
				video.rating && `<video:rating>${video.rating}</video:rating>`,
				video.expiration_date && `<video:expiration_date>${escapeXml(String(video.expiration_date))}</video:expiration_date>`,
				video.publication_date && `<video:publication_date>${escapeXml(String(video.publication_date))}</video:publication_date>`,
				video.family_friendly && `<video:family_friendly>${video.family_friendly}</video:family_friendly>`,
				video.requires_subscription && `<video:requires_subscription>${video.requires_subscription}</video:requires_subscription>`,
				video.live && `<video:live>${video.live}</video:live>`,
				video.restriction && `<video:restriction relationship="${escapeXml(String(video.restriction.relationship))}">${escapeXml(String(video.restriction.content))}</video:restriction>`,
				video.platform && `<video:platform relationship="${escapeXml(String(video.platform.relationship))}">${escapeXml(String(video.platform.content))}</video:platform>`,
				video.uploader && `<video:uploader${video.uploader.info ? ` info="${escapeXml(String(video.uploader.info))}"` : ""}>${escapeXml(String(video.uploader.content))}</video:uploader>`,
				"</video:video>\n"
			].filter(Boolean);
			content += videoFields.join("\n");
		}
		if (entry.lastModified) content += `<lastmod>${serializeDate(entry.lastModified)}</lastmod>\n`;
		if (entry.changeFrequency) content += `<changefreq>${entry.changeFrequency}</changefreq>\n`;
		if (typeof entry.priority === "number") content += `<priority>${entry.priority}</priority>\n`;
		content += "</url>\n";
	}
	content += "</urlset>\n";
	return content;
}
/**
* Convert a robots config to text format.
*/
function robotsToText(config) {
	const lines = [];
	const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
	for (const rule of rules) {
		const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? "*"];
		for (const agent of agents) lines.push(`User-Agent: ${agent}`);
		if (rule.allow) {
			const allows = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
			for (const allow of allows) lines.push(`Allow: ${allow}`);
		}
		if (rule.disallow) {
			const disallows = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
			for (const disallow of disallows) lines.push(`Disallow: ${disallow}`);
		}
		if (rule.crawlDelay !== void 0) lines.push(`Crawl-delay: ${rule.crawlDelay}`);
		if (rule.other) for (const key of Object.keys(rule.other)) {
			const value = rule.other[key];
			if (value == null) continue;
			const values = Array.isArray(value) ? value : [value];
			for (const v of values) lines.push(`${key}: ${v}`);
		}
		lines.push("");
	}
	if (config.host) lines.push(`Host: ${config.host}`);
	if (config.sitemap) {
		const sitemaps = Array.isArray(config.sitemap) ? config.sitemap : [config.sitemap];
		for (const sitemap of sitemaps) lines.push(`Sitemap: ${sitemap}`);
	}
	return lines.join("\n").trim() + "\n";
}
/**
* Convert a manifest config to JSON string.
*/
function manifestToJson(config) {
	return JSON.stringify(config, null, 2);
}
function serializeDate(value) {
	return value instanceof Date ? value.toISOString() : value;
}
/**
* Regular expression pattern used to match route parameters.
* Matches both single parameters and parameter groups.
* Examples:
*   - `[[...slug]]` matches parameter group with key 'slug', repeat: true, optional: true
*   - `[...slug]` matches parameter group with key 'slug', repeat: true, optional: false
*   - `[[foo]]` matches parameter with key 'foo', repeat: false, optional: true
*   - `[bar]` matches parameter with key 'bar', repeat: false, optional: false
*/
const PARAMETER_PATTERN = /^([^[]*)\[((?:\[[^\]]*\])|[^\]]+)\](.*)$/;
function isGroupSegment(segment) {
	return segment.startsWith("(") && segment.endsWith(")");
}
function isParallelRouteSegment(segment) {
	return segment.startsWith("@") && segment !== "@children";
}
function normalizeStaticMetadataRouteSegment(segment) {
	let normalizedSegment = segment;
	let match = normalizedSegment.match(PARAMETER_PATTERN);
	while (match) {
		normalizedSegment = `${match[1]}-${match[3]}`;
		match = normalizedSegment.match(PARAMETER_PATTERN);
	}
	return normalizedSegment;
}
function getStaticMetadataRoute(appDirPath) {
	const segments = appDirPath.split("/").filter(Boolean);
	const normalizedSegments = [];
	for (const seg of segments) {
		if (isGroupSegment(seg) || seg.startsWith("@")) continue;
		normalizedSegments.push(normalizeStaticMetadataRouteSegment(seg));
	}
	return normalizedSegments.length > 0 ? `/${normalizedSegments.join("/")}` : "";
}
function hashMetadataRouteParentPath(parentPathname) {
	let hash = 5381;
	for (let i = 0; i < parentPathname.length; i++) hash = (hash << 5) + hash + parentPathname.charCodeAt(i) & 4294967295;
	return (hash >>> 0).toString(36).slice(0, 6);
}
function getMetadataRouteSuffix(page) {
	const lastSlash = page.lastIndexOf("/");
	const parentPathname = lastSlash > 0 ? page.slice(0, lastSlash) : "";
	if (page.endsWith("/sitemap") || page.endsWith("/sitemap.xml")) return "";
	if (!parentPathname.split("/").some((seg) => isGroupSegment(seg) || isParallelRouteSegment(seg))) return "";
	return hashMetadataRouteParentPath(parentPathname);
}
function computeMetadataRouteSuffix(appDirPath, leafName) {
	return {
		route: getStaticMetadataRoute(appDirPath),
		suffix: getMetadataRouteSuffix(appDirPath === "" || appDirPath === "/" ? `/${leafName}` : `${appDirPath}/${leafName}`)
	};
}
function getMetadataRouteFilename(appDirPath, lastSegment) {
	const ext = path.extname(lastSegment);
	const name = lastSegment.slice(0, -ext.length || void 0);
	const { suffix } = computeMetadataRouteSuffix(appDirPath, name);
	return `${name}${suffix ? `-${suffix}` : ""}${ext}`;
}
/**
* Compute the static URL for a metadata file given its app directory
* parent path and filename.
*
* Example:
*   fillStaticMetadataSegment("/", "favicon.ico") -> "/favicon.ico"
*   fillStaticMetadataSegment("/blog/[slug]", "favicon.ico") -> "/blog/-/favicon.ico"
*   fillStaticMetadataSegment("/(group)/group", "icon.png") -> "/group/icon-131tc6.png"
*/
function fillStaticMetadataSegment(appDirPath, lastSegment) {
	const route = getStaticMetadataRoute(appDirPath);
	const filename = getMetadataRouteFilename(appDirPath, lastSegment);
	return route === "" ? `/${filename}` : `${route}/${filename}`;
}
function getMetadataRouteKind(route) {
	if (route.type === "favicon") return "favicon";
	if (route.type === "icon") return "icon";
	if (route.type === "apple-icon") return "apple";
	if (route.type === "opengraph-image") return "openGraph";
	if (route.type === "twitter-image") return "twitter";
	if (route.type === "manifest") return "manifest";
	return null;
}
function getMetadataImageRouteKind(route) {
	const kind = getMetadataRouteKind(route);
	if (kind === "icon" || kind === "apple" || kind === "openGraph" || kind === "twitter") return kind;
	return null;
}
const metadataImageIdPattern = /^[a-zA-Z0-9-_.]+$/;
function isValidMetadataImageId(id) {
	return metadataImageIdPattern.test(id);
}
function matchMetadataRoutePattern(urlParts, patternParts) {
	return matchRoutePattern(urlParts, patternParts);
}
function metadataRouteSuffix(parentSegments, metaType) {
	if (metaType === "sitemap") return "";
	if (!parentSegments.some((segment) => segment.startsWith("(") && segment.endsWith(")") || segment.startsWith("@") && segment !== "@children")) return "";
	return hashMetadataRouteParentPath(`/${parentSegments.join("/")}`);
}
function withMetadataSuffix(urlPath, suffix) {
	if (!suffix) return urlPath;
	const parsed = path.parse(urlPath);
	return path.join(parsed.dir || "/", `${parsed.name}-${suffix}${parsed.ext}`);
}
function getMetadataServedUrl(metaType, config, ext, isDynamic, suffix, routeBaseName) {
	if (isDynamic && (metaType === "icon" || metaType === "apple-icon" || metaType === "opengraph-image" || metaType === "twitter-image")) return withMetadataSuffix(`/${routeBaseName}`, suffix);
	if (isDynamic) return withMetadataSuffix(config.urlPath, suffix);
	if (metaType === "manifest") return withMetadataSuffix(`/${routeBaseName}${ext}`, suffix);
	if (metaType === "icon" || metaType === "apple-icon" || metaType === "opengraph-image" || metaType === "twitter-image") return withMetadataSuffix(`/${routeBaseName}${ext}`, suffix);
	return withMetadataSuffix(config.urlPath, suffix);
}
function matchMetadataFileBaseName(metaType, baseName) {
	if (baseName === metaType) return baseName;
	if (metaType === "icon" || metaType === "apple-icon" || metaType === "opengraph-image" || metaType === "twitter-image") {
		const suffix = baseName.slice(metaType.length);
		if (/^\d$/.test(suffix)) return baseName;
	}
	return null;
}
let cachedMetadataRoutes = null;
let cachedMetadataAppDir = null;
/** Clear the {@link scanMetadataFiles} cache (call when app files change in dev). */
function invalidateMetadataFileCache() {
	cachedMetadataRoutes = null;
	cachedMetadataAppDir = null;
}
/**
* Scan an app directory for metadata files.
*/
function scanMetadataFiles(appDir) {
	if (cachedMetadataRoutes && cachedMetadataAppDir === appDir) return cachedMetadataRoutes;
	const routes = [];
	function scan(dir, urlPrefix, parentSegments) {
		if (!fs.existsSync(dir)) return;
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const dirName = entry.name;
				if (dirName.startsWith("_")) continue;
				const isRouteGroup = dirName.startsWith("(") && dirName.endsWith(")");
				const isParallelRoute = dirName.startsWith("@");
				const nextUrlPrefix = isRouteGroup || isParallelRoute ? urlPrefix : `${urlPrefix}/${dirName}`;
				scan(path.join(dir, dirName), nextUrlPrefix, [...parentSegments, dirName]);
				continue;
			}
			const fileName = entry.name;
			const baseName = fileName.replace(/\.[^.]+$/, "");
			const ext = fileName.slice(baseName.length);
			for (const [metaType, config] of Object.entries(METADATA_FILE_MAP)) {
				const routeBaseName = matchMetadataFileBaseName(metaType, baseName);
				if (!routeBaseName) continue;
				if (!config.nestable && urlPrefix !== "") continue;
				const isStatic = config.staticExtensions.includes(ext);
				const isDynamic = config.dynamicExtensions.includes(ext);
				if (!isStatic && !isDynamic) continue;
				const appDirPath = parentSegments.length > 0 ? `/${parentSegments.join("/")}` : "";
				const urlPath = getMetadataServedUrl(metaType, config, ext, isDynamic, metadataRouteSuffix(parentSegments, metaType), routeBaseName);
				const servedUrl = isStatic ? fillStaticMetadataSegment(appDirPath, `${routeBaseName}${ext}`) : urlPrefix === "" ? urlPath : `${urlPrefix}${urlPath}`;
				const altFilePath = isStatic && (metaType === "opengraph-image" || metaType === "twitter-image") ? resolveStaticMetadataAltFilePath(dir, baseName) : void 0;
				routes.push({
					type: metaType,
					isDynamic,
					filePath: path.join(dir, fileName),
					routePrefix: urlPrefix,
					routeSegments: parentSegments,
					servedUrl,
					contentType: isStatic && metaType === "manifest" ? config.contentType : isStatic ? getStaticContentType(ext, config.contentType) : config.contentType,
					altFilePath
				});
			}
		}
	}
	scan(appDir, "", []);
	const byUrl = /* @__PURE__ */ new Map();
	for (const route of routes) {
		const existing = byUrl.get(route.servedUrl);
		if (!existing) byUrl.set(route.servedUrl, route);
		else if (route.isDynamic && !existing.isDynamic) byUrl.set(route.servedUrl, route);
	}
	cachedMetadataRoutes = Array.from(byUrl.values());
	cachedMetadataAppDir = appDir;
	return cachedMetadataRoutes;
}
function resolveStaticMetadataAltFilePath(dir, baseName) {
	const altPath = path.join(dir, `${baseName}.alt.txt`);
	return fs.existsSync(altPath) ? altPath : void 0;
}
function getStaticContentType(ext, fallback) {
	return {
		".xml": "application/xml",
		".txt": "text/plain",
		".json": "application/json",
		".webmanifest": "application/manifest+json",
		".ico": "image/x-icon",
		".png": "image/png",
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".gif": "image/gif",
		".svg": "image/svg+xml"
	}[ext] ?? fallback;
}
//#endregion
export { METADATA_FILE_MAP, fillStaticMetadataSegment, getMetadataImageRouteKind, getMetadataRouteKind, invalidateMetadataFileCache, isValidMetadataImageId, manifestToJson, matchMetadataFileBaseName, matchMetadataRoutePattern, robotsToText, scanMetadataFiles, sitemapToXml };
