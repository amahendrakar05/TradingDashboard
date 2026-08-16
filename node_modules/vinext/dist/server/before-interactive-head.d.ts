import { BeforeInteractiveInlineScript } from "../shims/before-interactive-context.js";

//#region src/server/before-interactive-head.d.ts
/**
 * Render captured `<Script strategy="beforeInteractive">` scripts to HTML,
 * ready to splice immediately after `<head ...>` opens. Each entry has already
 * had its inline content escaped via `escapeInlineContent(..., "script")`
 * inside the Script shim, so this function only quotes the attributes that
 * actually go on the tag (id, src, nonce, plus the residual passthroughs).
 *
 * Keeping this function in its own module makes the boundary obvious: anything
 * passed through here is being concatenated directly into HTML; treat the
 * inputs accordingly.
 */
declare function renderBeforeInteractiveInlineScripts(scripts: readonly BeforeInteractiveInlineScript[]): string;
//#endregion
export { renderBeforeInteractiveInlineScripts };