import React from "react";

//#region src/shims/head.d.ts
type HeadProps = {
  children?: React.ReactNode;
};
/** @internal — exposed for unit tests of the client head projection. */
declare const _clientHeadChildren: Map<symbol, React.ReactNode>;
/**
 * Register ALS-backed state accessors. Called by head-state.ts on import.
 * @internal
 */
declare function _registerHeadStateAccessors(accessors: {
  getSSRHeadChildren: () => React.ReactNode[];
  resetSSRHead: () => void;
  getDocumentInitialHead?: () => React.ReactNode[];
  setDocumentInitialHead?: (head: React.ReactNode[]) => void;
}): void;
/** Reset the SSR head collector. Call before render. */
declare function resetSSRHead(): void;
/**
 * Register head tags returned by a user `_document.getInitialProps()` call.
 * Mirrors Next.js: `_document` may extend the head array passed to its render,
 * and those tags are merged into the final `<head>` output. We treat them the
 * same as `next/head` children — they go through the same dedupe pipeline so
 * later tags (by key or meta-type) win, matching Next.js semantics.
 *
 * Pass an empty array (or simply don't call this) to skip the merge.
 */
declare function setDocumentInitialHead(head: React.ReactNode[]): void;
/**
 * Default head tags emitted alongside every Pages Router render — charset
 * first, then viewport. Mirrors Next.js's `defaultHead()` in
 * `packages/next/src/shared/lib/head.tsx`, which seeds the head array used
 * by `HeadManagerContext` before any user `<Head>` reduces over it.
 *
 * The canonical Next.js order is `<meta charset>` then `<meta viewport>`
 * then user tags, all with `data-next-head=""`. See assertion in
 * `test/e2e/next-head/index.test.ts`.
 */
declare function defaultHead(): React.ReactElement[];
/** Get collected head HTML. Call after render. */
declare function getSSRHeadHTML(): string;
type HeadDOMElement = Pick<HTMLElement, "innerHTML" | "setAttribute" | "textContent">;
declare function reduceHeadChildren(headChildren: React.ReactNode[]): React.ReactElement[];
declare function isSafeAttrName(name: string): boolean;
declare function escapeAttr(s: string): string;
/**
 * Escape content that will be placed inside a raw <script> or <style> tag
 * during SSR. The HTML parser treats `</script>` (or `</style>`) as the end
 * of the block regardless of JavaScript string context, so any occurrence
 * of `</` followed by the tag name must be escaped.
 *
 * We replace `</script` and `</style` (case-insensitive) with `<\/script`
 * and `<\/style` respectively. The `<\/` form is harmless in JS/CSS string
 * context but prevents the HTML parser from seeing a closing tag.
 */
declare function escapeInlineContent(content: string, tag: string): string;
declare function _applyHeadPropsToElement(domEl: HeadDOMElement, props: Record<string, unknown>): void;
/**
 * Reconcile the document <head> against the desired projection.
 *
 * Mirrors Next.js's client `head-manager.ts` `updateElements()`: rather than
 * wiping every [data-next-head] node and re-appending (which reorders the
 * SSR-emitted tags to the end of <head> and causes flicker on each update),
 * we diff the desired tags against the existing ones with isEqualNode(). Tags
 * that already match are left untouched in their original DOM position, only
 * genuinely new tags are inserted, and stale tags are removed.
 *
 * The desired list seeds defaultHead() (charset + viewport) ahead of user
 * tags — matching the SSR path in getSSRHeadHTML() and Next.js's
 * reduceComponents(), which always concatenates defaultHead() on both server
 * and client. Without it the first <Head> mount after hydration would drop the
 * server-rendered defaults. Users can still override via key="charset" /
 * key="viewport" through the dedupe pipeline.
 *
 * @internal — exported for unit tests; called from the Head client effect.
 */
declare function _syncClientHead(): void;
declare function Head({
  children
}: HeadProps): React.ReactElement;
//#endregion
export { _applyHeadPropsToElement, _clientHeadChildren, _registerHeadStateAccessors, _syncClientHead, Head as default, defaultHead, escapeAttr, escapeInlineContent, getSSRHeadHTML, isSafeAttrName, reduceHeadChildren, resetSSRHead, setDocumentInitialHead };