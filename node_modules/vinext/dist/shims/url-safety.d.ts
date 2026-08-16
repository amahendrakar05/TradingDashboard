//#region src/shims/url-safety.d.ts
/**
 * Shared URL safety utilities for Link, Form, and navigation shims.
 *
 * Centralizes dangerous URI scheme detection so all components and
 * navigation functions use the same validation logic.
 */
declare const DANGEROUS_URL_BLOCK_MESSAGE = "Next.js has blocked a javascript: URL as a security precaution.";
declare function isDangerousScheme(url: string): boolean;
/**
 * Emit a `console.error` matching Next.js's blocked-navigation message.
 *
 * Next.js's `router.push` / `router.replace` / `router.prefetch` (and the
 * Pages Router equivalents) throw an `Error` when the URL has a dangerous
 * scheme. In the browser, React's event-handler runtime catches that throw
 * and reports it through `console.error`, which is what the Next.js E2E
 * `test/e2e/app-dir/javascript-urls` suite asserts on.
 *
 * Vinext's navigation guards run synchronously inside async event handlers
 * (e.g. Link's `void handleClick(event)`), so a raw throw is dropped on the
 * floor instead of bubbling up to React. Emitting the same `console.error`
 * explicitly keeps observable behaviour aligned with Next.js — the test
 * matcher uses `.includes("has blocked a javascript: URL as a security
 * precaution.")` so any message containing that phrase satisfies it.
 *
 * Source reference (Next.js):
 *   packages/next/src/client/components/segment-cache/navigation.ts:537
 *   packages/next/src/client/components/app-router-instance.ts:345,402,442,460
 *   packages/next/src/shared/lib/router/router.ts:1025,1057
 */
declare function reportBlockedDangerousNavigation(): void;
declare function assertSafeNavigationUrl(url: string, ErrorConstructor?: new (message: string) => Error): void;
//#endregion
export { DANGEROUS_URL_BLOCK_MESSAGE, assertSafeNavigationUrl, isDangerousScheme, reportBlockedDangerousNavigation };