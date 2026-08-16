import { getRequestExecutionContext } from "../shims/request-context.js";
import { reportRequestError } from "./instrumentation.js";
import { getCdnCacheAdapter } from "../shims/cdn-cache.js";
import { fnv1a64 } from "../utils/hash.js";
import { normalizeMountedSlotsHeader } from "./app-mounted-slots-header.js";
import { APP_RSC_RENDER_MODE_NAVIGATION, getRscRenderModeCacheVariant } from "./app-rsc-render-mode.js";
import { normalizeAppPageInterceptionProofPathname } from "./app-page-render-identity.js";
//#region src/server/isr-cache.ts
/**
* Header set on the internal request that `res.revalidate()` issues to
* trigger on-demand ISR regeneration of a Pages Router route. Mirrors Next.js's
* `PRERENDER_REVALIDATE_HEADER` (`x-prerender-revalidate`) — see
* `.nextjs-ref/packages/next/src/lib/constants.ts`.
*
* SECURITY: in Next.js this header is NOT a presence flag — it carries the
* secret `previewModeId`, and `checkIsOnDemandRevalidate`
* (`.nextjs-ref/packages/next/src/server/api-utils/index.ts`) only treats a
* request as on-demand revalidation when the value *equals* that secret. If we
* gated on presence alone, any external client could send
* `x-prerender-revalidate: <anything>` to force synchronous regeneration of any
* ISR page, bypassing the fresh/stale cache short-circuits — a
* cache-stampede/DoS vector. We therefore validate the value against
* {@link getRevalidateSecret} (a build-time secret shared across all Workers
* isolates) with a constant-time comparison, and only the matching value (sent
* by our own `res.revalidate()`) is honored.
*/
const PRERENDER_REVALIDATE_HEADER = "x-prerender-revalidate";
/**
* Companion header to {@link PRERENDER_REVALIDATE_HEADER}. When set,
* `res.revalidate(path, { unstable_onlyGenerated: true })` only revalidates the
* path if it was already generated, and a 404 response counts as a successful
* no-op. Mirrors Next.js's `PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER`
* (`x-prerender-revalidate-if-generated`) — see
* `.nextjs-ref/packages/next/src/lib/constants.ts`.
*/
const PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER = "x-prerender-revalidate-if-generated";
/**
* Build-time secret that authenticates on-demand revalidation requests, the
* vinext analog of Next.js's prerender-manifest `previewModeId`.
*
* `res.revalidate()` loops back into the server via an internal `fetch()`. On
* Cloudflare Workers that loopback can land on a *different* isolate than the
* sender, so a per-process random secret would mismatch across isolates and
* false-reject legitimate revalidations (and, symmetrically, two isolates with
* independently-rolled secrets could never agree). The fix mirrors Next.js's
* `previewModeId`: the secret is generated once at BUILD time and baked
* (server-only — never into the client bundle) into every server bundle via the
* `__VINEXT_REVALIDATE_SECRET` Vite `define`, so it is byte-for-byte identical in
* every isolate. See `vinext build` CLI (`__VINEXT_SHARED_REVALIDATE_SECRET`) and
* the `vinext:compiler-define-server` plugin. The sender attaches it as the
* {@link PRERENDER_REVALIDATE_HEADER} value; the receiver authorizes a request
* only when the incoming value equals this secret (see
* {@link isOnDemandRevalidateRequest}).
*
* When the build-time define is absent — dev mode, and any path that doesn't
* run through `vinext build` — we fall back to a lazily-generated random secret.
* Those paths are single-process, so a module-scoped value is shared by sender
* and receiver there — no regression.
*/
let devRevalidateSecret;
function getRevalidateSecret() {
	const baked = process.env.__VINEXT_REVALIDATE_SECRET;
	if (baked) return baked;
	if (devRevalidateSecret === void 0) {
		const bytes = /* @__PURE__ */ new Uint8Array(32);
		crypto.getRandomValues(bytes);
		devRevalidateSecret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	}
	return devRevalidateSecret;
}
/**
* Constant-time string equality. Avoids leaking secret length / prefix via
* early-exit timing on the on-demand revalidation auth check. Returns false
* for length mismatch (the only safe option without revealing the secret
* length, and equality is impossible anyway).
*/
function safeEqual(a, b) {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return mismatch === 0;
}
function isRevalidateSecret(value) {
	if (typeof value !== "string" || value.length === 0) return false;
	return safeEqual(value, getRevalidateSecret());
}
/**
* Authorize an incoming request as an on-demand revalidation trigger. Mirrors
* Next.js's `checkIsOnDemandRevalidate`: the {@link PRERENDER_REVALIDATE_HEADER}
* value must *equal* the process revalidate secret. Header presence alone is
* NOT sufficient — see the security note on {@link PRERENDER_REVALIDATE_HEADER}.
*/
function isOnDemandRevalidateRequest(headerValue) {
	if (typeof headerValue !== "string") return false;
	return isRevalidateSecret(headerValue);
}
/**
* Get a cache entry with staleness information.
*
* Returns { value, isStale: false } for fresh entries,
* { value, isStale: true } for expired-but-usable entries,
* or null for cache misses.
*/
async function isrGet(key) {
	const result = await getCdnCacheAdapter().get(key);
	if (!result || !result.value) return null;
	if (result.cacheState === "expired") return null;
	return {
		value: result,
		isStale: result.cacheState === "stale"
	};
}
/**
* Store a value in the ISR cache with a revalidation period.
*/
async function isrSet(key, data, revalidateSeconds, tags, expireSeconds) {
	await getCdnCacheAdapter().set(key, data, {
		cacheControl: expireSeconds === void 0 ? { revalidate: revalidateSeconds } : {
			revalidate: revalidateSeconds,
			expire: expireSeconds
		},
		revalidate: revalidateSeconds,
		tags: tags ?? []
	});
}
async function isrSetPrerenderedAppPage(key, data, metadata) {
	const revalidateSeconds = metadata.revalidateSeconds;
	const tags = metadata.tags;
	if (process.env.NEXT_PRIVATE_DEBUG_CACHE) console.debug("[vinext] ISR: seed", key);
	const ctx = {};
	if (revalidateSeconds !== void 0) {
		ctx.revalidate = revalidateSeconds;
		ctx.cacheControl = metadata.expireSeconds === void 0 ? { revalidate: revalidateSeconds } : {
			revalidate: revalidateSeconds,
			expire: metadata.expireSeconds
		};
	}
	if (tags && tags.length > 0) ctx.tags = tags;
	await getCdnCacheAdapter().set(key, data, ctx);
	if (revalidateSeconds !== void 0) setRevalidateDuration(key, revalidateSeconds);
}
const _PENDING_REGEN_KEY = Symbol.for("vinext.isrCache.pendingRegenerations");
const _g = globalThis;
const pendingRegenerations = _g[_PENDING_REGEN_KEY] ??= /* @__PURE__ */ new Map();
/**
* Trigger a background regeneration for a cache key.
*
* If a regeneration for this key is already in progress, this is a no-op.
* The renderFn should produce the new cache value and call isrSet internally.
*
* On Cloudflare Workers the regeneration promise is registered with
* `ctx.waitUntil()` via the ALS-backed ExecutionContext, keeping the isolate
* alive until the regeneration completes even after the Response is returned.
*
* When `errorContext` is provided and the render function fails, the error
* is reported via `reportRequestError` (instrumentation hook) with
* `revalidateReason: "stale"`.
*/
function triggerBackgroundRegeneration(key, renderFn, errorContext) {
	if (!getCdnCacheAdapter().ownsBackgroundRevalidation) return;
	if (pendingRegenerations.has(key)) return;
	const promise = renderFn().catch((err) => {
		console.error(`[vinext] ISR background regeneration failed for ${key}:`, err);
		if (errorContext) reportRequestError(err instanceof Error ? err : new Error(String(err)), {
			path: key,
			method: "GET",
			headers: {}
		}, {
			routerKind: errorContext.routerKind,
			routePath: errorContext.routePath,
			routeType: errorContext.routeType,
			revalidateReason: "stale"
		});
	}).finally(() => {
		pendingRegenerations.delete(key);
	});
	pendingRegenerations.set(key, promise);
	getRequestExecutionContext()?.waitUntil(promise);
}
/**
* Build a CachedPagesValue for the Pages Router ISR cache.
*/
function buildPagesCacheValue(html, pageData, status) {
	return {
		kind: "PAGES",
		html,
		pageData,
		headers: void 0,
		status
	};
}
/**
* Build a CachedAppPageValue for the App Router ISR cache.
*/
function buildAppPageCacheValue(html, rscData, status, renderObservation, headers) {
	const value = {
		kind: "APP_PAGE",
		html,
		rscData,
		headers,
		postponed: void 0,
		status
	};
	if (renderObservation) value.renderObservation = renderObservation;
	return value;
}
function normalizeCachePathname(pathname) {
	return pathname === "/" ? "/" : pathname.replace(/\/$/, "");
}
function buildCacheKey(prefix, pathname, suffix) {
	const normalized = normalizeCachePathname(pathname);
	const suffixPart = suffix ? `:${suffix}` : "";
	const key = `${prefix}:${normalized}${suffixPart}`;
	if (key.length <= 200) return key;
	return `${prefix}:__hash:${fnv1a64(normalized)}${suffixPart}`;
}
/**
* Compute an ISR cache key for a given router type and pathname.
* Long pathnames are hashed to stay within KV key-length limits (512 bytes).
*/
function isrCacheKey(router, pathname, buildId) {
	return buildCacheKey(buildId ? `${router}:${buildId}` : router, pathname);
}
/**
* Compute an App Router ISR key for one cache artifact.
*
* App pages store HTML, RSC payloads, and route-handler responses separately.
* The suffix mirrors Next.js's separate on-disk app artifacts while keeping the
* Cloudflare KV key under its 512-byte limit for long pathnames.
*/
function appIsrCacheKey(pathname, suffix, buildId = process.env.__VINEXT_BUILD_ID) {
	return buildCacheKey(buildId ? `app:${buildId}` : "app", pathname, suffix);
}
function appIsrHtmlKey(pathname) {
	return appIsrCacheKey(pathname, "html");
}
function normalizeInterceptionContextForCacheKey(interceptionContext) {
	return normalizeAppPageInterceptionProofPathname(interceptionContext);
}
/**
* Build the ISR cache key for an RSC payload.
*
* Variants are sequenced in order: `source:<hash>` (intercepted source context,
* only when an interception context is present), `slots:<hash>` (mounted parallel
* route slots), and optionally `<render-mode-variant>` (for example,
* `prefetch-loading-shell`). Existing cached entries under the old format will
* become unreachable after deployment. This is acceptable because ISR entries
* have TTLs and will be regenerated on the next request.
*/
function appIsrRscKey(pathname, mountedSlotsHeader, renderMode = APP_RSC_RENDER_MODE_NAVIGATION, interceptionContext) {
	const normalizedMountedSlotsHeader = normalizeMountedSlotsHeader(mountedSlotsHeader);
	const sourceVariant = interceptionContext === void 0 || interceptionContext === null ? null : normalizeInterceptionContextForCacheKey(interceptionContext);
	const variant = [
		sourceVariant ? `source:${fnv1a64(sourceVariant)}` : null,
		normalizedMountedSlotsHeader ? `slots:${fnv1a64(normalizedMountedSlotsHeader)}` : null,
		getRscRenderModeCacheVariant(renderMode)
	].filter((part) => part !== null).join(":");
	return appIsrCacheKey(pathname, variant ? `rsc:${variant}` : "rsc");
}
function appIsrRouteKey(pathname) {
	return appIsrCacheKey(pathname, "route");
}
const MAX_REVALIDATE_ENTRIES = 1e4;
const _REVALIDATE_KEY = Symbol.for("vinext.isrCache.revalidateDurations");
const revalidateDurations = _g[_REVALIDATE_KEY] ??= /* @__PURE__ */ new Map();
/**
* Store the revalidate duration for a cache key.
* Uses insertion-order LRU eviction to prevent unbounded growth.
*/
function setRevalidateDuration(key, seconds) {
	revalidateDurations.delete(key);
	revalidateDurations.set(key, seconds);
	while (revalidateDurations.size > MAX_REVALIDATE_ENTRIES) {
		const first = revalidateDurations.keys().next().value;
		if (first !== void 0) revalidateDurations.delete(first);
		else break;
	}
}
/**
* Get the revalidate duration for a cache key.
*/
function getRevalidateDuration(key) {
	return revalidateDurations.get(key);
}
//#endregion
export { PRERENDER_REVALIDATE_HEADER, PRERENDER_REVALIDATE_ONLY_GENERATED_HEADER, appIsrCacheKey, appIsrHtmlKey, appIsrRouteKey, appIsrRscKey, buildAppPageCacheValue, buildPagesCacheValue, getRevalidateDuration, getRevalidateSecret, isOnDemandRevalidateRequest, isRevalidateSecret, isrCacheKey, isrGet, isrSet, isrSetPrerenderedAppPage, normalizeMountedSlotsHeader, setRevalidateDuration, triggerBackgroundRegeneration };
