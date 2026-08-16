//#region src/shims/internal/link-status-registry.d.ts
/**
 * Link-status pending registry.
 *
 * Tracks the single <Link> that started the most recent App Router navigation
 * so its `useLinkStatus()` pending state can be reset when a *different*
 * navigation begins — a different <Link> click, `router.push`/`router.replace`,
 * a form submission, shallow routing via raw `history.pushState`, or browser
 * back/forward. Without this, a Link's pending indicator stays "sticky" after
 * an interrupting navigation, because the Link's own completion handler is the
 * only thing that would otherwise clear it.
 *
 * Mirrors Next.js's `linkForMostRecentNavigation` /
 * `setLinkForCurrentNavigation` in
 * packages/next/src/client/components/links.ts, adapted to vinext's per-<Link>
 * React state model: instead of an optimistic-status dispatcher, we hold the
 * link's `setPending` setter.
 */
type PendingLinkSetter = (pending: boolean) => void;
/**
 * Mark `setter` as the link that started the most recent navigation, resetting
 * the previously-tracked link's pending state to idle so only the last-clicked
 * link shows a pending state.
 */
declare function setLinkForCurrentNavigation(setter: PendingLinkSetter): void;
/**
 * Stop tracking `setter` if it is the current navigation link. Called when a
 * <Link> finishes its own navigation or unmounts so we never hold a stale
 * reference to an unmounted component's setter.
 */
declare function clearLinkForCurrentNavigation(setter: PendingLinkSetter): void;
/**
 * Reset any link that is currently showing a pending state. Invoked at the
 * start of every App Router navigation so that navigations not initiated by the
 * tracked link — `router.push`/`router.replace`, form submissions, shallow
 * routing, and browser back/forward — clear a stale pending indicator. A
 * link-initiated navigation registers itself first via
 * `setLinkForCurrentNavigation`; the matching call here consumes that marker and
 * keeps the link pending.
 */
declare function notifyLinkNavigationStart(): void;
//#endregion
export { PendingLinkSetter, clearLinkForCurrentNavigation, notifyLinkNavigationStart, setLinkForCurrentNavigation };