import { hasBasePath, removeTrailingSlash, stripBasePath } from "../utils/base-path.js";
import "../utils/protocol-headers.js";
import { INTERNAL_HEADERS, VINEXT_INTERNAL_HEADERS, VINEXT_STATIC_FILE_HEADER } from "./headers.js";
import { forbiddenResponse, notFoundResponse } from "./http-error-responses.js";
import { isOpenRedirectShaped } from "./open-redirect.js";
//#region src/server/request-pipeline.ts
const PATHNAME_CANONICALIZATION_BASE = new URL("http://vinext.invalid/");
/**
* Apply the URL Standard's pathname canonicalization without decoding and
* re-encoding ordinary percent escapes.
*
* In particular, WHATWG URLs remove literal and percent-encoded dot segments
* (`/%2e/about` becomes `/about`) while preserving unrelated spellings such
* as `/%61bout`, `%2F`, `%5C`, and `%252F` byte-for-byte. Node request adapters
* must do this before comparing raw route/config/basePath identity so those
* comparisons agree with the `Request` that userland eventually receives.
*/
function canonicalizeRequestPathname(pathname) {
	const url = new URL(PATHNAME_CANONICALIZATION_BASE);
	url.pathname = pathname;
	return url.pathname;
}
/** Canonicalize only the pathname portion while preserving the raw query. */
function canonicalizeRequestUrlPathname(url) {
	const queryIndex = url.indexOf("?");
	const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
	const search = queryIndex === -1 ? "" : url.slice(queryIndex);
	return canonicalizeRequestPathname(pathname) + search;
}
/**
* Shared request pipeline utilities.
*
* Extracted from generated entries and server hot paths to keep codegen focused
* on app shape while normal modules own request behavior. Some dev-server and
* worker-template setup code still has inline normalization that should be
* migrated in follow-up work.
*
* These utilities handle the common request lifecycle steps: protocol-
* relative URL guards, basePath stripping, trailing slash normalization,
* and CSRF origin validation.
*
* Plain-text error response builders (forbidden / not-found / etc.) live in
* `./http-error-responses.ts`.
*/
/**
* Guard against protocol-relative URL open redirects.
*
* Paths like `//example.com/` would be redirected to `//example.com` by the
* trailing-slash normalizer, which browsers interpret as `http://example.com`.
* Backslashes are equivalent to forward slashes in the URL spec
* (e.g. `/\evil.com` is treated as `//evil.com` by browsers).
*
* Next.js returns 404 for these paths. We check the RAW pathname before
* normalization so the guard fires before normalizePath collapses `//`.
*
* Percent-encoded variants are also blocked because:
*   - `%5C` decodes to `\` (browsers treat `/\evil.com` as `//evil.com`).
*   - `%2F` decodes to `/` (so `/%2F/evil.com` effectively becomes `//evil.com`).
* These forms survive segment-wise decoding that re-encodes path delimiters
* (e.g. `normalizePathnameForRouteMatchStrict`), so a later trailing-slash
* redirect would still echo the encoded form in its `Location` header. See
* `isOpenRedirectShaped` for the full list of rejected leading-segment forms.
*
* @param rawPathname - The raw pathname from the URL, before any normalization
* @returns A 404 Response if the path is protocol-relative, or null to continue
*/
function guardProtocolRelativeUrl(rawPathname) {
	if (isOpenRedirectShaped(rawPathname)) return notFoundResponse();
	return null;
}
const FILE_LIKE_PATHNAME_RE = /\.[^/]+\/?$/;
function isWellKnownPathname(pathname) {
	return pathname === "/.well-known" || pathname.startsWith("/.well-known/");
}
function createStaticFileSignal(pathname, context) {
	const headers = new Headers({ [VINEXT_STATIC_FILE_HEADER]: encodeURIComponent(pathname) });
	if (context.headers) for (const [key, value] of context.headers) headers.append(key, value);
	return new Response(null, {
		status: context.status ?? 200,
		headers
	});
}
/**
* Resolve the public/ filesystem-route slot in the Next.js routing order.
*
* Public files are checked after middleware and before afterFiles/fallback
* rewrites. The generated App Router entry provides the public-file set; this
* helper owns the request-method and RSC exclusions plus static-file signaling.
*/
function resolvePublicFileRoute(options) {
	if (options.request.method !== "GET" && options.request.method !== "HEAD") return null;
	if (options.pathname.endsWith(".rsc")) return null;
	if (!options.publicFiles.has(options.cleanPathname)) return null;
	return createStaticFileSignal(options.cleanPathname, options.middlewareContext);
}
function normalizeTrailingSlashPathname(pathname, trailingSlash) {
	if (pathname === "/" || pathname === "/api" || pathname.startsWith("/api/")) return null;
	const hasTrailing = pathname.endsWith("/");
	if (trailingSlash) {
		if (isWellKnownPathname(pathname)) return null;
		if (FILE_LIKE_PATHNAME_RE.test(pathname)) {
			const normalized = removeTrailingSlash(pathname);
			return normalized === pathname ? null : normalized;
		}
		if (!hasTrailing && !pathname.endsWith(".rsc")) return `${pathname}/`;
		return null;
	}
	if (hasTrailing) return removeTrailingSlash(pathname);
	return null;
}
/**
* Check if the pathname needs a trailing slash redirect, and return the
* redirect Response if so.
*
* Follows Next.js behavior:
* - `/api` routes are never redirected
* - The root path `/` is never redirected
* - If `trailingSlash` is true, redirect `/about` → `/about/`
* - If `trailingSlash` is true, redirect file-looking `/file.ext/` → `/file.ext`
* - If `trailingSlash` is true, do not redirect `/.well-known/*`
* - If `trailingSlash` is false (default), redirect `/about/` → `/about`
*
* @param pathname - The basePath-stripped pathname
* @param basePath - The basePath to prepend to the redirect Location
* @param trailingSlash - Whether trailing slashes should be enforced
* @param search - The query string (including `?`) to preserve in the redirect
* @returns A 308 redirect Response, or null if no redirect is needed
*/
function normalizeTrailingSlash(pathname, basePath, trailingSlash, search) {
	if (pathname === "/" || pathname === "/api" || pathname.startsWith("/api/")) return null;
	if (isOpenRedirectShaped(pathname)) return notFoundResponse();
	const normalizedPathname = normalizeTrailingSlashPathname(pathname, trailingSlash);
	if (normalizedPathname === null) return null;
	const encodedPathname = normalizedPathname.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@/%]/gu, encodeURIComponent);
	return new Response(null, {
		status: 308,
		headers: { Location: basePath + encodedPathname + search }
	});
}
/**
* Validate CSRF origin for server action requests.
*
* Matches Next.js behavior: compares the Origin header against the Host
* header. If they don't match, the request is rejected with 403 unless
* the origin is in the allowedOrigins list.
*
* @param request - The incoming Request
* @param allowedOrigins - Origins from experimental.serverActions.allowedOrigins
* @returns A 403 Response if origin validation fails, or null to continue
*/
function validateCsrfOrigin(request, allowedOrigins = []) {
	const originHeader = request.headers.get("origin");
	if (!originHeader) return null;
	if (originHeader === "null") {
		if (allowedOrigins.includes("null")) return null;
		console.warn(`[vinext] CSRF origin "null" blocked for server action. To allow requests from sandboxed contexts, add "null" to experimental.serverActions.allowedOrigins.`);
		return forbiddenResponse();
	}
	let originHost;
	try {
		originHost = new URL(originHeader).host.toLowerCase();
	} catch {
		return forbiddenResponse();
	}
	const hostHeader = (request.headers.get("host") || "").split(",")[0].trim().toLowerCase() || new URL(request.url).host.toLowerCase();
	if (originHost === hostHeader) return null;
	if (allowedOrigins.length > 0 && isOriginAllowed(originHost, allowedOrigins)) return null;
	console.warn(`[vinext] CSRF origin mismatch: origin "${originHost}" does not match host "${hostHeader}". Blocking server action request.`);
	return forbiddenResponse();
}
/**
* Reject malformed Flight container reference graphs in server action payloads.
*
* `@vitejs/plugin-rsc` vendors its own React Flight decoder. Malicious action
* payloads can abuse container references (`$Q`, `$W`, `$i`) to trigger very
* expensive deserialization before the action is even looked up.
*
* Legitimate React-encoded container payloads use separate numeric backing
* fields (e.g. field `1` plus root field `0` containing `"$Q1"`). We reject
* numeric backing-field graphs that contain missing backing fields or cycles.
* Regular user form fields are ignored entirely.
*/
async function validateServerActionPayload(body) {
	const maxNumericFields = 4096;
	const maxContainerReferences = 16384;
	const maxContainerDepth = 1024;
	const containerRefRe = /"\$([QWi])([0-9a-f]+)(?=[:"])/gi;
	const fieldRefs = /* @__PURE__ */ new Map();
	let referenceCount = 0;
	const invalidPayloadResponse = () => new Response("Invalid server action payload", {
		status: 400,
		headers: { "Content-Type": "text/plain" }
	});
	const collectRefs = (fieldKey, text) => {
		if (fieldRefs.has(fieldKey)) return true;
		if (fieldRefs.size >= maxNumericFields) return false;
		const refs = /* @__PURE__ */ new Set();
		let match;
		containerRefRe.lastIndex = 0;
		while ((match = containerRefRe.exec(text)) !== null) {
			const previousSize = refs.size;
			refs.add(String(Number.parseInt(match[2], 16)));
			if (refs.size !== previousSize && ++referenceCount > maxContainerReferences) return false;
		}
		fieldRefs.set(fieldKey, refs);
		return true;
	};
	if (typeof body === "string") {
		if (!collectRefs("0", body)) return invalidPayloadResponse();
	} else for (const [key, value] of body.entries()) {
		if (!/^\d+$/.test(key)) continue;
		if (typeof value === "string") {
			if (!collectRefs(key, value)) return invalidPayloadResponse();
			continue;
		}
		if (typeof value?.text === "function") {
			if (!collectRefs(key, await value.text())) return invalidPayloadResponse();
		}
	}
	if (fieldRefs.size === 0) return null;
	const knownFields = new Set(fieldRefs.keys());
	for (const refs of fieldRefs.values()) for (const ref of refs) if (!knownFields.has(ref)) return invalidPayloadResponse();
	const state = /* @__PURE__ */ new Map();
	for (const root of fieldRefs.keys()) {
		if (state.has(root)) continue;
		const stack = [{
			node: root,
			refs: [...fieldRefs.get(root) ?? []],
			nextRef: 0
		}];
		state.set(root, "visiting");
		while (stack.length > 0) {
			if (stack.length > maxContainerDepth) return invalidPayloadResponse();
			const frame = stack[stack.length - 1];
			const ref = frame.refs[frame.nextRef++];
			if (ref === void 0) {
				state.set(frame.node, "visited");
				stack.pop();
				continue;
			}
			const refState = state.get(ref);
			if (refState === "visiting") return invalidPayloadResponse();
			if (refState === "visited") continue;
			state.set(ref, "visiting");
			stack.push({
				node: ref,
				refs: [...fieldRefs.get(ref) ?? []],
				nextRef: 0
			});
		}
	}
	return null;
}
/**
* Check if an origin matches any pattern in the allowed origins list.
* Supports wildcard subdomains (e.g. `*.example.com`).
*/
/**
* Segment-by-segment domain matching for wildcard origin patterns.
* `*` matches exactly one DNS label; `**` matches one or more labels.
*
* Ported from Next.js: packages/next/src/server/app-render/csrf-protection.ts
* https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/csrf-protection.ts
*/
function matchWildcardDomain(domain, pattern) {
	const normalizedDomain = domain.replace(/[A-Z]/g, (c) => c.toLowerCase());
	const normalizedPattern = pattern.replace(/[A-Z]/g, (c) => c.toLowerCase());
	const domainParts = normalizedDomain.split(".");
	const patternParts = normalizedPattern.split(".");
	if (patternParts.length < 1) return false;
	if (domainParts.length < patternParts.length) return false;
	if (patternParts.length === 1 && (patternParts[0] === "*" || patternParts[0] === "**")) return false;
	while (patternParts.length) {
		const patternPart = patternParts.pop();
		const domainPart = domainParts.pop();
		if (patternPart === void 0) return false;
		switch (patternPart) {
			case "": return false;
			case "*": if (domainPart) continue;
			else return false;
			case "**":
				if (patternParts.length > 0) return false;
				return domainPart !== void 0;
			default: if (patternPart !== domainPart) return false;
		}
	}
	return domainParts.length === 0;
}
function isOriginAllowed(origin, allowed) {
	for (const pattern of allowed) if (pattern.includes("*")) {
		if (matchWildcardDomain(origin, pattern)) return true;
	} else if (origin.toLowerCase() === pattern.toLowerCase()) return true;
	return false;
}
/**
* Strip internal `x-middleware-*` headers from a Headers object.
*
* Middleware uses `x-middleware-*` headers as internal signals (e.g.
* `x-middleware-next`, `x-middleware-rewrite`, `x-middleware-request-*`).
* These must be removed before sending the response to the client.
*
* @param headers - The Headers object to modify in place
*/
function processMiddlewareHeaders(headers) {
	const keysToDelete = [];
	for (const key of headers.keys()) if (key.startsWith("x-middleware-") && key !== "x-middleware-cache") keysToDelete.push(key);
	for (const key of keysToDelete) headers.delete(key);
}
const STRIPPED_INTERNAL_HEADERS = /* @__PURE__ */ new Set([...INTERNAL_HEADERS, ...VINEXT_INTERNAL_HEADERS]);
/**
* Strip internal headers from an inbound request so they cannot be forged by
* an external attacker to influence routing or impersonate internal state.
*
* Must be called at every request entry point BEFORE middleware, routing,
* or any handler logic accesses the request headers.
*
* Returns a new Headers object with internal headers removed. The input
* is never mutated — Request.headers is immutable in Workers/miniflare
* environments (see applyMiddlewareRequestHeaders in config-matchers.ts
* for the same cloning pattern).
*
* @param headers - The source Headers (never modified)
* @returns A new Headers with internal framework headers removed
*/
function filterInternalHeaders(headers) {
	const filtered = new Headers();
	for (const [key, value] of headers) if (!STRIPPED_INTERNAL_HEADERS.has(key.toLowerCase())) filtered.append(key, value);
	return filtered;
}
function getRequestCf(request) {
	const cf = Reflect.get(request, "cf");
	return cf === void 0 ? void 0 : cf;
}
/**
* Clone a Request while overriding headers, preserving metadata when possible.
*
* Some runtimes (Workers) allow `new Request(request, { headers })` which
* retains redirect/signal/cf data. Others (Node/undici across realms) can throw
* when cloning a foreign Request instance. In that case, fall back to building
* a RequestInit with best-effort metadata.
*/
function cloneRequestWithHeaders(request, headers) {
	let cloned;
	try {
		cloned = new Request(request, { headers });
	} catch {
		const init = {
			method: request.method,
			headers,
			body: request.body ?? void 0,
			redirect: request.redirect,
			signal: request.signal,
			integrity: request.integrity,
			cache: request.cache,
			mode: request.mode,
			credentials: request.credentials,
			referrer: request.referrer,
			referrerPolicy: request.referrerPolicy
		};
		if (request.body) init.duplex = "half";
		cloned = new Request(request.url, init);
	}
	const cf = getRequestCf(request);
	if (cf !== void 0) Object.defineProperty(cloned, "cf", {
		value: cf,
		enumerable: true,
		configurable: true
	});
	return cloned;
}
/**
* Clone a Request while overriding the URL, preserving headers and metadata
* when possible.
*
* Mirrors `cloneRequestWithHeaders`, but rewrites the URL instead of the
* headers. Workers support `new Request(url, request)` to copy method/headers/
* body onto a new URL; Node/undici can throw on a foreign Request instance, so
* we fall back to a manual RequestInit. `new Request()` does not copy the
* Workers-specific `cf` property and omits `duplex` for streaming bodies, so
* both are handled explicitly — the same reasons `cloneRequestWithHeaders`
* exists.
*/
function cloneRequestWithUrl(request, url) {
	let cloned;
	try {
		cloned = new Request(url, request);
	} catch {
		const init = {
			method: request.method,
			headers: request.headers,
			body: request.body ?? void 0,
			redirect: request.redirect,
			signal: request.signal,
			integrity: request.integrity,
			cache: request.cache,
			mode: request.mode,
			credentials: request.credentials,
			referrer: request.referrer,
			referrerPolicy: request.referrerPolicy
		};
		if (request.body) init.duplex = "half";
		cloned = new Request(url, init);
	}
	const cf = getRequestCf(request);
	if (cf !== void 0) Object.defineProperty(cloned, "cf", {
		value: cf,
		enumerable: true,
		configurable: true
	});
	return cloned;
}
//#endregion
export { INTERNAL_HEADERS, VINEXT_INTERNAL_HEADERS, canonicalizeRequestPathname, canonicalizeRequestUrlPathname, cloneRequestWithHeaders, cloneRequestWithUrl, createStaticFileSignal, filterInternalHeaders, guardProtocolRelativeUrl, hasBasePath, isOpenRedirectShaped, isOriginAllowed, normalizeTrailingSlash, normalizeTrailingSlashPathname, processMiddlewareHeaders, resolvePublicFileRoute, stripBasePath, validateCsrfOrigin, validateServerActionPayload };
