import { RenderRequestApiKind } from "../server/cache-proof.js";
import { ReadonlyRequestCookies } from "@vinext/types/next/upstream/dist/server/web/spec-extension/adapters/request-cookies";
import { ResponseCookie } from "@vinext/types/next/upstream/dist/compiled/@edge-runtime/cookies/index";

//#region src/shims/headers.d.ts
type HeadersContext = {
  headers: Headers;
  cookies: Map<string, string>;
  accessError?: Error;
  draftModeEnabled?: boolean;
  forceStatic?: boolean;
  mutableCookies?: RequestCookies;
  readonlyCookies?: RequestCookies;
  readonlyHeaders?: Headers;
  draftModeSecret?: string;
};
type HeadersContextFromRequestOptions = {
  draftModeSecret?: string;
};
type HeadersAccessPhase = "render" | "action" | "route-handler";
type VinextHeadersShimState = {
  headersContext: HeadersContext | null;
  dynamicUsageDetected: boolean;
  renderRequestApiUsage: Set<RenderRequestApiKind>;
  connectionProbe: ConnectionProbeState | null; /** Error recorded by throwIfInsideCacheScope for dev diagnostics, persists even if caught by user code. */
  invalidDynamicUsageError: unknown;
  pendingSetCookies: string[];
  draftModeCookieHeader: string | null;
  phase: HeadersAccessPhase;
};
type ConnectionProbeState = {
  active: boolean;
  dynamicUsageTarget: VinextHeadersShimState;
  interrupted: boolean;
  interrupt: () => void;
  pending: Promise<never>;
};
type ConnectionProbeResult<T> = {
  completed: true;
  result: T;
} | {
  completed: false;
};
/**
 * Dynamic usage flag — set when a component calls connection(), cookies(),
 * headers(), or noStore() during rendering. When true, ISR caching is
 * bypassed and the response gets Cache-Control: no-store.
 */
/**
 * Mark the current render as requiring dynamic (uncached) rendering.
 * Called by connection(), cookies(), headers(), and noStore().
 */
declare function markDynamicUsage(): void;
/**
 * Measure dynamic usage in a child async scope without clearing the parent.
 * Concurrent work that already belongs to the request (such as deferred
 * metadata) keeps writing to the parent state and therefore remains visible
 * to the final cache policy.
 */
declare function runWithIsolatedDynamicUsage<T>(fn: () => T | Promise<T>): Promise<{
  result: T;
  dynamicDetected: boolean;
}>;
declare function markRenderRequestApiUsage(kind: RenderRequestApiKind): void;
declare function throwIfStaticGenerationAccessError(): void;
declare function runWithConnectionProbe<T>(fn: () => T | Promise<T>): Promise<ConnectionProbeResult<T>>;
declare function suspendConnectionProbe(): Promise<never> | null;
declare function peekRenderRequestApiUsage(): RenderRequestApiKind[];
declare function consumeRenderRequestApiUsage(): RenderRequestApiKind[];
/**
 * Throw if the current execution is inside a "use cache" or unstable_cache()
 * scope. Called by dynamic request APIs (headers, cookies, connection) to
 * prevent request-specific data from being frozen into cached results.
 *
 * @param apiName - The name of the API being called (e.g. "connection()")
 */
declare function throwIfInsideCacheScope(apiName: string): void;
/**
 * Check, consume, and return any invalid dynamic usage error recorded during
 * the render (e.g. cookies() called inside "use cache"). This error persists
 * even if the throw was caught by user-code try/catch, so it can surface on
 * client-side navigations where the static shell validation is skipped.
 * Ported from Next.js: workStore.invalidDynamicUsageError in
 * packages/next/src/server/app-render/app-render.tsx
 * https://github.com/vercel/next.js/commit/f5e54c06726b571a042fce67417e40a29f6b8689
 */
declare function consumeInvalidDynamicUsageError(): unknown;
/**
 * Check and reset the dynamic usage flag.
 * Called by the server after rendering to decide on caching.
 */
