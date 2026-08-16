import { isAbsoluteOrProtocolRelativeUrl } from "./url-utils.js";
import { makeThenableParams } from "./thenable-params.js";
import React from "react";
import { Fragment as Fragment$1, jsx } from "react/jsx-runtime";
//#region src/shims/metadata.tsx
/**
* Metadata support for App Router.
*
* Handles `export const metadata` and `export async function generateMetadata()`.
* Resolves metadata from layouts and pages (pages override layouts).
*/
/**
* Resolve viewport config from a module. Handles both static `viewport` export
* and async `generateViewport()` function.
*/
async function resolveModuleViewport(mod, params, searchParams, searchParamsObserver) {
	if (typeof mod.generateViewport === "function") {
		const asyncParams = makeThenableParams(params);
		const props = searchParams === void 0 ? { params: asyncParams } : {
			params: asyncParams,
			searchParams: makeThenableParams(searchParams, searchParamsObserver)
		};
		return await mod.generateViewport(props);
	}
	if (mod.viewport && typeof mod.viewport === "object") return mod.viewport;
	return null;
}
/**
* Merge viewport configs from multiple sources (layouts + page).
* Later entries override earlier ones.
*/
const DEFAULT_VIEWPORT = {
	width: "device-width",
	initialScale: 1
};
function mergeViewport(viewportList) {
	const merged = { ...DEFAULT_VIEWPORT };
	for (const vp of viewportList) Object.assign(merged, vp);
	return merged;
}
/**
* React component that renders viewport meta tags into <head>.
*/
function ViewportHead({ viewport }) {
	const elements = [];
	let key = 0;
	const parts = [];
	if (viewport.width !== void 0) parts.push(`width=${viewport.width}`);
	if (viewport.height !== void 0) parts.push(`height=${viewport.height}`);
	if (viewport.initialScale !== void 0) parts.push(`initial-scale=${viewport.initialScale}`);
	if (viewport.minimumScale !== void 0) parts.push(`minimum-scale=${viewport.minimumScale}`);
	if (viewport.maximumScale !== void 0) parts.push(`maximum-scale=${viewport.maximumScale}`);
	if (viewport.userScalable !== void 0) parts.push(`user-scalable=${viewport.userScalable ? "yes" : "no"}`);
	if (parts.length > 0) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "viewport",
		content: parts.join(", ")
	}, key++));
	if (viewport.themeColor) {
		if (typeof viewport.themeColor === "string") elements.push(/* @__PURE__ */ jsx("meta", {
			name: "theme-color",
			content: viewport.themeColor
		}, key++));
		else if (Array.isArray(viewport.themeColor)) for (const entry of viewport.themeColor) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "theme-color",
			content: entry.color,
			...entry.media ? { media: entry.media } : {}
		}, key++));
	}
	if (viewport.colorScheme) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "color-scheme",
		content: viewport.colorScheme
	}, key++));
	return /* @__PURE__ */ jsx(Fragment$1, { children: elements });
}
/**
* Merge metadata from multiple sources (layouts + page).
*
* The list is ordered [rootLayout, nestedLayout, ..., page].
* Title template from layouts applies to the page title but NOT to
* the segment that defines the template itself. `title.absolute`
* skips all templates. `title.default` is the fallback when no
* child provides a title.
*
* Shallow merge: later entries override earlier ones (per Next.js docs).
*/
function mergeMetadata(metadataList) {
	return postProcessMetadata(mergeMetadataEntries(metadataList.map((metadata, index) => ({
		isPage: index === metadataList.length - 1,
		metadata
	}))));
}
function isPlainObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof URL);
}
function isOtherMetadata(value) {
	if (!isPlainObject(value)) return false;
	return Object.values(value).every((item) => {
		if (typeof item === "string") return true;
		return Array.isArray(item) && item.every((nestedItem) => typeof nestedItem === "string");
	});
}
/**
* Extract a plain string title from a metadata title value.
*/
function resolveStringTitle(title) {
	if (typeof title === "string") return title;
	if (title && typeof title === "object") return title.absolute ?? title.default ?? void 0;
}
function applyTitleTemplate(template, title) {
	return template ? template.replace(/%s/g, title) : title;
}
function resolveTitle(title, stashedTemplate) {
	if (typeof title === "string") return applyTitleTemplate(stashedTemplate, title);
	if (title && typeof title === "object") {
		let resolved = title.default === void 0 ? void 0 : applyTitleTemplate(stashedTemplate, title.default);
		if (title.absolute) resolved = title.absolute;
		return resolved;
	}
}
/**
* Post-process merged metadata to cross-fill openGraph and Twitter fields.
*
* Next.js runs this once after all layouts/pages and file-based metadata
* have been resolved. When openGraph exists, it auto-fills missing
* twitter:title/description/images from openGraph (falling back to root
* metadata title/description). Existing openGraph/twitter objects also inherit
* missing title/description from root metadata.
*
* Ported from Next.js:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/metadata/resolve-metadata.ts
*/
function postProcessMetadata(merged) {
	const result = { ...merged };
	const resolvedTitle = resolveStringTitle(result.title);
	if (result.openGraph) {
		const og = { ...result.openGraph };
		if (!og.title && resolvedTitle) og.title = resolvedTitle;
		if (!og.description && result.description) og.description = result.description;
		result.openGraph = og;
	}
	if (result.openGraph) {
		const autoFill = {};
		const existingTwitter = result.twitter;
		const hasTwTitle = existingTwitter ? Boolean(existingTwitter.title) : false;
		const hasTwDescription = existingTwitter ? Boolean(existingTwitter.description) : false;
		const hasTwImages = existingTwitter ? Object.prototype.hasOwnProperty.call(existingTwitter, "images") && Boolean(existingTwitter.images) : false;
		if (!hasTwTitle) {
			if (result.openGraph.title) autoFill.title = result.openGraph.title;
			else if (resolvedTitle) autoFill.title = resolvedTitle;
		}
		if (!hasTwDescription) autoFill.description = result.openGraph.description || result.description || void 0;
		if (!hasTwImages && result.openGraph.images !== void 0) autoFill.images = result.openGraph.images;
		if (Object.keys(autoFill).length > 0) if (existingTwitter) result.twitter = {
			...existingTwitter,
			...autoFill
		};
		else result.twitter = autoFill;
	}
	if (result.twitter) {
		const tw = { ...result.twitter };
		if (!tw.title && resolvedTitle) tw.title = resolvedTitle;
		if (!tw.description && result.description) tw.description = result.description;
		result.twitter = tw;
	}
	if (result.twitter) {
		const tw = { ...result.twitter };
		if (!tw.card) {
			const images = tw.images;
			tw.card = (Array.isArray(images) ? images.length > 0 : Boolean(images)) ? "summary_large_image" : "summary";
		}
		result.twitter = tw;
	}
	return result;
}
/**
* Merge metadata from multiple sources (layouts + page).
*
* The list is ordered [rootLayout, nestedLayout, ..., page].
* Title template from layouts applies to the page title but NOT to
* the segment that defines the template itself. `title.absolute`
* skips all templates. `title.default` is the fallback when no
* child provides a title.
*
* For top-level keys, later entries override earlier ones. `other` custom meta
* tags are the exception: Next.js merges those across segments.
*/
function mergeMetadataEntries(entries) {
	if (entries.length === 0) return {};
	const merged = {};
	let parentTemplate;
	for (const entry of entries) {
		const meta = entry.metadata;
		const isPage = Boolean(entry.isPage);
		const contributesTitle = entry.contributesTitle !== false;
		for (const key of Object.keys(meta)) {
			if (key === "title") continue;
			const incoming = meta[key];
			const existing = merged[key];
			if (key === "other" && isOtherMetadata(existing) && isOtherMetadata(incoming)) merged.other = {
				...existing,
				...incoming
			};
			else merged[key] = incoming;
		}
		if (contributesTitle && meta.title !== void 0) merged.title = resolveTitle(meta.title, parentTemplate);
		if (contributesTitle && !isPage && meta.title && typeof meta.title === "object" && meta.title.template) parentTemplate = meta.title.template;
	}
	return merged;
}
/**
* Resolve metadata from a module. Handles both static `metadata` export
* and async `generateMetadata()` function.
*
* @param parent - A Promise that resolves to the accumulated (merged) metadata
*   from all ancestor segments. Passed as the second argument to
*   `generateMetadata()`, matching Next.js's eager-execution-with-serial-
*   resolution approach. If not provided, defaults to a promise that resolves
*   to an empty object (so `await parent` never throws).
*/
async function resolveModuleMetadata(mod, params = {}, searchParams, parent = Promise.resolve({}), searchParamsObserver) {
	if (typeof mod.generateMetadata === "function") {
		const asyncParams = makeThenableParams(params);
		const props = searchParams === void 0 ? { params: asyncParams } : {
			params: asyncParams,
			searchParams: makeThenableParams(searchParams, searchParamsObserver)
		};
		return await (mod.generateMetadata.length >= 2 ? mod.generateMetadata(props, parent) : mod.generateMetadata(props));
	}
	if (mod.metadata && typeof mod.metadata === "object") return mod.metadata;
	return null;
}
/**
* React component that renders metadata as HTML head elements.
* Used by the RSC entry to inject into the <head>.
*/
function isIconDescriptor(value) {
	if (typeof value !== "object" || value === null || value instanceof URL || Array.isArray(value)) return false;
	const urlValue = Reflect.get(value, "url");
	return typeof urlValue === "string" || urlValue instanceof URL;
}
function isIconsMap(value) {
	return typeof value === "object" && !(value instanceof URL) && !Array.isArray(value) && !isIconDescriptor(value);
}
function normalizeUrlDescriptor(value, createDescriptor) {
	if (typeof value === "string" || value instanceof URL) return createDescriptor(value);
	return value;
}
function normalizeUrlDescriptorEntries(value, createDescriptor) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map((entry) => normalizeUrlDescriptor(entry, createDescriptor));
	return [normalizeUrlDescriptor(value, createDescriptor)];
}
function stringifyUrl(url) {
	return typeof url === "string" ? url : url.toString();
}
function createLocalMetadataBase() {
	const protocol = process.env.__NEXT_EXPERIMENTAL_HTTPS ? "https" : "http";
	return new URL(`${protocol}://localhost:${process.env.PORT || 3e3}`);
}
function getPreviewDeploymentUrl() {
	const origin = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
	return origin ? new URL(`https://${origin}`) : null;
}
function getProductionDeploymentUrl() {
	const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL;
	return origin ? new URL(`https://${origin}`) : null;
}
function getSocialImageMetadataBaseFallback(metadataBase) {
	const defaultMetadataBase = createLocalMetadataBase();
	const previewDeploymentUrl = getPreviewDeploymentUrl();
	const productionDeploymentUrl = getProductionDeploymentUrl();
	if (process.env.NODE_ENV === "development") return defaultMetadataBase;
	if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "preview" && previewDeploymentUrl) return previewDeploymentUrl;
	return metadataBase || productionDeploymentUrl || defaultMetadataBase;
}
function trimSlashes(value) {
	return value.replace(/^\/+|\/+$/g, "");
}
function joinMetadataPath(basePathname, pathname) {
	if (!basePathname || basePathname === "/") return pathname;
	const base = trimSlashes(basePathname);
	const path = trimSlashes(pathname);
	return path ? `/${base}/${path}` : `/${base}`;
}
function resolveRelativeMetadataUrl(url, pathname) {
	if (url === "." || url === "./") return pathname || "/";
	if (!url.startsWith("./")) return url;
	return `${pathname === "/" ? "" : pathname.replace(/\/+$/g, "")}/${url.slice(2)}`;
}
function formatResolvedMetadataUrl(url) {
	if (url.pathname === "/" && url.search === "" && url.hash === "") return url.origin;
	return url.href;
}
const TRAILING_SLASH_FILE_REGEX = /^(?:\/((?!\.well-known(?:\/.*)?)((?:[^/]+\/)*)([^/]+\.\w+)))(\/?|$)/i;
function resolveMetadataUrl(url, metadataBase, trailingSlash) {
	const value = stringifyUrl(url);
	if (!metadataBase) return value;
	try {
		const isAbsolute = isAbsoluteOrProtocolRelativeUrl(value);
		const composed = isAbsolute ? new URL(value, metadataBase) : new URL(joinMetadataPath(metadataBase.pathname, value), metadataBase);
		if (isAbsolute && composed.origin !== metadataBase.origin) return value;
		if (trailingSlash === true && composed.search === "") {
			if (composed.pathname !== "/" && !composed.pathname.endsWith("/") && !TRAILING_SLASH_FILE_REGEX.test(composed.pathname)) composed.pathname += "/";
		}
		const result = formatResolvedMetadataUrl(composed);
		if (trailingSlash === true && result === metadataBase.origin) return `${metadataBase.origin}/`;
		return result;
	} catch {
		return value;
	}
}
function resolveCanonicalUrl(url, metadataBase, pathname, trailingSlash) {
	if (url instanceof URL) return resolveMetadataUrl(url, metadataBase, trailingSlash);
	return resolveMetadataUrl(resolveRelativeMetadataUrl(url, pathname), metadataBase, trailingSlash);
}
function resolveAlternateUrl(url, metadataBase, pathname, trailingSlash) {
	if (url instanceof URL) {
		const resolvedUrl = new URL(pathname, url);
		url.searchParams.forEach((value, key) => resolvedUrl.searchParams.set(key, value));
		return resolveMetadataUrl(resolvedUrl, metadataBase, trailingSlash);
	}
	return resolveCanonicalUrl(url, metadataBase, pathname, trailingSlash);
}
function isSocialImageDescriptor(value) {
	return typeof value === "object" && !(value instanceof URL);
}
function isMetadataRouteSocialImage(value) {
	return Reflect.get(value, "metadataRoute") === true;
}
function resolveSocialImageUrl(image, metadataBase) {
	const imageUrl = isSocialImageDescriptor(image) ? image.url : image;
	const metadataRoute = isSocialImageDescriptor(image) && isMetadataRouteSocialImage(image);
	if (typeof imageUrl === "string" && !isAbsoluteOrProtocolRelativeUrl(imageUrl) && (!metadataBase || metadataRoute)) return resolveMetadataUrl(imageUrl, getSocialImageMetadataBaseFallback(metadataBase));
	return resolveMetadataUrl(imageUrl, metadataBase);
}
function escapeHtmlText(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escapeHtmlAttribute(value) {
	return escapeHtmlText(value).replaceAll("\"", "&quot;");
}
function renderMetadataText(node) {
	if (node === null || node === void 0 || typeof node === "boolean") return "";
	if (Array.isArray(node)) return node.map(renderMetadataText).join("");
	if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return escapeHtmlText(String(node));
	return "";
}
function renderMetadataAttributes(props, names) {
	const attributes = [];
	for (const name of names) {
		const value = Reflect.get(props, name);
		if (value === null || value === void 0 || typeof value === "boolean") continue;
		const htmlName = name === "hrefLang" ? "hreflang" : name;
		attributes.push(`${htmlName}="${escapeHtmlAttribute(String(value))}"`);
	}
	return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
}
function renderMetadataElementToHtml(node) {
	if (node === null || node === void 0 || typeof node === "boolean") return "";
	if (Array.isArray(node)) return node.map(renderMetadataElementToHtml).join("");
	if (!React.isValidElement(node)) return renderMetadataText(node);
	const props = typeof node.props === "object" && node.props !== null ? node.props : {};
	if (node.type === React.Fragment) return renderMetadataElementToHtml(Reflect.get(props, "children"));
	if (typeof node.type !== "string") return "";
	switch (node.type) {
		case "title": return `<title>${renderMetadataText(Reflect.get(props, "children"))}</title>`;
		case "meta": return `<meta${renderMetadataAttributes(props, [
			"name",
			"property",
			"content"
		])}>`;
		case "link": return `<link${renderMetadataAttributes(props, [
			"rel",
			"href",
			"hrefLang",
			"media",
			"type",
			"sizes"
		])}>`;
		default: return "";
	}
}
function renderMetadataToHtml(metadata, pathname = "/", options) {
	return renderMetadataElementToHtml(MetadataHead({
		metadata,
		pathname,
		trailingSlash: options?.trailingSlash
	}));
}
function MetadataHead({ metadata, pathname = "/", trailingSlash }) {
	const elements = [];
	let key = 0;
	const base = metadata.metadataBase;
	function resolveUrl(url) {
		if (!url) return void 0;
		return resolveMetadataUrl(url, base);
	}
	const title = typeof metadata.title === "string" ? metadata.title : typeof metadata.title === "object" ? metadata.title.absolute || metadata.title.default : void 0;
	if (title) elements.push(/* @__PURE__ */ jsx("title", { children: title }, key++));
	if (metadata.description) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "description",
		content: metadata.description
	}, key++));
	if (metadata.generator) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "generator",
		content: metadata.generator
	}, key++));
	if (metadata.applicationName) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "application-name",
		content: metadata.applicationName
	}, key++));
	if (metadata.referrer) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "referrer",
		content: metadata.referrer
	}, key++));
	if (metadata.keywords) {
		const kw = Array.isArray(metadata.keywords) ? metadata.keywords.join(",") : metadata.keywords;
		elements.push(/* @__PURE__ */ jsx("meta", {
			name: "keywords",
			content: kw
		}, key++));
	}
	if (metadata.authors) {
		const authorList = Array.isArray(metadata.authors) ? metadata.authors : [metadata.authors];
		for (const author of authorList) {
			if (author.name) elements.push(/* @__PURE__ */ jsx("meta", {
				name: "author",
				content: author.name
			}, key++));
			if (author.url) elements.push(/* @__PURE__ */ jsx("link", {
				rel: "author",
				href: author.url
			}, key++));
		}
	}
	if (metadata.creator) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "creator",
		content: metadata.creator
	}, key++));
	if (metadata.publisher) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "publisher",
		content: metadata.publisher
	}, key++));
	if (metadata.formatDetection) {
		const parts = [];
		if (metadata.formatDetection.telephone === false) parts.push("telephone=no");
		if (metadata.formatDetection.address === false) parts.push("address=no");
		if (metadata.formatDetection.email === false) parts.push("email=no");
		if (parts.length > 0) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "format-detection",
			content: parts.join(", ")
		}, key++));
	}
	if (metadata.category) elements.push(/* @__PURE__ */ jsx("meta", {
		name: "category",
		content: metadata.category
	}, key++));
	if (metadata.robots) if (typeof metadata.robots === "string") elements.push(/* @__PURE__ */ jsx("meta", {
		name: "robots",
		content: metadata.robots
	}, key++));
	else {
		const { googleBot, ...robotsRest } = metadata.robots;
		const robotParts = [];
		for (const [k, v] of Object.entries(robotsRest)) if (v === true) robotParts.push(k);
		else if (v === false) robotParts.push(`no${k}`);
		else if (typeof v === "string" || typeof v === "number") robotParts.push(`${k}:${v}`);
		if (robotParts.length > 0) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "robots",
			content: robotParts.join(", ")
		}, key++));
		if (googleBot) if (typeof googleBot === "string") elements.push(/* @__PURE__ */ jsx("meta", {
			name: "googlebot",
			content: googleBot
		}, key++));
		else {
			const gbParts = [];
			for (const [k, v] of Object.entries(googleBot)) if (v === true) gbParts.push(k);
			else if (v === false) gbParts.push(`no${k}`);
			else if (typeof v === "string" || typeof v === "number") gbParts.push(`${k}:${v}`);
			if (gbParts.length > 0) elements.push(/* @__PURE__ */ jsx("meta", {
				name: "googlebot",
				content: gbParts.join(", ")
			}, key++));
		}
	}
	if (metadata.openGraph) {
		const og = metadata.openGraph;
		if (og.title) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:title",
			content: og.title
		}, key++));
		if (og.description) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:description",
			content: og.description
		}, key++));
		if (og.url) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:url",
			content: resolveCanonicalUrl(og.url, base, pathname, trailingSlash)
		}, key++));
		if (og.siteName) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:site_name",
			content: og.siteName
		}, key++));
		if (og.type) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:type",
			content: og.type
		}, key++));
		if (og.locale) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:locale",
			content: og.locale
		}, key++));
		if (og.publishedTime) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "article:published_time",
			content: og.publishedTime
		}, key++));
		if (og.modifiedTime) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "article:modified_time",
			content: og.modifiedTime
		}, key++));
		if (og.authors) for (const author of og.authors) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "article:author",
			content: author
		}, key++));
		if (og.images) {
			const imgList = typeof og.images === "string" || og.images instanceof URL ? [{ url: og.images }] : Array.isArray(og.images) ? og.images : [og.images];
			for (const img of imgList) {
				elements.push(/* @__PURE__ */ jsx("meta", {
					property: "og:image",
					content: resolveSocialImageUrl(img, base)
				}, key++));
				if (typeof img !== "string" && !(img instanceof URL)) {
					if (img.width) elements.push(/* @__PURE__ */ jsx("meta", {
						property: "og:image:width",
						content: String(img.width)
					}, key++));
					if (img.height) elements.push(/* @__PURE__ */ jsx("meta", {
						property: "og:image:height",
						content: String(img.height)
					}, key++));
					if (img.type) elements.push(/* @__PURE__ */ jsx("meta", {
						property: "og:image:type",
						content: img.type
					}, key++));
					if (img.alt) elements.push(/* @__PURE__ */ jsx("meta", {
						property: "og:image:alt",
						content: img.alt
					}, key++));
				}
			}
		}
		if (og.videos) for (const video of og.videos) {
			elements.push(/* @__PURE__ */ jsx("meta", {
				property: "og:video",
				content: resolveUrl(video.url)
			}, key++));
			if (video.width) elements.push(/* @__PURE__ */ jsx("meta", {
				property: "og:video:width",
				content: String(video.width)
			}, key++));
			if (video.height) elements.push(/* @__PURE__ */ jsx("meta", {
				property: "og:video:height",
				content: String(video.height)
			}, key++));
		}
		if (og.audio) for (const audio of og.audio) elements.push(/* @__PURE__ */ jsx("meta", {
			property: "og:audio",
			content: resolveUrl(audio.url)
		}, key++));
	}
	if (metadata.twitter) {
		const tw = metadata.twitter;
		if (tw.card) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:card",
			content: tw.card
		}, key++));
		if (tw.site) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:site",
			content: tw.site
		}, key++));
		if (tw.siteId) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:site:id",
			content: tw.siteId
		}, key++));
		if (tw.title) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:title",
			content: tw.title
		}, key++));
		if (tw.description) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:description",
			content: tw.description
		}, key++));
		if (tw.creator) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:creator",
			content: tw.creator
		}, key++));
		if (tw.creatorId) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "twitter:creator:id",
			content: tw.creatorId
		}, key++));
		if (tw.images) {
			const imgList = typeof tw.images === "string" || tw.images instanceof URL ? [tw.images] : Array.isArray(tw.images) ? tw.images : [tw.images];
			for (const img of imgList) {
				elements.push(/* @__PURE__ */ jsx("meta", {
					name: "twitter:image",
					content: resolveSocialImageUrl(img, base)
				}, key++));
				if (typeof img !== "string" && !(img instanceof URL)) {
					if (img.type) elements.push(/* @__PURE__ */ jsx("meta", {
						name: "twitter:image:type",
						content: img.type
					}, key++));
					if (img.width) elements.push(/* @__PURE__ */ jsx("meta", {
						name: "twitter:image:width",
						content: String(img.width)
					}, key++));
					if (img.height) elements.push(/* @__PURE__ */ jsx("meta", {
						name: "twitter:image:height",
						content: String(img.height)
					}, key++));
					if (img.alt) elements.push(/* @__PURE__ */ jsx("meta", {
						name: "twitter:image:alt",
						content: img.alt
					}, key++));
				}
			}
		}
		if (tw.card === "player" && tw.players) {
			const players = Array.isArray(tw.players) ? tw.players : [tw.players];
			for (const player of players) {
				const playerUrl = player.playerUrl.toString();
				const streamUrl = player.streamUrl.toString();
				elements.push(/* @__PURE__ */ jsx("meta", {
					name: "twitter:player",
					content: resolveUrl(playerUrl)
				}, key++));
				elements.push(/* @__PURE__ */ jsx("meta", {
					name: "twitter:player:stream",
					content: resolveUrl(streamUrl)
				}, key++));
				elements.push(/* @__PURE__ */ jsx("meta", {
					name: "twitter:player:width",
					content: String(player.width)
				}, key++));
				elements.push(/* @__PURE__ */ jsx("meta", {
					name: "twitter:player:height",
					content: String(player.height)
				}, key++));
			}
		}
		if (tw.card === "app" && tw.app) {
			const { app } = tw;
			for (const platform of [
				"iphone",
				"ipad",
				"googleplay"
			]) {
				if (app.name) elements.push(/* @__PURE__ */ jsx("meta", {
					name: `twitter:app:name:${platform}`,
					content: app.name
				}, key++));
				if (app.id[platform]) elements.push(/* @__PURE__ */ jsx("meta", {
					name: `twitter:app:id:${platform}`,
					content: String(app.id[platform])
				}, key++));
				if (app.url?.[platform]) {
					const appUrl = app.url[platform].toString();
					elements.push(/* @__PURE__ */ jsx("meta", {
						name: `twitter:app:url:${platform}`,
						content: resolveUrl(appUrl)
					}, key++));
				}
			}
		}
	}
	if (metadata.icons) {
		const iconEntries = isIconsMap(metadata.icons) ? normalizeUrlDescriptorEntries(metadata.icons.icon, (url) => ({ url })) : normalizeUrlDescriptorEntries(metadata.icons, (url) => ({ url }));
		if (isIconsMap(metadata.icons) && metadata.icons.shortcut) {
			const shortcuts = Array.isArray(metadata.icons.shortcut) ? metadata.icons.shortcut : [metadata.icons.shortcut];
			for (const s of shortcuts) elements.push(/* @__PURE__ */ jsx("link", {
				rel: "shortcut icon",
				href: stringifyUrl(s)
			}, key++));
		}
		if (iconEntries.length > 0) for (const i of iconEntries) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "icon",
			href: stringifyUrl(i.url),
			...i.sizes ? { sizes: i.sizes } : {},
			...i.type ? { type: i.type } : {},
			...i.media ? { media: i.media } : {}
		}, key++));
		if (isIconsMap(metadata.icons) && metadata.icons.apple) for (const a of normalizeUrlDescriptorEntries(metadata.icons.apple, (url) => ({ url }))) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "apple-touch-icon",
			href: stringifyUrl(a.url),
			...a.sizes ? { sizes: a.sizes } : {},
			...a.type ? { type: a.type } : {}
		}, key++));
		if (isIconsMap(metadata.icons) && metadata.icons.other) {
			const others = Array.isArray(metadata.icons.other) ? metadata.icons.other : [metadata.icons.other];
			for (const o of others) elements.push(/* @__PURE__ */ jsx("link", {
				rel: o.rel,
				href: stringifyUrl(o.url),
				...o.sizes ? { sizes: o.sizes } : {},
				...o.type ? { type: o.type } : {}
			}, key++));
		}
	}
	if (metadata.manifest) elements.push(/* @__PURE__ */ jsx("link", {
		rel: "manifest",
		href: stringifyUrl(metadata.manifest)
	}, key++));
	if (metadata.alternates) {
		const alt = metadata.alternates;
		if (alt.canonical) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "canonical",
			href: resolveCanonicalUrl(alt.canonical, base, pathname, trailingSlash)
		}, key++));
		if (alt.languages) for (const [lang, href] of Object.entries(alt.languages)) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "alternate",
			hrefLang: lang,
			href: resolveAlternateUrl(href, base, pathname, trailingSlash)
		}, key++));
		if (alt.media) for (const [media, href] of Object.entries(alt.media)) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "alternate",
			media,
			href: resolveAlternateUrl(href, base, pathname, trailingSlash)
		}, key++));
		if (alt.types) for (const [type, href] of Object.entries(alt.types)) elements.push(/* @__PURE__ */ jsx("link", {
			rel: "alternate",
			type,
			href: resolveAlternateUrl(href, base, pathname, trailingSlash)
		}, key++));
	}
	if (metadata.verification) {
		const v = metadata.verification;
		if (v.google) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "google-site-verification",
			content: v.google
		}, key++));
		if (v.yahoo) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "y_key",
			content: v.yahoo
		}, key++));
		if (v.yandex) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "yandex-verification",
			content: v.yandex
		}, key++));
		if (v.other) for (const [name, content] of Object.entries(v.other)) {
			const values = Array.isArray(content) ? content : [content];
			for (const val of values) elements.push(/* @__PURE__ */ jsx("meta", {
				name,
				content: val
			}, key++));
		}
	}
	if (metadata.appleWebApp) {
		const awa = metadata.appleWebApp;
		if (awa.capable !== false) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "mobile-web-app-capable",
			content: "yes"
		}, key++));
		if (awa.title) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "apple-mobile-web-app-title",
			content: awa.title
		}, key++));
		if (awa.statusBarStyle) elements.push(/* @__PURE__ */ jsx("meta", {
			name: "apple-mobile-web-app-status-bar-style",
			content: awa.statusBarStyle
		}, key++));
		if (awa.startupImage) {
			const imgs = typeof awa.startupImage === "string" ? [{ url: awa.startupImage }] : awa.startupImage;
			for (const img of imgs) elements.push(/* @__PURE__ */ jsx("link", {
				rel: "apple-touch-startup-image",
				href: resolveUrl(img.url),
				...img.media ? { media: img.media } : {}
			}, key++));
		}
	}
	if (metadata.itunes) {
		const { appId, appArgument } = metadata.itunes;
		let content = `app-id=${appId}`;
		if (appArgument) content += `, app-argument=${appArgument}`;
		elements.push(/* @__PURE__ */ jsx("meta", {
			name: "apple-itunes-app",
			content
		}, key++));
	}
	if (metadata.appLinks) {
		const al = metadata.appLinks;
		for (const platform of [
			"ios",
			"iphone",
			"ipad",
			"android",
			"windows_phone",
			"windows",
			"windows_universal",
			"web"
		]) {
			const entries = al[platform];
			if (!entries) continue;
			const list = Array.isArray(entries) ? entries : [entries];
			for (const entry of list) for (const [k, v] of Object.entries(entry)) {
				if (v === void 0 || v === null) continue;
				const str = String(v);
				const content = k === "url" ? resolveUrl(str) : str;
				elements.push(/* @__PURE__ */ jsx("meta", {
					property: `al:${platform}:${k}`,
					content
				}, key++));
			}
		}
	}
	if (metadata.other) for (const [name, content] of Object.entries(metadata.other)) {
		const values = Array.isArray(content) ? content : [content];
		for (const val of values) elements.push(/* @__PURE__ */ jsx("meta", {
			name,
			content: val
		}, key++));
	}
	return /* @__PURE__ */ jsx(Fragment$1, { children: elements });
}
//#endregion
export { DEFAULT_VIEWPORT, MetadataHead, ViewportHead, mergeMetadata, mergeMetadataEntries, mergeViewport, postProcessMetadata, renderMetadataToHtml, resolveModuleMetadata, resolveModuleViewport };
