import { hasBasePath, stripBasePath } from "../utils/base-path.js";
import { getRequestExecutionContext } from "./request-context.js";
import { MIDDLEWARE_SET_COOKIE_HEADER } from "../utils/protocol-headers.js";
import { MIDDLEWARE_NEXT_HEADER, MIDDLEWARE_REWRITE_HEADER } from "../server/headers.js";
import { encodeMiddlewareRequestHeaders } from "../utils/middleware-request-headers.js";
import { serializeSetCookie, validateCookieName } from "./internal/cookie-serialize.js";
import { parseEdgeRequestCookieHeader } from "../utils/parse-cookie.js";
import { assertSafeNavigationUrl } from "./url-safety.js";
//#region src/shims/server.ts
/**
* next/server shim
*
* Provides NextRequest, NextResponse, and related types that work with
* standard Web APIs (Request/Response). This means they work on Node,
* Cloudflare Workers, Deno, and any WinterCG-compatible runtime.
*
* This is a pragmatic subset — we implement the most commonly used APIs
* rather than bug-for-bug parity with Next.js internals.
*/
/** @deprecated Import ImageResponse from `next/og` instead. */
function ImageResponse() {
	throw new Error("ImageResponse has moved from next/server to next/og");
}
const _USE_CACHE_ALS_KEY = Symbol.for("vinext.cacheRuntime.contextAls");
const _UNSTABLE_CACHE_ALS_KEY = Symbol.for("vinext.unstableCache.als");
const _g = globalThis;
/**
* Record an invalid dynamic usage error on the request context so it survives
* user try/catch and can be forwarded to the dev overlay on client-side navigations.
*/
function _recordInvalidDynamicUsageError(error) {
	try {
		const ctx = _g[Symbol.for("vinext.unifiedRequestContext.als")]?.getStore();
		if (ctx) ctx.invalidDynamicUsageError = error;
	} catch {}
}
function _throwIfInsideCacheScope(apiName) {
	if (_g[_USE_CACHE_ALS_KEY]?.getStore() != null) {
		const error = /* @__PURE__ */ new Error(`\`${apiName}\` cannot be called inside "use cache". If you need this data inside a cached function, call \`${apiName}\` outside and pass the required data as an argument.`);
		_recordInvalidDynamicUsageError(error);
		throw error;
	}
	if (_g[_UNSTABLE_CACHE_ALS_KEY]?.getStore() === true) {
		const error = /* @__PURE__ */ new Error(`\`${apiName}\` cannot be called inside a function cached with \`unstable_cache()\`. If you need this data inside a cached function, call \`${apiName}\` outside and pass the required data as an argument.`);
		_recordInvalidDynamicUsageError(error);
		throw error;
	}
}
var NextRequest = class extends Request {
	_nextUrl;
	_url;
	_cookies;
	constructor(input, init) {
		validateURL(typeof input !== "string" && "url" in input ? input.url : String(input));
		const { nextConfig: _nextConfig, ...requestInit } = init ?? {};
		if (input instanceof Request) {
			const requestInput = requestInit.body === void 0 && input.body && !input.bodyUsed ? input.clone() : input;
			super(requestInput, requestInit);
			const cf = Reflect.get(input, "cf");
			if (cf !== void 0) Object.defineProperty(this, "cf", {
				value: cf,
				enumerable: true,
				configurable: true
			});
		} else super(input, requestInit);
		const url = typeof input === "string" ? new URL(input, "http://localhost") : input instanceof URL ? input : new URL(input.url, "http://localhost");
		const i18n = _nextConfig?.i18n ? {
			locales: [..._nextConfig.i18n.locales],
			defaultLocale: _nextConfig.i18n.defaultLocale,
			domains: _nextConfig.i18n.domains?.map((domain) => ({
				...domain,
				locales: domain.locales ? [...domain.locales] : void 0
			}))
		} : void 0;
		const urlConfig = _nextConfig ? {
			basePath: _nextConfig.basePath,
			nextConfig: {
				i18n,
				trailingSlash: _nextConfig.trailingSlash
			}
		} : void 0;
		this._nextUrl = new NextURL(url, void 0, urlConfig);
		this._url = process.env.__NEXT_NO_MIDDLEWARE_URL_NORMALIZE ? url.toString() : this._nextUrl.toString();
		this._cookies = new RequestCookies(this.headers);
	}
	get nextUrl() {
		return this._nextUrl;
	}
	get url() {
		return this._url;
	}
	get cookies() {
		return this._cookies;
	}
	get page() {
		throw new Error("NextRequest.page has been removed; use URLPattern instead");
	}
	get ua() {
		throw new Error("NextRequest.ua has been removed; use userAgent() instead");
	}
	/**
	* Client IP address. Prefers Cloudflare's trusted CF-Connecting-IP header
	* over the spoofable X-Forwarded-For. Returns undefined if unavailable.
	*/
	get ip() {
		return this.headers.get("cf-connecting-ip") ?? this.headers.get("x-real-ip") ?? this.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? void 0;
	}
	/**
	* Geolocation data. Platform-dependent (e.g., Cloudflare, Vercel).
	* Returns undefined if not available.
	*/
	get geo() {
		const country = this.headers.get("cf-ipcountry") ?? this.headers.get("x-vercel-ip-country") ?? void 0;
		if (!country) return void 0;
		return {
			country,
			city: this.headers.get("cf-ipcity") ?? this.headers.get("x-vercel-ip-city") ?? void 0,
			region: this.headers.get("cf-region") ?? this.headers.get("x-vercel-ip-country-region") ?? void 0,
			latitude: this.headers.get("cf-iplatitude") ?? this.headers.get("x-vercel-ip-latitude") ?? void 0,
			longitude: this.headers.get("cf-iplongitude") ?? this.headers.get("x-vercel-ip-longitude") ?? void 0
		};
	}
	/**
	* The build ID of the Next.js application.
	* Delegates to `nextUrl.buildId` to match Next.js API surface.
	* Can be used in middleware to detect deployment skew between client and server.
	*/
	get buildId() {
		return this._nextUrl.buildId;
	}
};
/** Valid HTTP redirect status codes, matching Next.js's REDIRECTS set. */
const REDIRECT_STATUSES = /* @__PURE__ */ new Set([
	301,
	302,
	303,
	307,
	308
]);
function validateURL(url) {
	assertSafeNavigationUrl(String(url));
	try {
		return String(new URL(String(url)));
	} catch (error) {
		throw new Error(`URL is malformed "${String(url)}". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls`, { cause: error });
	}
}
var NextResponse = class NextResponse extends Response {
	_cookies;
	constructor(body, init) {
		super(body, init);
		this._cookies = new MiddlewareResponseCookies(this.headers);
	}
	get cookies() {
		return this._cookies;
	}
	/**
	* Create a JSON response.
	*/
	static json(body, init) {
		const headers = new Headers(init?.headers);
		if (!headers.has("content-type")) headers.set("content-type", "application/json");
		return new NextResponse(JSON.stringify(body), {
			...init,
			headers
		});
	}
	/**
	* Create a redirect response.
	*/
	static redirect(url, init) {
		const status = typeof init === "number" ? init : init?.status ?? 307;
		if (!REDIRECT_STATUSES.has(status)) throw new RangeError(`Failed to execute "redirect" on "response": Invalid status code`);
		const headers = new Headers(typeof init === "object" ? init?.headers : void 0);
		headers.set("Location", validateURL(url));
		return new NextResponse(null, {
			status,
			headers
		});
	}
	/**
	* Create a rewrite response (middleware pattern).
	* Sets the x-middleware-rewrite header.
	*/
	static rewrite(destination, init) {
		const headers = new Headers(init?.headers);
		headers.set(MIDDLEWARE_REWRITE_HEADER, validateURL(destination));
		if (init?.request?.headers) encodeMiddlewareRequestHeaders(headers, init.request.headers);
		return new NextResponse(null, {
			...init,
			headers
		});
	}
	/**
	* Continue to the next handler (middleware pattern).
	* Sets the x-middleware-next header.
	*/
	static next(init) {
		const headers = new Headers(init?.headers);
		headers.set(MIDDLEWARE_NEXT_HEADER, "1");
		if (init?.request?.headers) encodeMiddlewareRequestHeaders(headers, init.request.headers);
		return new NextResponse(null, {
			...init,
			headers
		});
	}
};
var NextURL = class NextURL {
	/** Internal URL stores the pathname WITHOUT basePath or locale prefix. */
	_url;
	/**
	* The configured basePath (from nextConfig). May differ from the active
	* `_basePath`: parsing only activates basePath when the URL's pathname
	* actually carries the configured prefix.
	*/
	_configBasePath;
	_basePath;
	_trailingSlash;
	_locale;
	_configDefaultLocale;
	_defaultLocale;
	_locales;
	_domains;
	_domainLocale;
	constructor(input, base, config) {
		this._url = new URL(input.toString(), base);
		this._configBasePath = config?.basePath ?? "";
		this._basePath = this._configBasePath;
		this._trailingSlash = config?.nextConfig?.trailingSlash ?? false;
		this._stripBasePath();
		const i18n = config?.nextConfig?.i18n;
		if (i18n) {
			this._locales = [...i18n.locales];
			this._domains = i18n.domains?.map((domain) => ({
				...domain,
				locales: domain.locales ? [...domain.locales] : void 0
			}));
			this._configDefaultLocale = i18n.defaultLocale;
			this._analyzeI18n();
		}
	}
	/** Strip basePath prefix from the internal pathname.
	* Mirrors Next.js's getNextPathnameInfo (re-run by NextURL.analyze() on
	* every parse, including `href` reassignment): basePath is only considered
	* active when the URL's pathname actually starts with the configured
	* basePath prefix. If the pathname is outside the basePath, the active
	* basePath is cleared to "" so that request.nextUrl.basePath reflects the
	* actual URL rather than the config value; if a later `href` assignment
	* moves the URL back inside the basePath, it is re-activated from the
	* configured value. This matches the Next.js behavior tested by
	* middleware-base-path's "should execute from absolute paths" case.
	*/
	_stripBasePath() {
		if (!this._configBasePath) return;
		if (!hasBasePath(this._url.pathname, this._configBasePath)) {
			this._basePath = "";
			return;
		}
		this._basePath = this._configBasePath;
		this._url.pathname = stripBasePath(this._url.pathname, this._configBasePath);
	}
	/** Extract locale from pathname, stripping it from the internal URL. */
	_detectPathnameLocale(locales) {
		const segments = this._url.pathname.split("/");
		const candidate = segments[1]?.toLowerCase();
		const match = locales.find((l) => l.toLowerCase() === candidate);
		if (match) this._url.pathname = "/" + segments.slice(2).join("/");
		return match;
	}
	_analyzeI18n() {
		if (!this._locales || !this._configDefaultLocale) return;
		const detectedLocale = this._detectPathnameLocale(this._locales);
		const detectedLocaleLower = detectedLocale?.toLowerCase();
		const hostname = this._url.hostname.toLowerCase();
		this._domainLocale = this._domains?.find((domain) => domain.domain.split(":", 1)[0].toLowerCase() === hostname || detectedLocaleLower === domain.defaultLocale.toLowerCase() || domain.locales?.some((locale) => locale.toLowerCase() === detectedLocaleLower));
		this._defaultLocale = this._domainLocale?.defaultLocale ?? this._configDefaultLocale;
		this._locale = detectedLocale ?? this._defaultLocale;
	}
	/**
	* Reconstruct the full pathname with basePath + locale prefix and apply
	* the configured trailingSlash policy.
	* Mirrors Next.js's internal formatNextPathnameInfo().
	*/
	_formatPathname() {
		let prefix = this._basePath;
		const inner = this._url.pathname;
		const innerLower = inner.toLowerCase();
		if (!(innerLower === "/api" || innerLower.startsWith("/api/")) && this._locale && this._locale !== this._defaultLocale) prefix += "/" + this._locale;
		const composed = !prefix ? inner : inner === "/" ? prefix : prefix + inner;
		return this._applyTrailingSlash(composed);
	}
	/**
	* Apply the configured trailingSlash policy to a composed pathname. Matches
	* Next.js's `formatNextPathnameInfo`: when `trailingSlash` is true, add a
	* trailing slash unless the path is empty/root; when false, strip a trailing
	* slash unless the path is empty/root.
	*/
	_applyTrailingSlash(pathname) {
		if (pathname === "" || pathname === "/") return pathname;
		if (this._trailingSlash) return pathname.endsWith("/") ? pathname : pathname + "/";
		return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
	}
	get href() {
		const formatted = this._formatPathname();
		if (formatted === this._url.pathname) return this._url.href;
		const { href, pathname, search, hash } = this._url;
		const baseEnd = href.length - pathname.length - search.length - hash.length;
		return href.slice(0, baseEnd) + formatted + search + hash;
	}
	set href(value) {
		this._url.href = value;
		this._stripBasePath();
		this._analyzeI18n();
	}
	get origin() {
		return this._url.origin;
	}
	get protocol() {
		return this._url.protocol;
	}
	set protocol(value) {
		this._url.protocol = value;
	}
	get username() {
		return this._url.username;
	}
	set username(value) {
		this._url.username = value;
	}
	get password() {
		return this._url.password;
	}
	set password(value) {
		this._url.password = value;
	}
	get host() {
		return this._url.host;
	}
	set host(value) {
		this._url.host = value;
	}
	get hostname() {
		return this._url.hostname;
	}
	set hostname(value) {
		this._url.hostname = value;
	}
	get port() {
		return this._url.port;
	}
	set port(value) {
		this._url.port = value;
	}
	/** Returns the pathname WITHOUT basePath or locale prefix. */
	get pathname() {
		return this._url.pathname;
	}
	set pathname(value) {
		this._url.pathname = value;
	}
	get search() {
		return this._url.search;
	}
	set search(value) {
		this._url.search = value;
	}
	get searchParams() {
		return this._url.searchParams;
	}
	get hash() {
		return this._url.hash;
	}
	set hash(value) {
		this._url.hash = value;
	}
	get basePath() {
		return this._basePath;
	}
	set basePath(value) {
		this._basePath = value === "" ? "" : value.startsWith("/") ? value : "/" + value;
	}
	get locale() {
		return this._locale ?? "";
	}
	set locale(value) {
		if (this._locales) {
			if (!value) {
				this._locale = this._defaultLocale;
				return;
			}
			if (!this._locales.includes(value)) throw new TypeError(`The locale "${value}" is not in the configured locales: ${this._locales.join(", ")}`);
		}
		this._locale = this._locales ? value : this._locale;
	}
	get defaultLocale() {
		return this._defaultLocale;
	}
	get domainLocale() {
		if (!this._domainLocale) return void 0;
		return {
			...this._domainLocale,
			locales: this._domainLocale.locales ? [...this._domainLocale.locales] : void 0
		};
	}
	get locales() {
		return this._locales ? [...this._locales] : void 0;
	}
	clone() {
		const nextConfig = {};
		if (this._locales) nextConfig.i18n = {
			locales: [...this._locales],
			defaultLocale: this._configDefaultLocale,
			domains: this._domains?.map((domain) => ({
				...domain,
				locales: domain.locales ? [...domain.locales] : void 0
			}))
		};
		if (this._trailingSlash) nextConfig.trailingSlash = true;
		const config = {
			basePath: this._basePath,
			nextConfig: Object.keys(nextConfig).length > 0 ? nextConfig : void 0
		};
		return new NextURL(this.href, void 0, config);
	}
	toString() {
		return this.href;
	}
	toJSON() {
		return this.href;
	}
	/**
	* The build ID of the Next.js application.
	* Set from `generateBuildId` in next.config.js, or a random UUID if not configured.
	* Can be used in middleware to detect deployment skew between client and server.
	* Matches the Next.js API: `request.nextUrl.buildId`.
	*/
	get buildId() {
		return process.env.__VINEXT_BUILD_ID ?? void 0;
	}
};
var RequestCookies = class {
	_headers;
	_parsed;
	constructor(headers) {
		this._headers = headers;
		this._parsed = parseEdgeRequestCookieHeader(headers.get("cookie") ?? "");
	}
	get(name) {
		const value = this._parsed.get(name);
		return value !== void 0 ? {
			name,
			value
		} : void 0;
	}
	getAll(nameOrOptions) {
		const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions?.name;
		return [...this._parsed.entries()].filter(([cookieName]) => name === void 0 || cookieName === name).map(([cookieName, value]) => ({
			name: cookieName,
			value
		}));
	}
	has(name) {
		return this._parsed.has(name);
	}
	set(nameOrOptions, value) {
		let cookieName;
		let cookieValue;
		if (typeof nameOrOptions === "string") {
			cookieName = nameOrOptions;
			cookieValue = value ?? "";
		} else {
			cookieName = nameOrOptions.name;
			cookieValue = nameOrOptions.value;
		}
		validateCookieName(cookieName);
		this._parsed.set(cookieName, cookieValue);
		this._syncHeader();
		return this;
	}
	delete(names) {
		if (Array.isArray(names)) {
			const results = names.map((name) => {
				validateCookieName(name);
				return this._parsed.delete(name);
			});
			this._syncHeader();
			return results;
		}
		validateCookieName(names);
		const result = this._parsed.delete(names);
		this._syncHeader();
		return result;
	}
	clear() {
		this._parsed.clear();
		this._syncHeader();
		return this;
	}
	get size() {
		return this._parsed.size;
	}
	toString() {
		return this._serialize();
	}
	_serialize() {
		return [...this._parsed.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
	}
	_syncHeader() {
		if (this._parsed.size === 0) this._headers.delete("cookie");
		else this._headers.set("cookie", this._serialize());
	}
	[Symbol.iterator]() {
		return new Map(this.getAll().map((cookie) => [cookie.name, cookie])).entries();
	}
};
var ReadonlyRequestCookiesError = class ReadonlyRequestCookiesError extends Error {
	constructor() {
		super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
	}
	static callable() {
		throw new ReadonlyRequestCookiesError();
	}
};
const REQUEST_HEADERS_MUTATING_METHODS = /* @__PURE__ */ new Set([
	"set",
	"delete",
	"append"
]);
var ReadonlyRequestHeadersError = class ReadonlyRequestHeadersError extends Error {
	constructor() {
		super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
	}
	static callable() {
		throw new ReadonlyRequestHeadersError();
	}
};
function sealRequestHeaders(headers) {
	return new Proxy(headers, { get(target, prop) {
		if (typeof prop === "string" && REQUEST_HEADERS_MUTATING_METHODS.has(prop)) return ReadonlyRequestHeadersError.callable;
		const value = Reflect.get(target, prop, target);
		return typeof value === "function" ? value.bind(target) : value;
	} });
}
function sealRequestCookies(cookies) {
	return new Proxy(cookies, { get(target, prop) {
		if (prop === "set" || prop === "delete" || prop === "clear") return ReadonlyRequestCookiesError.callable;
		const value = Reflect.get(target, prop, target);
		return typeof value === "function" ? value.bind(target) : value;
	} });
}
var ResponseCookies = class {
	_headers;
	/** Internal map keyed by cookie name — single source of truth. */
	_parsed = /* @__PURE__ */ new Map();
	constructor(headers) {
		this._headers = headers;
		for (const header of headers.getSetCookie()) {
			const eq = header.indexOf("=");
			if (eq === -1) continue;
			const cookieName = header.slice(0, eq);
			const semi = header.indexOf(";", eq);
			const raw = header.slice(eq + 1, semi === -1 ? void 0 : semi);
			let value;
			try {
				value = decodeURIComponent(raw);
			} catch {
				value = raw;
			}
			this._parsed.set(cookieName, {
				serialized: header,
				entry: {
					name: cookieName,
					value
				}
			});
		}
	}
	set(...args) {
		const [name, value, opts] = parseCookieSetArgs(args);
		validateCookieName(name);
		const sameSite = opts?.sameSite === true ? "Strict" : typeof opts?.sameSite === "string" ? opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1) : void 0;
		const serialized = serializeSetCookie(name, value, {
			...opts,
			expires: typeof opts?.expires === "number" ? new Date(opts.expires) : opts?.expires,
			sameSite
		});
		this._parsed.set(name, {
			serialized,
			entry: {
				name,
				value
			}
		});
		this._syncHeaders();
		return this;
	}
	get(...args) {
		const key = typeof args[0] === "string" ? args[0] : args[0].name;
		return this._parsed.get(key)?.entry;
	}
	has(name) {
		return this._parsed.has(name);
	}
	getAll(...args) {
		const all = [...this._parsed.values()].map((v) => v.entry);
		if (args.length === 0) return all;
		const key = typeof args[0] === "string" ? args[0] : args[0].name;
		return all.filter((c) => c.name === key);
	}
	delete(...args) {
		const [name, opts] = typeof args[0] === "string" ? [args[0], void 0] : [args[0].name, args[0]];
		return this.set({
			name,
			value: "",
			expires: /* @__PURE__ */ new Date(0),
			path: opts?.path,
			domain: opts?.domain,
			httpOnly: opts?.httpOnly,
			secure: opts?.secure,
			sameSite: opts?.sameSite
		});
	}
	[Symbol.iterator]() {
		return new Map([...this._parsed.values()].map(({ entry }) => [entry.name, entry])).entries();
	}
	/** Delete all Set-Cookie headers and re-append from the internal map. */
	_syncHeaders() {
		this._headers.delete("Set-Cookie");
		for (const { serialized } of this._parsed.values()) this._headers.append("Set-Cookie", serialized);
	}
};
var MiddlewareResponseCookies = class extends ResponseCookies {
	_responseHeaders;
	constructor(headers) {
		super(headers);
		this._responseHeaders = headers;
	}
	set(...args) {
		super.set(...args);
		this._syncMiddlewareCookieHeader();
		return this;
	}
	delete(...args) {
		super.delete(...args);
		this._syncMiddlewareCookieHeader();
		return this;
	}
	_syncMiddlewareCookieHeader() {
		const cookies = this._responseHeaders.getSetCookie();
		if (cookies.length === 0) {
			this._responseHeaders.delete(MIDDLEWARE_SET_COOKIE_HEADER);
			return;
		}
		this._responseHeaders.set(MIDDLEWARE_SET_COOKIE_HEADER, cookies.join(","));
	}
};
/**
* Parse the overloaded arguments for ResponseCookies.set():
*   - (name, value, options?) — positional form
*   - ({ name, value, ...options }) — object form
*/
function parseCookieSetArgs(args) {
	if (typeof args[0] === "string") return [
		args[0],
		args[1],
		args[2]
	];
	const { name, value, ...opts } = args[0];
	return [
		name,
		value,
		opts
	];
}
/**
* Minimal NextFetchEvent — extends FetchEvent where available,
* otherwise provides the waitUntil pattern standalone.
*/
var NextFetchEvent = class {
	sourcePage;
	_waitUntilPromises = [];
	constructor(params) {
		this.sourcePage = params.page;
		if (params.context) this._externalWaitUntil = params.context.waitUntil.bind(params.context);
	}
	_externalWaitUntil;
	get request() {
		throw new Error(`The middleware signature for ${this.sourcePage} no longer exposes event.request`);
	}
	respondWith() {
		throw new Error(`The middleware signature for ${this.sourcePage} no longer uses respondWith()`);
	}
	passThroughOnException() {}
	waitUntil(promise) {
		if (this._externalWaitUntil) {
			this._externalWaitUntil(promise);
			return;
		}
		this._waitUntilPromises.push(promise);
	}
	get waitUntilPromises() {
		return this._waitUntilPromises;
	}
	/** Drain all waitUntil promises. Returns a single promise that settles when all are done. */
	drainWaitUntil() {
		return Promise.allSettled(this._waitUntilPromises);
	}
};
/**
* Parse user agent string. Minimal implementation — for full UA parsing,
* apps should use a dedicated library like `ua-parser-js`.
*/
function userAgentFromString(ua) {
	const input = ua ?? "";
	return {
		isBot: /bot|crawler|spider|crawling/i.test(input),
		ua: input,
		browser: {},
		device: {},
		engine: {},
		os: {},
		cpu: {}
	};
}
function userAgent({ headers }) {
	return userAgentFromString(headers.get("user-agent") ?? void 0);
}
/**
* after() — schedule work after the response is sent.
*
* Uses the platform's `waitUntil` (via the per-request ExecutionContext) when
* available so the task survives past the response on Cloudflare Workers.
* Falls back to a fire-and-forget microtask on runtimes without an execution
* context (e.g. Node.js dev server).
*
* Throws when called inside a cached scope — request-specific
* side-effects must not leak into cached results.
*/
function after(task) {
	_throwIfInsideCacheScope("after()");
	const guarded = (typeof task === "function" ? Promise.resolve().then(task) : task).catch((err) => {
		console.error("[vinext] after() task failed:", err);
	});
	getRequestExecutionContext()?.waitUntil(guarded);
}
/**
* connection() — signals that the response requires a live connection
* (not a static/cached response). Opts the page out of ISR caching
* and sets Cache-Control: no-store on the response.
*/
async function connection() {
	const { getHeadersContext, markDynamicUsage, markRenderRequestApiUsage, suspendConnectionProbe, throwIfInsideCacheScope } = await import("./headers.js");
	if (getHeadersContext()?.forceStatic) return;
	markRenderRequestApiUsage("connection");
	throwIfInsideCacheScope("connection()");
	markDynamicUsage();
	const pendingProbe = suspendConnectionProbe();
	if (pendingProbe) await pendingProbe;
}
/**
* URLPattern re-export — used in middleware for route matching.
* Available natively in Node 20+, Cloudflare Workers, Deno.
* Falls back to urlpattern-polyfill if the global is not available.
*/
const URLPattern = globalThis.URLPattern ?? (() => {
	throw new Error("URLPattern is not available in this runtime. Install the `urlpattern-polyfill` package or upgrade to Node 20+.");
});
//#endregion
export { ImageResponse, NextFetchEvent, NextRequest, NextResponse, NextURL, RequestCookies, ResponseCookies, URLPattern, after, connection, sealRequestCookies, sealRequestHeaders, userAgent, userAgentFromString };
