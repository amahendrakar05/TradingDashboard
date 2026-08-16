//#region src/utils/html-limited-bots.d.ts
declare function getHtmlLimitedBotRegex(htmlLimitedBots: string | undefined): RegExp;
/**
 * Returns true when the User-Agent matches a known crawler/bot. Combines
 * Next.js's "headless browser bot" check (Googlebot proper) with the
 * "HTML-limited bot" list (Bingbot, DuckDuckBot, facebookexternalhit, …).
 *
 * Used by the Pages Router fallback path: a bot hitting an unlisted
 * `fallback: true` route should get a synchronous render (real content) and
 * not the loading shell, so the crawler indexes the actual page. Mirrors
 * Next.js's `isBot()` in `.nextjs-ref/packages/next/src/shared/lib/router/utils/is-bot.ts`
 * and the bot-aware fallback flip in
 * `.nextjs-ref/packages/next/src/server/route-modules/pages/pages-handler.ts`.
 *
 * `htmlLimitedBots` allows next.config to override the HTML-limited list
 * (same flag that drives `getHtmlLimitedBotRegex`), so a custom list applies
 * to both streaming metadata gating and bot-aware fallback rendering.
 */
declare function isBotUserAgent(userAgent: string, htmlLimitedBots?: string): boolean;
//#endregion
export { getHtmlLimitedBotRegex, isBotUserAgent };