declare function consumeDynamicUsage(): boolean;
/**
 * Read the dynamic usage flag without resetting it.
 * Used by the layout probe to fold a probe-scoped `markDynamicUsage()` into the
 * per-layout observation before the isolated probe scope is discarded, so the
 * observation captures `markDynamicUsage()` paths (e.g. `"use cache: private"`)
 * that leave no other observable trace.
 */
declare function peekDynamicUsage(): boolean;
declare function setHeadersAccessPhase(phase: HeadersAccessPhase): HeadersAccessPhase;
declare function getHeadersAccessPhase(): HeadersAccessPhase;
/**
 * Set the headers/cookies context for the current RSC render.
 * Called by the framework's RSC entry before rendering each request.
 *
 * @deprecated Prefer runWithHeadersContext() which uses als.run() for
 * proper per-request isolation. This function mutates the ALS store
 * in-place and is only safe for cleanup (ctx=null) within an existing
 * als.run() scope.
 */
/**
 * Returns the current live HeadersContext from ALS (or the fallback).
 * Used after applyMiddlewareRequestHeaders() to build a post-middleware
 * request context for afterFiles/fallback rewrite has/missing evaluation.
 */
declare function getHeadersContext(): HeadersContext | null;
declare function setHeadersContext(ctx: HeadersContext | null): void;
/**
 * Run a function with headers context, ensuring the context propagates
 * through all async operations (including RSC streaming).
 *
 * Uses AsyncLocalStorage.run() to guarantee per-request isolation.
 * The ALS store propagates through all async continuations including
 * ReadableStream consumption, setTimeout callbacks, and Promise chains,
 * so RSC streaming works correctly — components that render when the
 * stream is consumed still see the correct request's context.
 */
declare function runWithHeadersContext<T>(ctx: HeadersContext, fn: () => Promise<T>): Promise<T>;
declare function runWithHeadersContext<T>(ctx: HeadersContext, fn: () => T | Promise<T>): T | Promise<T>;
/**
 * Apply middleware-forwarded request headers to the current headers context.
 *
 * When Next.js middleware calls `NextResponse.next()` or `NextResponse.rewrite()`
 * with `{ request: { headers } }`, the modified headers are encoded on the
 * middleware response. This function decodes that protocol and applies the
 * resulting request header set to the live `HeadersContext`. When an override
 * list is present, omitted headers are deleted as part of the rebuild.
 *
 * Cached `readonlyHeaders` and `readonlyCookies` snapshots on the
 * HeadersContext must be invalidated whenever this function rebuilds the
 * underlying `headers`/`cookies`. Otherwise a middleware that reads
 * `headers()` (or `cookies()`) before returning a request-header override —
 * for example `@clerk/nextjs`, whose `clerkClient()` reads `headers()` via
 * `buildRequestLike()` during middleware execution — primes a sealed snapshot
 * built from the *pre*-override request, and any subsequent `headers()` call
 * from a Server Component would return that stale snapshot instead of the
 * middleware-modified view.
 */
declare function applyMiddlewareRequestHeaders(middlewareResponseHeaders: Headers): void;
/**
 * Create a HeadersContext from a standard Request object.
 *
 * Performance note: In Workerd (Cloudflare Workers), `new Headers(request.headers)`
 * copies the entire header map across the V8/C++ boundary, which shows up as
 * ~815 ms self-time in production profiles when requests carry many headers.
 * We defer this copy with a lazy proxy:
 *
 * - Reads (`get`, `has`, `entries`, …) are forwarded directly to the original
 *   immutable `request.headers` — zero copy cost on the hot path.
 * - The first mutating call (`set`, `delete`, `append`) materialises
 *   `new Headers(request.headers)` once, then applies the mutation to the copy.
 *   All subsequent operations go to the copy.
 *
 * This means the ~815 ms copy only occurs when middleware actually rewrites
 * request headers via `NextResponse.next({ request: { headers } })`, which is
 * uncommon.  Pure read requests (the vast majority) pay zero copy cost.
 *
 * Cookie parsing is also deferred: the `cookie` header string is not split
 * until the first call to `cookies()` or `draftMode()`.
 */
declare function headersContextFromRequest(request: Request, options?: HeadersContextFromRequestOptions): HeadersContext;
/**
 * Read-only Headers instance from the incoming request.
 * Returns a Promise in Next.js 15+ style (but resolves synchronously since
 * the context is already available).
 */
