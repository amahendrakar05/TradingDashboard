import { VINEXT_MW_CTX_HEADER, VINEXT_PRERENDER_ROUTE_PARAMS_HEADER, VINEXT_PRERENDER_SECRET_HEADER } from "../utils/protocol-headers.js";
import { buildRequestHeadersFromMiddlewareResponse } from "../utils/middleware-request-headers.js";
import { analyzeRegexSafety } from "../utils/regex-safety.js";
import { normalizeHost, parseCookies, requestContextFromRequest } from "./request-context.js";
import { isExternalUrl } from "../utils/external-url.js";
//#region src/config/config-matchers.ts
/**
* Cache for compiled regex patterns in matchConfigPattern.
*
* Redirect/rewrite patterns are static — they come from next.config.js and
* never change at runtime. Without caching, every request that hits the regex
* branch re-runs the full tokeniser walk + isSafeRegex + new RegExp() for
* every rule in the array. On apps with many locale-prefixed rules (which all
* contain `(` and therefore enter the regex branch) this dominated profiling
* at ~2.4 seconds of CPU self-time.
*
* Value is `null` when safeRegExp rejected the pattern (ReDoS risk), so we
* skip it on subsequent requests too without re-running the scanner.
*/
const _compiledPatternCache = /* @__PURE__ */ new Map();
/**
* Cache for compiled header source regexes in matchHeaders.
*
* Each NextHeader rule has a `source` that is run through escapeHeaderSource()
* then safeRegExp() to produce a RegExp. Both are pure functions of the source
* string and the result never changes. Without caching, every request
* re-runs the full escapeHeaderSource tokeniser + isSafeRegex scan + new RegExp()
* for every header rule.
*
* Value is `null` when safeRegExp rejected the pattern (ReDoS risk).
*/
const _compiledHeaderSourceCache = /* @__PURE__ */ new Map();
/**
* Cache for compiled has/missing condition value regexes in checkSingleCondition.
*
* Each has/missing condition may carry a `value` string that is passed directly
* to safeRegExp() for matching against header/cookie/query/host values. The
* condition objects are static (from next.config.js) so the compiled RegExp
* never changes. Without caching, safeRegExp() is called on every request for
* every condition on every rule.
*
* Value is `null` when safeRegExp rejected the pattern, or `false` when the
* value string was undefined (no regex needed — use exact string comparison).
*/
const _compiledConditionCache = /* @__PURE__ */ new Map();
/**
* Cache for destination substitution regexes in substituteDestinationParams.
*
* The regex depends only on the set of param keys captured from the matched
* source pattern. Caching by sorted key list avoids recompiling a new RegExp
* for repeated redirect/rewrite calls that use the same param shape.
*/
const _compiledDestinationParamCache = /* @__PURE__ */ new Map();
/**
* Generic helper for the regex compilation caches above.
*
* Each cache stores the compiled artifact (or `null` when safeRegExp rejected
* the pattern) the first time a key is seen, and reuses it forever. The
* `undefined` sentinel distinguishes "not yet seen" from "seen and rejected"
* so we never re-run isSafeRegex on the same input.
*
* Keep the security path intact: `compile()` is responsible for calling
* safeRegExp(); this helper only handles caching.
*/
function getCachedRegex(cache, key, compile) {
	let value = cache.get(key);
	if (value === void 0) {
		value = compile();
		cache.set(key, value);
	}
	return value;
}
/**
* Redirect index for O(1) locale-static rule lookup.
*
* Many Next.js apps generate 50-100 redirect rules of the form:
*   /:locale(en|es|fr|...)?/some-static-path  →  /some-destination
*
* The compiled regex for each is like:
*   ^/(en|es|fr|...)?/some-static-path$
*
* When no redirect matches (the common case for ordinary page loads),
* matchRedirect previously ran exec() on every one of those regexes —
* ~2ms per call, ~2992ms total self-time in profiles.
*
* The index splits rules into two buckets:
*
*   localeStatic — rules whose source is exactly /:paramName(alt1|alt2|...)?/suffix
*     where `suffix` is a static path with no further params or regex groups.
*     These are indexed in a Map<suffix, entry[]> for O(1) lookup after a
*     single fast strip of the optional locale prefix.
*
*   linear — all other rules. Matched with the original O(n) loop.
*
* The index is stored in a WeakMap keyed by the redirects array so it is
* computed once per config load and GC'd when the array is no longer live.
*
* ## Ordering invariant
*
* Redirect rules must be evaluated in their original order (first match wins).
* Each locale-static entry stores its `originalIndex` so that, when a
* locale-static fast-path match is found, any linear rules that appear earlier
* in the array are still checked first.
*/
/**
* Matches `/:param(alternation)?/static/suffix` — the locale-static pattern.
*
* The `?` after the capture group is itself optional so that both forms are
* detected:
*   - `/:locale(en|fr)?/foo` (locale segment optional — user-written rules)
*   - `/:nextInternalLocale(en|fr)/foo` (locale segment mandatory — emitted
*      by `applyLocaleToRoutes` for the locale-capture variant)
* Both forms benefit from O(1) suffix lookup; the optionality is recorded
* on the entry so we know whether to try the no-locale-prefix bucket.
*/
const _LOCALE_STATIC_RE = /^\/:[\w-]+\(([^)]+)\)(\??)\/([a-zA-Z0-9_~.%@!$&'*+,;=:/-]+)$/;
const _redirectIndexCache = /* @__PURE__ */ new WeakMap();
/**
* Build (or retrieve from cache) the redirect index for a given redirects array.
*
* Called once per config load from matchRedirect. The WeakMap ensures the index
* is recomputed if the config is reloaded (new array reference) and GC'd when
* the array is collected.
*/
function _getRedirectIndex(redirects) {
	let index = _redirectIndexCache.get(redirects);
	if (index !== void 0) return index;
	const localeStatic = /* @__PURE__ */ new Map();
	const linear = [];
	for (let i = 0; i < redirects.length; i++) {
		const redirect = redirects[i];
		const m = _LOCALE_STATIC_RE.exec(redirect.source);
		if (m) {
			const paramName = redirect.source.slice(2, redirect.source.indexOf("("));
			const alternation = m[1];
			const optional = m[2] === "?";
			const suffix = "/" + m[3];
			const altRe = safeRegExp("^(?:" + alternation + ")$", "i");
			if (!altRe) {
				linear.push([i, redirect]);
				continue;
			}
			const entry = {
				paramName,
				altRe,
				optional,
				redirect,
				originalIndex: i
			};
			const bucketKey = suffix.toLowerCase();
			const bucket = localeStatic.get(bucketKey);
			if (bucket) bucket.push(entry);
			else localeStatic.set(bucketKey, [entry]);
		} else linear.push([i, redirect]);
	}
	index = {
		localeStatic,
		linear
	};
	_redirectIndexCache.set(redirects, index);
	return index;
}
/** Hop-by-hop headers that should not be forwarded through a proxy. */
const HOP_BY_HOP_HEADERS = /* @__PURE__ */ new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade"
]);
/**
* Request hop-by-hop headers to strip before proxying with fetch().
* Intentionally narrower than HOP_BY_HOP_HEADERS: external rewrite proxying
* still forwards proxy auth credentials, while response sanitization strips
* them before returning data to the client.
*/
const REQUEST_HOP_BY_HOP_HEADERS = /* @__PURE__ */ new Set([
	"connection",
	"keep-alive",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade"
]);
function stripHopByHopRequestHeaders(headers) {
	const connectionTokens = (headers.get("connection") || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
	for (const header of REQUEST_HOP_BY_HOP_HEADERS) headers.delete(header);
	for (const token of connectionTokens) headers.delete(token);
}
/**
* Detect regex patterns vulnerable to catastrophic backtracking (ReDoS).
*
* Uses the same deterministic structural analysis as middleware matcher
* validation. Nested bounded repetition is accepted only when its repeated
* language has fixed width and unambiguous branches; a fixed outer count can
* otherwise still cause polynomially catastrophic backtracking on long near
* misses.
*
* Returns true if the pattern appears safe, false if it's potentially dangerous.
*/
function isSafeRegex(pattern, flags) {
	return analyzeRegexSafety(pattern, { ignoreCase: flags?.includes("i") }) === null;
}
/**
* Compile a regex pattern safely. Returns the compiled RegExp or null if the
* pattern is invalid or vulnerable to ReDoS.
*
* Logs a warning when a pattern is rejected so developers can fix their config.
*/
function safeRegExp(pattern, flags) {
	if (!isSafeRegex(pattern, flags)) {
		console.warn(`[vinext] Rejecting potentially unsafe regex pattern (ReDoS risk): ${pattern}\n  Nested or ambiguous repetition can cause catastrophic backtracking.\n  Simplify the pattern to make repeated matches fixed and unambiguous.`);
		return null;
	}
	try {
		return new RegExp(pattern, flags);
	} catch {
		return null;
	}
}
/**
* Convert a Next.js header/rewrite/redirect source pattern into a regex string.
*
* Regex groups in the source (e.g. `(\d+)`) are extracted first, the remaining
* text is escaped/converted in a **single pass** (avoiding chained `.replace()`
* which CodeQL flags as incomplete sanitization), then groups are restored.
*/
function escapeHeaderSource(source) {
	const S = "";
	const groups = [];
	const withPlaceholders = source.replace(/\(([^)]+)\)/g, (_m, inner) => {
		groups.push(inner);
		return `${S}G${groups.length - 1}${S}`;
	});
	let result = "";
	const re = new RegExp(`${S}G(\\d+)${S}|:[\\w-]+|[.+?*]|[^.+?*:\\uE000]+`, "g");
	let m;
	while ((m = re.exec(withPlaceholders)) !== null) if (m[1] !== void 0) result += `(${groups[Number(m[1])]})`;
	else if (m[0].startsWith(":")) {
		const constraintMatch = withPlaceholders.slice(re.lastIndex).match(new RegExp(`^${S}G(\\d+)${S}`));
		if (constraintMatch) {
			re.lastIndex += constraintMatch[0].length;
			result += `(${groups[Number(constraintMatch[1])]})`;
		} else result += "[^/]+";
	} else switch (m[0]) {
		case ".":
			result += "\\.";
			break;
		case "+":
			result += "\\+";
			break;
		case "?":
			result += "\\?";
			break;
		case "*":
			result += ".*";
			break;
		default:
			result += m[0];
			break;
	}
	return result;
}
const _BASEPATH_DEFAULT = {
	basePath: "",
	hadBasePath: true
};
/**
* Decide whether a rule should be evaluated at all given the current
* basePath-gating state.
*
* Encodes the Next.js rules:
*   - basePath: false rule → only when the request was NOT under basePath
*     (i.e. it's the explicit opt-out path). When `basePath` itself is
*     empty, basePath: false rules are still allowed to match — there's
*     just no basePath to gate them.
*   - default rule (basePath !== false) → only when the request WAS under
*     basePath (or no basePath is configured).
*/
function shouldEvaluateRule(ruleBasePath, state) {
	if (!state.basePath) return true;
	return ruleBasePath === false ? !state.hadBasePath : state.hadBasePath;
}
/**
* Unpack `x-middleware-request-*` headers from the collected middleware
* response headers into the actual request, and strip all `x-middleware-*`
* internal signals so they never reach clients.
*
* `middlewareHeaders` is mutated in-place (matching keys are deleted).
* Returns a (possibly cloned) `Request` with the unpacked headers applied,
* and a fresh `RequestContext` built from it — ready for post-middleware
* config rule matching (beforeFiles, afterFiles, fallback).
*
* Works for both Node.js requests (mutable headers) and Workers requests
* (immutable — cloned only when there are headers to apply).
*
* `x-middleware-request-*` values are always plain strings (they carry
* individual header values), so the wider `string | string[]` type of
* `middlewareHeaders` is safe to cast here.
*/
function applyMiddlewareRequestHeaders(middlewareHeaders, request, options = {}) {
	const nextHeaders = buildRequestHeadersFromMiddlewareResponse(request.headers, middlewareHeaders, options);
	for (const key of Object.keys(middlewareHeaders)) if (key.startsWith("x-middleware-") && key !== "x-middleware-cache") delete middlewareHeaders[key];
	if (nextHeaders) request = new Request(request.url, {
		method: request.method,
		headers: nextHeaders,
		body: request.body,
		duplex: request.body ? "half" : void 0
	});
	return {
		request,
		postMwReqCtx: requestContextFromRequest(request)
	};
}
function _emptyParams() {
	return Object.create(null);
}
function _matchConditionValue(actualValue, expectedValue) {
	if (!expectedValue) return actualValue ? _emptyParams() : null;
	const re = _cachedConditionRegex(expectedValue);
	if (re) {
		const match = re.exec(actualValue);
		if (!match) return null;
		const params = _emptyParams();
		if (match.groups) {
			for (const [key, value] of Object.entries(match.groups)) if (value !== void 0) params[key] = value;
		}
		return params;
	}
	return actualValue === expectedValue ? _emptyParams() : null;
}
/**
* Check a single has/missing condition against request context.
* Returns captured params when the condition is satisfied, or null otherwise.
*/
function matchSingleCondition(condition, ctx) {
	switch (condition.type) {
		case "header": {
			const headerValue = ctx.headers.get(condition.key);
			if (headerValue === null) return null;
			return _matchConditionValue(headerValue, condition.value);
		}
		case "cookie": {
			if (!Object.hasOwn(ctx.cookies, condition.key)) return null;
			const cookieValue = ctx.cookies[condition.key];
			return _matchConditionValue(cookieValue, condition.value);
		}
		case "query": {
			const queryValues = ctx.query.getAll(condition.key);
			if (queryValues.length === 0) return null;
			if (!condition.value && queryValues.length > 1) return _emptyParams();
			return _matchConditionValue(queryValues[queryValues.length - 1], condition.value);
		}
		case "host":
			if (condition.value !== void 0) return _matchConditionValue(ctx.host, condition.value);
			return ctx.host === condition.key ? _emptyParams() : null;
		default: return null;
	}
}
/**
* Return a cached RegExp for a has/missing condition value string, compiling
* on first use. Returns null if safeRegExp rejected the pattern or if the
* value is not a valid regex (fall back to exact string comparison).
*/
function _cachedConditionRegex(value) {
	return getCachedRegex(_compiledConditionCache, value, () => safeRegExp(`^${value}$`));
}
/**
* Check all has/missing conditions for a config rule.
* Returns true if the rule should be applied (all has conditions pass, all missing conditions pass).
*
* - has: every condition must match (the request must have it)
* - missing: every condition must NOT match (the request must not have it)
*/
function collectConditionParams(has, missing, ctx) {
	const params = _emptyParams();
	if (has) for (const condition of has) {
		const conditionParams = matchSingleCondition(condition, ctx);
		if (!conditionParams) return null;
		Object.assign(params, conditionParams);
	}
	if (missing) {
		for (const condition of missing) if (matchSingleCondition(condition, ctx)) return null;
	}
	return params;
}
function checkHasConditions(has, missing, ctx) {
	return collectConditionParams(has, missing, ctx) !== null;
}
/**
* If the current position in `str` starts with a parenthesized group, consume
* it and advance `re.lastIndex` past the closing `)`. Returns the group
* contents or null if no group is present.
*/
function extractConstraint(str, re) {
	if (str[re.lastIndex] !== "(") return null;
	const start = re.lastIndex + 1;
	let depth = 1;
	let i = start;
	while (i < str.length && depth > 0) {
		if (str[i] === "(") depth++;
		else if (str[i] === ")") depth--;
		i++;
	}
	if (depth !== 0) return null;
	re.lastIndex = i;
	return str.slice(start, i - 1);
}
/**
* Match a Next.js config pattern (from redirects/rewrites sources) against a pathname.
* Returns matched params or null.
*
* Supports:
*   :param     - matches a single path segment
*   :param*    - matches zero or more segments (catch-all)
*   :param+    - matches one or more segments
*   (regex)    - inline regex patterns in the source
*   :param(constraint) - named param with inline regex constraint
*/
/**
* Strip a single trailing slash from a pathname for config-source matching.
*
* Next.js conditionally appends `(/)?` to rewrite/redirect/header source
* regexes when `trailingSlash: true` (see Next.js
* `resolve-rewrites.ts` and `server-utils.ts:checkRewrite`). Rather than
* threading the trailingSlash flag through every matcher, we unconditionally
* strip a trailing slash from the incoming pathname. When `trailingSlash: false`
* the request pipeline emits a normalizing redirect (step 3) before config
* rewrites/redirects (step 6) ever run, so the pathname is already slash-free;
* the unconditional strip is defense-in-depth for that ordering. When
* `trailingSlash: true` it bridges the gap between the canonicalized request
* path (`/rewrite-1/`) and source patterns written without a trailing slash
* (`/rewrite-1`).
*
* The root path `"/"` is preserved as-is.
*/
function stripTrailingSlashForConfigMatch(value) {
	return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}
