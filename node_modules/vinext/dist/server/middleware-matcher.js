import { removeTrailingSlash } from "../utils/base-path.js";
import { requestContextFromRequest } from "../config/request-context.js";
import { checkHasConditions } from "../config/config-matchers.js";
import { compileMiddlewareMatcherPattern, isValidMiddlewareMatcherObjectConfig } from "./middleware-matcher-pattern.js";
//#region src/server/middleware-matcher.ts
const EMPTY_MIDDLEWARE_REQUEST_CONTEXT = {
	headers: new Headers(),
	cookies: {},
	query: new URLSearchParams(),
	host: ""
};
const UNSAFE_MATCHER_PATTERN = Symbol("unsafe matcher pattern");
const _mwPatternCache = /* @__PURE__ */ new Map();
function matchesMiddleware(pathname, matcher, request, i18nConfig) {
	if (!matcher) return true;
	if (typeof matcher === "string") return matchMatcherPattern(pathname, matcher, i18nConfig);
	if (!Array.isArray(matcher)) return true;
	const requestContext = request ? requestContextFromRequest(request) : EMPTY_MIDDLEWARE_REQUEST_CONTEXT;
	for (const m of matcher) {
		if (typeof m === "string") {
			if (matchMatcherPattern(pathname, m, i18nConfig)) return true;
			continue;
		}
		if (!isValidMiddlewareMatcherObjectConfig(m)) return true;
		if (!matchObjectMatcher(pathname, m, i18nConfig)) continue;
		if (!checkHasConditions(m.has, m.missing, requestContext)) continue;
		return true;
	}
	return false;
}
function matchMatcherPattern(pathname, pattern, i18nConfig) {
	if (!i18nConfig) return matchPattern(pathname, pattern);
	return matchPattern(stripLocalePrefix(pathname, i18nConfig) ?? pathname, pattern);
}
function matchObjectMatcher(pathname, matcher, i18nConfig) {
	return matcher.locale === false ? matchPattern(pathname, matcher.source) : matchMatcherPattern(pathname, matcher.source, i18nConfig);
}
function stripLocalePrefix(pathname, i18nConfig) {
	if (pathname === "/") return null;
	const segments = pathname.split("/");
	const firstSegment = segments[1];
	if (!firstSegment || !i18nConfig.locales.includes(firstSegment)) return null;
	return "/" + segments.slice(2).join("/");
}
function matchPattern(pathname, pattern) {
	const normalizedPattern = /[\\():*+?]/.test(pattern) ? pattern : removeTrailingSlash(pattern);
	let cached = _mwPatternCache.get(normalizedPattern);
	if (cached === void 0) {
		cached = compileMatcherPattern(normalizedPattern);
		_mwPatternCache.set(normalizedPattern, cached);
	}
	if (cached === UNSAFE_MATCHER_PATTERN) return true;
	if (cached.test(pathname)) return true;
	return pathname.endsWith("/") && cached.test(removeTrailingSlash(pathname));
}
function compileMatcherPattern(pattern) {
	const result = compileMiddlewareMatcherPattern(pattern);
	if (result.regexp) return result.regexp;
	const problem = result.kind === "unsafe" ? "potentially unsafe" : "invalid";
	console.warn(`[vinext] Rejecting ${problem} middleware matcher: ${pattern}\n  ${result.error}.\n  Middleware will run for all paths to avoid bypassing request guards.`);
	return UNSAFE_MATCHER_PATTERN;
}
//#endregion
export { matchPattern, matchesMiddleware };