declare function headers(): Promise<Headers> & Headers;
type VinextReadonlyRequestCookies = Omit<ReadonlyRequestCookies, keyof RequestCookies> & RequestCookies;
declare function cookies(): Promise<VinextReadonlyRequestCookies> & VinextReadonlyRequestCookies;
/** Accumulated Set-Cookie headers from cookies().set() / .delete() calls */
/**
 * Get and clear all pending Set-Cookie headers generated by cookies().set()/delete().
 * Called by the framework after rendering to attach headers to the response.
 */
declare function getAndClearPendingCookies(): string[];
/**
 * Get any Set-Cookie header generated by draftMode().enable()/disable().
 * Called by the framework after rendering to attach the header to the response.
 */
declare function getDraftModeCookieHeader(): string | null;
declare function isDraftModeRequest(request: Request, draftModeSecret: string): boolean;
/**
 * Read draft mode from the live request context without recording request API
 * usage. `null` means there is no active request context, which lets framework
 * callers fall back to an explicitly supplied request when needed.
 */
declare function getActiveDraftModeState(): boolean | null;
/**
 * Read the active request's draft-mode state without recording request API usage.
 * Internal cache implementations use this to bypass persistent reads and writes,
 * matching Next.js's request-level `workStore.isDraftMode` guard.
 */
declare function isDraftModeEnabled(): boolean;
type DraftModeResult = {
  readonly isEnabled: boolean;
  enable(): void;
  disable(): void;
};
/**
 * Draft mode — check/toggle via a `__prerender_bypass` cookie.
 *
 * - `isEnabled`: true if the bypass cookie is present in the request
 * - `enable()`: sets the bypass cookie (for Route Handlers)
 * - `disable()`: clears the bypass cookie
 *
 * Unlike `headers()` / `cookies()`, calling `draftMode()` itself is allowed
 * inside `"use cache"` and `unstable_cache()` scopes — reads of `isEnabled`
 * are non-dynamic and supported in cached functions. Only the mutating
 * `enable()` / `disable()` methods throw when invoked inside a cache scope.
 * Ported from Next.js: packages/next/src/server/request/draft-mode.ts
 * (`getDraftModeProviderForCacheScope` + `trackDynamicDraftMode`).
 */
declare function draftMode(): Promise<DraftModeResult>;
declare class RequestCookies {
  private _cookies;
  constructor(cookies: Map<string, string>);
  get(name: string): {
    name: string;
    value: string;
  } | undefined;
  getAll(nameOrOptions?: string | {
    name: string;
  }): Array<{
    name: string;
    value: string;
  }>;
  has(name: string): boolean;
  /**
   * Set a cookie. In Route Handlers and Server Actions, this produces
   * a Set-Cookie header on the response.
   */
  set(options: ResponseCookie): this;
  set(key: string, value: string, cookie?: Partial<ResponseCookie>): this;
  /**
   * Delete a cookie by emitting an expired Set-Cookie header.
   */
  delete(name: string): this;
  delete(options: Omit<ResponseCookie, "value" | "expires">): this;
  get size(): number;
  [Symbol.iterator](): MapIterator<[string, {
    name: string;
    value: string;
  }]>;
  toString(): string;
}
//#endregion
export { HeadersAccessPhase, HeadersContext, type RequestCookies, VinextHeadersShimState, applyMiddlewareRequestHeaders, consumeDynamicUsage, consumeInvalidDynamicUsageError, consumeRenderRequestApiUsage, cookies, draftMode, getActiveDraftModeState, getAndClearPendingCookies, getDraftModeCookieHeader, getHeadersAccessPhase, getHeadersContext, headers, headersContextFromRequest, isDraftModeEnabled, isDraftModeRequest, markDynamicUsage, markRenderRequestApiUsage, peekDynamicUsage, peekRenderRequestApiUsage, runWithConnectionProbe, runWithHeadersContext, runWithIsolatedDynamicUsage, setHeadersAccessPhase, setHeadersContext, suspendConnectionProbe, throwIfInsideCacheScope, throwIfStaticGenerationAccessError };