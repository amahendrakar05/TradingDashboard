import { decodeMatchedParams } from "./utils.js";
//#region src/routing/route-pattern.ts
function routePatternPart(segment) {
	if (segment.startsWith("[[...") && segment.endsWith("]]")) return `:${segment.slice(5, -2)}*`;
	if (segment.startsWith("[...") && segment.endsWith("]")) return `:${segment.slice(4, -1)}+`;
	if (segment.startsWith("[") && segment.endsWith("]")) return `:${segment.slice(1, -1)}`;
	return segment;
}
function routePatternParts(pathname) {
	return pathname.split("/").filter(Boolean).map(routePatternPart);
}
function routePattern(pathname) {
	const parts = routePatternParts(pathname);
	return parts.length > 0 ? `/${parts.join("/")}` : "";
}
function appendParamValue(target, value) {
	if (Array.isArray(value)) {
		for (const entry of value) target.push(entry);
		return;
	}
	target.push(value);
}
function fillRoutePatternSegments(pathname, params) {
	const segments = pathname.split("/").filter(Boolean);
	const resolvedSegments = [];
	for (const segment of segments) {
		if (segment.startsWith("[[...") && segment.endsWith("]]")) {
			const value = params[segment.slice(5, -2)];
			if (value !== void 0 && value !== "") {
				if (Array.isArray(value) && value.length === 0) continue;
				appendParamValue(resolvedSegments, value);
			}
			continue;
		}
		if (segment.startsWith("[...") && segment.endsWith("]")) {
			const value = params[segment.slice(4, -1)];
			if (value === void 0 || (Array.isArray(value) ? value.length === 0 : value === "")) return null;
			appendParamValue(resolvedSegments, value);
			continue;
		}
		if (segment.startsWith("[") && segment.endsWith("]")) {
			const value = params[segment.slice(1, -1)];
			if (typeof value === "string") {
				resolvedSegments.push(value);
				continue;
			}
			if (Array.isArray(value) && value.length > 0) {
				if (value.length > 1) return null;
				resolvedSegments.push(value[0]);
				continue;
			}
			return null;
		}
		resolvedSegments.push(segment);
	}
	return resolvedSegments.length > 0 ? `/${resolvedSegments.join("/")}` : "/";
}
function matchRoutePattern(urlParts, patternParts) {
	const params = matchRoutePatternRaw(urlParts, patternParts);
	if (params) decodeMatchedParams(params);
	return params;
}
function matchRoutePatternRaw(urlParts, patternParts) {
	const params = Object.create(null);
	function matchFrom(urlIndex, patternIndex) {
		if (patternIndex === patternParts.length) return urlIndex === urlParts.length;
		const patternPart = patternParts[patternIndex];
		if (patternPart.startsWith(":") && (patternPart.endsWith("+") || patternPart.endsWith("*"))) {
			const paramName = patternPart.slice(1, -1);
			const minLength = patternPart.endsWith("+") ? 1 : 0;
			for (let endIndex = urlIndex + minLength; endIndex <= urlParts.length; endIndex++) {
				const value = urlParts.slice(urlIndex, endIndex);
				if (value.length > 0) params[paramName] = value;
				else delete params[paramName];
				if (matchFrom(endIndex, patternIndex + 1)) return true;
			}
			delete params[paramName];
			return false;
		}
		if (patternPart.startsWith(":")) {
			if (urlIndex >= urlParts.length) return false;
			const paramName = patternPart.slice(1);
			params[paramName] = urlParts[urlIndex];
			if (matchFrom(urlIndex + 1, patternIndex + 1)) return true;
			delete params[paramName];
			return false;
		}
		if (urlIndex >= urlParts.length || urlParts[urlIndex] !== patternPart) return false;
		return matchFrom(urlIndex + 1, patternIndex + 1);
	}
	return matchFrom(0, 0) ? params : null;
}
function matchRoutePatternPrefix(pathParts, patternParts) {
	let pathIndex = 0;
	for (let patternIndex = 0; patternIndex < patternParts.length; patternIndex++) {
		const patternPart = patternParts[patternIndex];
		const isTerminal = patternIndex === patternParts.length - 1;
		if (patternPart.startsWith(":") && patternPart.endsWith("+")) return isTerminal && pathParts.length - pathIndex >= 1;
		if (patternPart.startsWith(":") && patternPart.endsWith("*")) return isTerminal;
		if (pathIndex >= pathParts.length) return false;
		if (patternPart.startsWith(":")) {
			pathIndex++;
			continue;
		}
		if (pathParts[pathIndex] !== patternPart) return false;
		pathIndex++;
	}
	return true;
}
function matchRoutePatternWithOptionalDynamicSegments(pathParts, patternParts) {
	function matchFrom(pathIndex, patternIndex) {
		if (patternIndex === patternParts.length) return pathIndex === pathParts.length;
		const patternPart = patternParts[patternIndex];
		if (patternPart.startsWith(":") && (patternPart.endsWith("+") || patternPart.endsWith("*"))) {
			const minLength = patternPart.endsWith("+") ? 1 : 0;
			for (let endIndex = pathIndex + minLength; endIndex <= pathParts.length; endIndex++) if (matchFrom(endIndex, patternIndex + 1)) return true;
			return false;
		}
		if (patternPart.startsWith(":")) return matchFrom(pathIndex, patternIndex + 1) || pathIndex < pathParts.length && matchFrom(pathIndex + 1, patternIndex + 1);
		if (pathIndex >= pathParts.length || pathParts[pathIndex] !== patternPart) return false;
		return matchFrom(pathIndex + 1, patternIndex + 1);
	}
	return matchFrom(0, 0);
}
/**
* Strip query string and a single trailing slash from a pathname.
*
* Mirrors the Next.js `removeTrailingSlash` helper used in
* `.nextjs-ref/packages/next/src/build/static-paths/pages.ts`. Kept here so
* both the build-time prerender and the request-time matchers normalize the
* same way.
*/
function normalizeStaticPathname(pathname) {
	const noQuery = pathname.split("?")[0];
	return noQuery === "/" ? "/" : noQuery.replace(/\/$/, "");
}
/**
* Normalize a single `getStaticPaths` entry into a `{ params }` object.
*
* Handles both Next.js-supported shapes:
*   - For a string entry, match it against `routePattern` to extract params,
*     mirroring `_routeMatcher(cleanedEntry)` in
*     `.nextjs-ref/packages/next/src/build/static-paths/pages.ts`. If the
*     string does not match the pattern, Next.js throws; we return an
*     `{ error }` result so the caller can record a per-route error instead
*     of crashing the build.
*   - For an object entry, require a `params` key (Next.js raises
*     "A required parameter (X) was not provided..." otherwise).
*
* Note: this intentionally does NOT strip a locale prefix. The build pipeline
* currently passes empty `locales` to `getStaticPaths`, so locale-prefixed
* string entries are not produced. If/when i18n is wired through prerender,
* locale handling should be added here, not duplicated at call sites.
*/
function normalizeStaticPathsEntry(entry, routePattern) {
	if (entry === null || entry === void 0) return { error: `getStaticPaths returned a ${entry === null ? "null" : "undefined"} entry` };
	if (typeof entry === "string") {
		const matched = matchRoutePattern(normalizeStaticPathname(entry).split("/").filter(Boolean), routePattern.split("/").filter(Boolean));
		if (!matched) return { error: `The provided path \`${entry}\` from getStaticPaths does not match the route pattern \`${routePattern}\`.` };
		return { params: matched };
	}
	if (typeof entry !== "object") return { error: `getStaticPaths entry must be a string or an object, got ${typeof entry}` };
	const { params } = entry;
	if (params === void 0 || params === null) return { error: `getStaticPaths entry is missing the \`params\` key for pattern \`${routePattern}\`. Return either a string path or { params: { ... } }.` };
	return { params };
}
//#endregion
export { fillRoutePatternSegments, matchRoutePattern, matchRoutePatternPrefix, matchRoutePatternRaw, matchRoutePatternWithOptionalDynamicSegments, normalizeStaticPathname, normalizeStaticPathsEntry, routePattern, routePatternParts };