function configPathEquals(a, b) {
	return a.toLowerCase() === b.toLowerCase();
}
function configPathStartsWith(pathname, prefix) {
	return pathname.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase();
}
function matchConfigPattern(pathname, pattern) {
	const pathnameHadTrailingSlash = pathname.length > 1 && pathname.endsWith("/");
	pathname = stripTrailingSlashForConfigMatch(pathname);
	if (pathnameHadTrailingSlash) pattern = stripTrailingSlashForConfigMatch(pattern);
	const catchAllAnchor = /:[\w-]+[*+]/.test(pattern);
	const namedParamCount = (pattern.match(/:[\w-]+/g) || []).length;
	if (pattern.includes("(") || pattern.includes("\\") || /:[\w-]+[*+][^/]/.test(pattern) || /:[\w-]+\./.test(pattern) || /[^/]:[\w-]+/.test(pattern) || catchAllAnchor && namedParamCount > 1) try {
		const compiled = getCachedRegex(_compiledPatternCache, pattern, () => {
			const paramNames = [];
			let regexStr = "";
			const tokenRe = /:([\w-]+)|[.]|[^:.]+/g;
			let tok;
			while ((tok = tokenRe.exec(pattern)) !== null) if (tok[1] !== void 0) {
				const name = tok[1];
				const rest = pattern.slice(tokenRe.lastIndex);
				if (rest.startsWith("*") || rest.startsWith("+")) {
					const quantifier = rest[0];
					tokenRe.lastIndex += 1;
					const constraint = extractConstraint(pattern, tokenRe);
					paramNames.push(name);
					if (constraint !== null) regexStr += `(${constraint})`;
					else regexStr += quantifier === "*" ? "(.*)" : "(.+)";
				} else {
					const constraint = extractConstraint(pattern, tokenRe);
					paramNames.push(name);
					regexStr += constraint !== null ? `(${constraint})` : "([^/]+)";
				}
			} else if (tok[0] === ".") regexStr += "\\.";
			else regexStr += tok[0];
			const re = safeRegExp("^" + regexStr + "$", "i");
			return re ? {
				re,
				paramNames
			} : null;
		});
		if (!compiled) return null;
		const match = compiled.re.exec(pathname);
		if (!match) return null;
		const params = Object.create(null);
		for (let i = 0; i < compiled.paramNames.length; i++) params[compiled.paramNames[i]] = match[i + 1] ?? "";
		return params;
	} catch {}
	const catchAllMatch = pattern.match(/:([\w-]+)(\*|\+)$/);
	if (catchAllMatch) {
		const prefix = pattern.slice(0, pattern.lastIndexOf(":"));
		const paramName = catchAllMatch[1];
		const isPlus = catchAllMatch[2] === "+";
		const prefixNoSlash = prefix.replace(/\/$/, "");
		if (!configPathStartsWith(pathname, prefixNoSlash)) return null;
		const charAfter = pathname[prefixNoSlash.length];
		if (charAfter !== void 0 && charAfter !== "/") return null;
		const rest = pathname.slice(prefixNoSlash.length);
		if (isPlus && (!rest || rest === "/")) return null;
		let restValue = rest.startsWith("/") ? rest.slice(1) : rest;
		return { [paramName]: restValue };
	}
	const parts = pattern.split("/");
	const pathParts = pathname.split("/");
	if (parts.length !== pathParts.length) return null;
	const params = Object.create(null);
	for (let i = 0; i < parts.length; i++) if (parts[i].startsWith(":")) params[parts[i].slice(1)] = pathParts[i];
	else if (!configPathEquals(parts[i], pathParts[i])) return null;
	return params;
}
/**
* Apply redirect rules from next.config.js.
* Returns the redirect info if a redirect was matched, or null.
*
* `ctx` provides the request context (cookies, headers, query, host) used
* to evaluate has/missing conditions. Next.js always has request context
* when evaluating redirects, so this parameter is required.
*
* ## Performance
*
* Rules with a locale-capture-group prefix (the dominant pattern in large
* Next.js apps — e.g. `/:locale(en|es|fr|...)?/some-path`) are handled via
* a pre-built index. Instead of running exec() on each locale regex
* individually, we:
*
*   1. Strip the optional locale prefix from the pathname with one cheap
*      string-slice check (no regex exec on the hot path).
*   2. Look up the stripped suffix in a Map<suffix, entry[]>.
*   3. For each matching entry, validate the captured locale string against
*      a small, anchored alternation regex.
*
* This reduces the per-request cost from O(n × regex) to O(1) map lookup +
* O(matches × tiny-regex), eliminating the ~2992ms self-time reported in
* profiles for apps with 63+ locale-prefixed rules.
*
* Rules that don't fit the locale-static pattern fall back to the original
* linear matchConfigPattern scan.
*
* ## Ordering invariant
*
* First match wins, preserving the original redirect array order. When a
* locale-static fast-path match is found at position N, all linear rules with
* an original index < N are checked via matchConfigPattern first — they are
* few in practice (typically zero) so this is not a hot-path concern.
*/
function matchRedirect(pathname, redirects, ctx, basePathState = _BASEPATH_DEFAULT) {
	if (redirects.length === 0) return null;
	const normalizedPathname = stripTrailingSlashForConfigMatch(pathname);
	const index = _getRedirectIndex(redirects);
	let localeMatch = null;
	let localeMatchIndex = Infinity;
	if (index.localeStatic.size > 0) {
		const noLocaleBucket = index.localeStatic.get(normalizedPathname.toLowerCase());
		if (noLocaleBucket) for (const entry of noLocaleBucket) {
			if (!entry.optional) continue;
			if (entry.originalIndex >= localeMatchIndex) continue;
			const redirect = entry.redirect;
			if (!shouldEvaluateRule(redirect.basePath, basePathState)) continue;
			const conditionParams = redirect.has || redirect.missing ? collectConditionParams(redirect.has, redirect.missing, ctx) : _emptyParams();
			if (!conditionParams) continue;
			localeMatch = {
				destination: substituteAndSanitizeDestination(redirect.destination, {
					[entry.paramName]: "",
					...conditionParams
				}),
				permanent: redirect.permanent
			};
			localeMatchIndex = entry.originalIndex;
			break;
		}
		const slashTwo = normalizedPathname.indexOf("/", 1);
		if (slashTwo !== -1) {
			const suffix = normalizedPathname.slice(slashTwo);
			const localePart = normalizedPathname.slice(1, slashTwo);
			const localeBucket = index.localeStatic.get(suffix.toLowerCase());
			if (localeBucket) for (const entry of localeBucket) {
				if (entry.originalIndex >= localeMatchIndex) continue;
				if (!entry.altRe.test(localePart)) continue;
				const redirect = entry.redirect;
				if (!shouldEvaluateRule(redirect.basePath, basePathState)) continue;
				const conditionParams = redirect.has || redirect.missing ? collectConditionParams(redirect.has, redirect.missing, ctx) : _emptyParams();
				if (!conditionParams) continue;
				localeMatch = {
					destination: substituteAndSanitizeDestination(redirect.destination, {
						[entry.paramName]: localePart,
						...conditionParams
					}),
					permanent: redirect.permanent
				};
				localeMatchIndex = entry.originalIndex;
				break;
			}
		}
	}
	for (const [origIdx, redirect] of index.linear) {
		if (origIdx >= localeMatchIndex) break;
		if (!shouldEvaluateRule(redirect.basePath, basePathState)) continue;
		const params = matchConfigPattern(pathname, redirect.source);
		if (params) {
			const conditionParams = redirect.has || redirect.missing ? collectConditionParams(redirect.has, redirect.missing, ctx) : _emptyParams();
			if (!conditionParams) continue;
			return {
				destination: substituteAndSanitizeDestination(redirect.destination, {
					...params,
					...conditionParams
				}),
				permanent: redirect.permanent
			};
		}
	}
	return localeMatch;
}
/**
* Apply rewrite rules from next.config.js.
* Returns the rewritten URL or null if no rewrite matched.
*
* `ctx` provides the request context (cookies, headers, query, host) used
* to evaluate has/missing conditions. Next.js always has request context
* when evaluating rewrites, so this parameter is required.
*/
function matchRewrite(pathname, rewrites, ctx, basePathState = _BASEPATH_DEFAULT, paramsPathname = pathname) {
	for (const rewrite of rewrites) {
		if (!shouldEvaluateRule(rewrite.basePath, basePathState)) continue;
		const matchedParams = matchConfigPattern(pathname, rewrite.source);
		if (matchedParams) {
			const params = paramsPathname === pathname ? matchedParams : matchConfigPattern(paramsPathname, rewrite.source) ?? matchedParams;
			const conditionParams = rewrite.has || rewrite.missing ? collectConditionParams(rewrite.has, rewrite.missing, ctx) : _emptyParams();
			if (!conditionParams) continue;
			const rewriteParams = {
				...params,
				...conditionParams
			};
			return substituteAndSanitizeRewriteDestination(rewrite.destination, rewriteParams);
		}
	}
	return null;
}
/**
* Check whether a rewrite source can match a pathname without evaluating its
* request-dependent `has` / `missing` conditions.
*
* Dev uses this only as a conservative preflight before middleware runs. The
* conditions may become true after middleware overrides request headers, so
* evaluating them against the original request would incorrectly skip the
* Pages request pipeline for file-looking paths.
*/
function matchesRewriteSource(pathname, rewrite, basePathState = _BASEPATH_DEFAULT) {
	return shouldEvaluateRule(rewrite.basePath, basePathState) && matchConfigPattern(pathname, rewrite.source) !== null;
}
/**
* Substitute all matched route params into a redirect/rewrite destination.
*
* Handles repeated params (e.g. `/api/:id/:id`) and catch-all suffix forms
* (`:path*`, `:path+`) in a single pass. Unknown params are left intact.
*/
function substituteDestinationParams(destination, params) {
	const keys = Object.keys(params);
	if (keys.length === 0) return destination;
	const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
	const cacheKey = sortedKeys.join("\0");
	let paramRe = _compiledDestinationParamCache.get(cacheKey);
	if (!paramRe) {
		const paramAlternation = sortedKeys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
		paramRe = new RegExp(`:(${paramAlternation})([+*])?(?![A-Za-z0-9_])`, "g");
		_compiledDestinationParamCache.set(cacheKey, paramRe);
	}
	const replaceParams = (value, encodeParam) => value.replace(paramRe, (_token, key) => encodeParam(params[key]));
	const hashIndex = destination.indexOf("#");
	const beforeHash = hashIndex === -1 ? destination : destination.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : destination.slice(hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	if (queryIndex !== -1) {
		const beforeQuery = beforeHash.slice(0, queryIndex);
		const query = beforeHash.slice(queryIndex + 1);
		return `${replaceParams(beforeQuery, (value) => value)}?${replaceParams(query, encodeDestinationQueryParamValue)}${replaceParams(hash, (value) => value)}`;
	}
	return replaceParams(destination, (value) => value);
}
function encodeDestinationQueryParamValue(value) {
	const params = new URLSearchParams();
	params.set("", value);
	return params.toString().slice(1);
}
/**
* Substitute params into a redirect/rewrite destination and sanitize the
* result. Used by every redirect/rewrite branch — the substitution can
* introduce protocol-relative URLs (e.g. `//evil.com` from a decoded `%2F`
* in a catch-all param), which sanitizeDestination collapses.
*/
function substituteAndSanitizeDestination(destination, params) {
	return sanitizeDestination(substituteDestinationParams(destination, params));
}
/**
* Match Next.js's rewrite-specific prepareDestination behavior: source params
* that are not consumed by the destination path/host are exposed to the target
* page through query.
*
* https://github.com/vercel/next.js/blob/canary/packages/next/src/shared/lib/router/utils/prepare-destination.ts
*/
function substituteAndSanitizeRewriteDestination(destination, params) {
	const rewritten = substituteAndSanitizeDestination(destination, params);
	if (!shouldAppendRewriteParamsToQuery(destination, params)) return rewritten;
	const existingQueryKeys = getDestinationQueryKeys(destination);
	const paramsToAppend = [];
	for (const [key, value] of Object.entries(params)) {
		if (key === "nextInternalLocale" || existingQueryKeys.has(key)) continue;
		paramsToAppend.push([key, value]);
	}
	if (paramsToAppend.length === 0) return rewritten;
	return appendQueryParams(rewritten, paramsToAppend);
}
function shouldAppendRewriteParamsToQuery(destination, params) {
	const keys = Object.keys(params).filter((key) => key !== "nextInternalLocale");
	if (keys.length === 0) return false;
	return !destinationPathOrHostUsesParam(destination, keys);
}
function destinationPathOrHostUsesParam(destination, keys) {
	const pathAndHost = getDestinationPathAndHost(destination);
	if (!pathAndHost) return false;
	for (const key of keys) {
		const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		if (new RegExp(`:${escapedKey}([+*])?(?![A-Za-z0-9_])`).test(pathAndHost)) return true;
	}
	return false;
}
function getDestinationPathAndHost(destination) {
	const hashIndex = destination.indexOf("#");
	const beforeHash = hashIndex === -1 ? destination : destination.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : destination.slice(hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const beforeQuery = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
	const schemeMatch = /^[a-z][a-z0-9+.-]*:\/\//i.exec(beforeQuery);
	if (!schemeMatch) return `${beforeQuery}${hash}`;
	const withoutScheme = beforeQuery.slice(schemeMatch[0].length);
	const slashIndex = withoutScheme.indexOf("/");
	if (slashIndex === -1) return `${withoutScheme}${hash}`;
	return `${withoutScheme.slice(0, slashIndex)}${withoutScheme.slice(slashIndex)}${hash}`;
}
function getDestinationQueryKeys(destination) {
	const hashIndex = destination.indexOf("#");
	const beforeHash = hashIndex === -1 ? destination : destination.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	if (queryIndex === -1) return /* @__PURE__ */ new Set();
	const query = beforeHash.slice(queryIndex + 1);
	return new Set(new URLSearchParams(query).keys());
}
function appendQueryParams(url, params) {
	const hashIndex = url.indexOf("#");
	const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const base = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
	const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);
	const merged = new URLSearchParams(query);
	for (const [key, value] of params) merged.append(key, value);
	const search = merged.toString();
	return `${base}${search ? `?${search}` : ""}${hash}`;
}
/**
* Sanitize a redirect/rewrite destination to collapse protocol-relative URLs.
*
* After parameter substitution, a destination like `/:path*` can become
* `//evil.com` if the catch-all captured a decoded `%2F` (`/evil.com`).
* Browsers interpret `//evil.com` as a protocol-relative URL, redirecting
* users off-site.
*
* This function collapses any leading double (or more) slashes to a single
* slash for non-external (relative) destinations.
*/
function sanitizeDestination(dest) {
	if (dest.startsWith("http://") || dest.startsWith("https://")) return dest;
	dest = dest.replace(/^[\\/]+/, "/");
	return dest;
}
/**
* Check if a URL is external (absolute URL or protocol-relative).
* Detects any URL scheme (http:, https:, data:, javascript:, blob:, etc.)
* per RFC 3986, plus protocol-relative URLs (//).
*/
/**
* Merge the original request's query params into a config-redirect
* destination, preserving them on the resulting `Location`.
*
* Next.js carries the original request query across config redirects
* (`prepareDestination({ query: parsedUrl.query })` →
* `stringifyQuery(...)` in resolve-routes.ts). This matters for App Router
* RSC client navigations: the cache-busting `_rsc` query must survive the
* redirect so the browser's auto-followed request to the destination is
* still treated as an RSC fetch. Dropping it breaks RSC fetch semantics
* (issue #1529).
*
* Destination query params win — a request param is only carried over when
* the destination does not already specify that key. Mirrors the merge
* semantics in `proxyExternalRequest`. External destinations are returned
* untouched (a config redirect to another origin should not leak the
* original request's query).
*/
function preserveRedirectDestinationQuery(destination, requestSearch) {
	if (requestSearch === "" || requestSearch === "?" || isExternalUrl(destination)) return destination;
	const requestParams = new URLSearchParams(requestSearch);
	if ([...requestParams.keys()].length === 0) return destination;
	const hashIndex = destination.indexOf("#");
	const hash = hashIndex === -1 ? "" : destination.slice(hashIndex);
	const beforeHash = hashIndex === -1 ? destination : destination.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const pathPart = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
	const destQuery = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);
	const merged = new URLSearchParams(destQuery);
	const destKeys = new Set(merged.keys());
	for (const [key, value] of requestParams) if (!destKeys.has(key)) merged.append(key, value);
	const mergedQuery = merged.toString();
	return mergedQuery === "" ? `${pathPart}${hash}` : `${pathPart}?${mergedQuery}${hash}`;
}
/**
* Proxy an incoming request to an external URL and return the upstream response.
*
* Used for external rewrites (e.g. `/ph/:path*` → `https://us.i.posthog.com/:path*`).
* Next.js handles these as server-side reverse proxies, forwarding the request
* method, headers, and body to the external destination.
*
* Works in all runtimes (Node.js, Cloudflare Workers) via the standard fetch() API.
*/
async function proxyExternalRequest(request, externalUrl) {
	const originalUrl = new URL(request.url);
	const targetUrl = new URL(externalUrl);
	const destinationKeys = new Set(targetUrl.searchParams.keys());
	for (const [key, value] of originalUrl.searchParams) if (!destinationKeys.has(key)) targetUrl.searchParams.append(key, value);
	const headers = new Headers(request.headers);
	headers.set("host", targetUrl.host);
	stripHopByHopRequestHeaders(headers);
	const keysToDelete = [];
	for (const key of headers.keys()) if (key.startsWith("x-middleware-")) keysToDelete.push(key);
	for (const key of keysToDelete) headers.delete(key);
	headers.delete(VINEXT_PRERENDER_SECRET_HEADER);
	headers.delete(VINEXT_PRERENDER_ROUTE_PARAMS_HEADER);
	headers.delete(VINEXT_MW_CTX_HEADER);
	const method = request.method;
	const hasBody = method !== "GET" && method !== "HEAD";
	const init = {
		method,
		headers,
		redirect: "manual"
	};
	if (hasBody && request.body) {
		init.body = request.body;
		init.duplex = "half";
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 3e4);
	let upstreamResponse;
	try {
		upstreamResponse = await fetch(targetUrl.href, {
			...init,
			signal: controller.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") {
			console.error("[vinext] External rewrite proxy timeout:", targetUrl.href);
			return new Response("Gateway Timeout", { status: 504 });
		}
		console.error("[vinext] External rewrite proxy error:", e);
		return new Response("Bad Gateway", { status: 502 });
	} finally {
		clearTimeout(timeout);
	}
	const isNodeRuntime = typeof process !== "undefined" && !!process.versions?.node;
	const responseHeaders = new Headers();
	upstreamResponse.headers.forEach((value, key) => {
		const lower = key.toLowerCase();
		if (HOP_BY_HOP_HEADERS.has(lower)) return;
		if (isNodeRuntime && (lower === "content-encoding" || lower === "content-length")) return;
		responseHeaders.append(key, value);
	});
	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders
	});
}
/**
* Apply custom header rules from next.config.js.
* Returns an array of { key, value } pairs to set on the response.
*
* `ctx` provides the request context (cookies, headers, query, host) used
* to evaluate has/missing conditions. Next.js always has request context
* when evaluating headers, so this parameter is required.
*/
function matchHeaders(pathname, headers, ctx, basePathState = _BASEPATH_DEFAULT) {
	const pathnameHadTrailingSlash = pathname.length > 1 && pathname.endsWith("/");
	pathname = stripTrailingSlashForConfigMatch(pathname);
	const result = [];
	for (const rule of headers) {
		if (!shouldEvaluateRule(rule.basePath, basePathState)) continue;
		const source = pathnameHadTrailingSlash ? stripTrailingSlashForConfigMatch(rule.source) : rule.source;
		const sourceRegex = getCachedRegex(_compiledHeaderSourceCache, source, () => safeRegExp("^" + escapeHeaderSource(source) + "$", "i"));
		if (sourceRegex && sourceRegex.test(pathname)) {
			if (rule.has || rule.missing) {
				if (!checkHasConditions(rule.has, rule.missing, ctx)) continue;
			}
			result.push(...rule.headers);
		}
	}
	return result;
}
/**
* Escape a string for inclusion in a regex character class / alternation.
* Mirrors `escape-string-regexp` semantics used by Next.js's processRoutes.
*/
function _escapeRegexString(value) {
	return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
/**
* Apply Next.js i18n locale-prefix transformation to a set of redirect,
* rewrite, or header rules. Mirrors the relevant slice of Next.js's `processRoutes`
* (load-custom-routes.ts) with one deliberate divergence noted below.
*
* For each rule:
*   - If `locale === false` or no i18n is configured, the rule is emitted
*     untouched. This is the core of issue #1336 item 1: with `locale: false`
*     the user-supplied source is matched against the raw locale-prefixed
*     URL so a `:locale` segment in the source captures the prefix itself.
*   - Otherwise an internal locale-capture variant is produced whose source
*     starts with `/:nextInternalLocale(en|sv|nl)` so that locale-prefixed
*     URLs match. For redirects only, a second variant prefixed with
*     `/${defaultLocale}` is also emitted, matching Next.js exactly.
*   - **Vinext divergence**: we ALSO retain the original (unprefixed) source
*     so that requests for the default locale that arrive without a prefix
*     still match. Next.js solves this upstream by path-normalising every
*     incoming default-locale request to include the prefix
*     (`resolve-routes.ts` lines ~251-263); vinext currently does that
*     normalisation only inside the pages-server-entry route matcher, so
*     the rewrite/redirect matcher would otherwise miss unprefixed paths.
*     Keeping the unprefixed variant gives functionally identical behaviour
*     without requiring a server-wide path normalisation pass. The original
*     source is appended LAST so the locale-aware variants win when both
*     forms could match.
*
* Destinations that are local (start with `/`) are similarly rewritten with
* `/:nextInternalLocale` for the locale-capture variant so the locale
* survives the rewrite/redirect target.
*
* Mirrors the Next.js reference in
* packages/next/src/lib/load-custom-routes.ts — see `processRoutes`.
*/
function applyLocaleToRoutes(routes, i18n, type, options = {}) {
	if (!i18n || routes.length === 0) return routes;
	const trailingSlash = options.trailingSlash ?? false;
	const internalLocale = `/:nextInternalLocale(${i18n.locales.map(_escapeRegexString).join("|")})`;
	const suffixFor = (source) => source === "/" && !trailingSlash ? "" : source;
	const defaultLocales = type === "redirect" ? [i18n.defaultLocale] : [];
	const out = [];
	for (const r of routes) {
		if (r.locale === false) {
			out.push(r);
			continue;
		}
		const destination = "destination" in r ? r.destination : void 0;
		const isExternal = !!destination && !destination.startsWith("/");
		if (!isExternal) for (const locale of defaultLocales) {
			const localizedSource = `/${locale}${suffixFor(r.source)}`;
			out.push({
				...r,
				source: localizedSource
			});
		}
		const internalSource = `${internalLocale}${suffixFor(r.source)}`;
		let internalDestination = destination;
		if (internalDestination && internalDestination.startsWith("/") && !isExternal) internalDestination = `/:nextInternalLocale${internalDestination === "/" && !trailingSlash ? "" : internalDestination}`;
		const internalRoute = {
			...r,
			source: internalSource
		};
		if ("destination" in internalRoute && internalDestination !== void 0) internalRoute.destination = internalDestination;
		out.push(internalRoute);
		out.push(r);
	}
	return out;
}
//#endregion
export { applyLocaleToRoutes, applyMiddlewareRequestHeaders, checkHasConditions, escapeHeaderSource, isExternalUrl, isSafeRegex, matchConfigPattern, matchHeaders, matchRedirect, matchRewrite, matchesRewriteSource, normalizeHost, parseCookies, preserveRedirectDestinationQuery, proxyExternalRequest, requestContextFromRequest, safeRegExp, sanitizeDestination };
