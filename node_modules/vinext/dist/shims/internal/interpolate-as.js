import { removeTrailingSlash } from "../../utils/base-path.js";
//#region src/shims/internal/interpolate-as.ts
/**
* Port of Next.js' Pages Router `interpolateAs` helper, plus the minimal
* subset of its transitive dependencies (`getRouteRegex` + `getRouteMatcher`
* and the parameter-pattern parsers they rely on).
*
* Upstream sources:
*   - packages/next/src/shared/lib/router/utils/interpolate-as.ts
*   - packages/next/src/shared/lib/router/utils/route-regex.ts
*   - packages/next/src/shared/lib/router/utils/route-matcher.ts
*   - packages/next/src/shared/lib/router/utils/get-dynamic-param.ts
*   - packages/next/src/shared/lib/router/utils/remove-trailing-slash.ts
*   - packages/next/src/shared/lib/escape-regexp.ts
*
* Used by the Pages Router shim to project a route pattern + `as` pathname +
* query back into a fully-interpolated browser URL (the `<Link href as>`
* masking path). Interception-route markers (`(.)`, `(..)`, `(...)`,
* `(..)(..)`) are intentionally omitted — they only apply to App Router and
* never appear in Pages Router patterns.
*/
function normalizeQuery(query) {
	const normalized = {};
	if (!query) return normalized;
	for (const [key, value] of Object.entries(query)) {
		if (value === void 0) continue;
		normalized[key] = Array.isArray(value) ? value.map(String) : String(value);
	}
	return normalized;
}
function parseRouteHrefQuery(routeHref, queryIndex, hashIndex) {
	const query = {};
	if (queryIndex === -1 || hashIndex !== -1 && queryIndex > hashIndex) return query;
	const searchEnd = hashIndex === -1 ? routeHref.length : hashIndex;
	for (const [key, value] of new URLSearchParams(routeHref.slice(queryIndex + 1, searchEnd))) {
		const existing = query[key];
		if (existing === void 0) query[key] = value;
		else if (Array.isArray(existing)) existing.push(value);
		else query[key] = [existing, value];
	}
	return query;
}
const reHasRegExp = /[|\\{}()[\]^$+*?.-]/;
const reReplaceRegExp = /[|\\{}()[\]^$+*?.-]/g;
function escapeStringRegexp(str) {
	if (reHasRegExp.test(str)) return str.replace(reReplaceRegExp, "\\$&");
	return str;
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
/**
* Parses a matched parameter from the PARAMETER_PATTERN regex.
* Examples:
*   - `[...slug]` -> `{ key: 'slug', repeat: true, optional: true }`
*   - `...slug`   -> `{ key: 'slug', repeat: true, optional: false }`
*   - `[foo]`     -> `{ key: 'foo',  repeat: false, optional: true }`
*   - `bar`       -> `{ key: 'bar',  repeat: false, optional: false }`
*/
function parseMatchedParameter(param) {
	const optional = param.startsWith("[") && param.endsWith("]");
	if (optional) param = param.slice(1, -1);
	const repeat = param.startsWith("...");
	if (repeat) param = param.slice(3);
	return {
		key: param,
		repeat,
		optional
	};
}
function getParametrizedRoute(route) {
	const groups = {};
	let groupIndex = 1;
	const segments = [];
	for (const segment of removeTrailingSlash(route).slice(1).split("/")) {
		const paramMatches = segment.match(PARAMETER_PATTERN);
		if (paramMatches && paramMatches[2]) {
			const { key, repeat, optional } = parseMatchedParameter(paramMatches[2]);
			groups[key] = {
				pos: groupIndex++,
				repeat,
				optional
			};
			const s = repeat ? optional ? "(?:/(.+?))?" : "/(.+?)" : "/([^/]+?)";
			segments.push(s);
		} else segments.push(`/${escapeStringRegexp(segment)}`);
	}
	return {
		parameterizedRoute: segments.join(""),
		groups
	};
}
/**
* From a normalized route this function generates a regular expression and a
* corresponding groups object intended to be used to store matching groups
* from the regular expression.
*/
function getRouteRegex(normalizedRoute) {
	const { parameterizedRoute, groups } = getParametrizedRoute(normalizedRoute);
	return {
		re: new RegExp(`^${parameterizedRoute}(?:/)?$`),
		groups
	};
}
/**
* Compile a route regex into a function that extracts decoded params from a
* pathname. Returns `false` if the pathname does not match the route.
*
* The `safeRouteMatcher`/`stripParameterSeparators` wrapper that Next.js
* applies (for adjacent-parameter normalization) is omitted — Pages Router
* patterns never contain adjacent parameters, so the wrapper is a no-op for
* this caller.
*/
function getRouteMatcher({ re, groups }) {
	return (pathname) => {
		const routeMatch = re.exec(pathname);
		if (!routeMatch) return false;
		const decode = (param) => {
			try {
				return decodeURIComponent(param);
			} catch {
				throw new Error("failed to decode param");
			}
		};
		const params = {};
		for (const [key, group] of Object.entries(groups)) {
			const match = routeMatch[group.pos];
			if (match !== void 0) if (group.repeat) params[key] = match.split("/").map((entry) => decode(entry));
			else params[key] = decode(match);
		}
		return params;
	};
}
/**
* Project a `(route, asPathname, query)` triple back into a fully-interpolated
* browser URL. Used by the `<Link href as>` masking path in the Pages Router
* shim: extract param values from the rendered `as` path when it differs from
* the route pattern, otherwise fall back to reading them from the href query.
*
* Returns `{ params, result }`. `result` is the interpolated URL, or the empty
* string when one or more required params could not be resolved. Callers warn
* (in dev) on the empty-string case; this helper deliberately stays silent —
* matching Next.js' behavior, where `<Link>` itself owns the dev warning.
*/
function interpolateAs(route, asPathname, query) {
	let interpolatedRoute = "";
	const dynamicRegex = getRouteRegex(route);
	const dynamicGroups = dynamicRegex.groups;
	const dynamicMatches = (asPathname !== route ? getRouteMatcher(dynamicRegex)(asPathname) : "") || query;
	interpolatedRoute = route;
	const params = Object.keys(dynamicGroups);
	if (!params.every((param) => {
		let value = dynamicMatches[param] || "";
		const { repeat, optional } = dynamicGroups[param];
		let replaced = `[${repeat ? "..." : ""}${param}]`;
		if (optional) replaced = `${!value ? "/" : ""}[${replaced}]`;
		if (repeat && !Array.isArray(value)) value = [value];
		return (optional || param in dynamicMatches) && (interpolatedRoute = interpolatedRoute.replace(replaced, repeat ? value.map((segment) => encodeURIComponent(segment)).join("/") : encodeURIComponent(value)) || "/");
	})) interpolatedRoute = "";
	return {
		params,
		result: interpolatedRoute
	};
}
/**
* Resolve a bracket-pattern route href against its displayed href. Query
* values can be supplied directly (object-form hrefs) or parsed from the route
* href (string-form hrefs). A `?` after `#` is part of the fragment, not a
* query delimiter.
*/
function interpolateDynamicRouteHref(routeHref, asHref, queryInput) {
	if (!routeHref.includes("[")) return null;
	const hashIndex = routeHref.indexOf("#");
	const queryIndex = routeHref.indexOf("?");
	const pathEnd = [hashIndex, queryIndex].filter((index) => index !== -1).reduce((earliest, index) => Math.min(earliest, index), routeHref.length);
	const routePathname = routeHref.slice(0, pathEnd);
	const trailing = routeHref.slice(pathEnd);
	const asPathname = asHref.split(/[?#]/, 1)[0];
	const query = queryInput ? normalizeQuery(queryInput) : parseRouteHrefQuery(routeHref, queryIndex, hashIndex);
	const { result, params } = interpolateAs(routePathname, asPathname, query);
	return {
		href: result ? `${result}${trailing}` : "",
		params,
		query,
		routePathname
	};
}
//#endregion
export { interpolateDynamicRouteHref };
