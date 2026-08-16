//#region src/utils/html-limited-bots.ts
const HTML_LIMITED_BOT_UA_RE_STRING = String.raw`[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight`;
const HEADLESS_BROWSER_BOT_UA_RE = /Googlebot(?!-)|Googlebot$/i;
const htmlLimitedBotRegexCache = /* @__PURE__ */ new Map();
function getHtmlLimitedBotRegex(htmlLimitedBots) {
	const source = htmlLimitedBots || HTML_LIMITED_BOT_UA_RE_STRING;
	const cached = htmlLimitedBotRegexCache.get(source);
	if (cached) return cached;
	const regex = new RegExp(source, "i");
	htmlLimitedBotRegexCache.set(source, regex);
	return regex;
}
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
function isBotUserAgent(userAgent, htmlLimitedBots) {
	if (!userAgent) return false;
	if (HEADLESS_BROWSER_BOT_UA_RE.test(userAgent)) return true;
	return getHtmlLimitedBotRegex(htmlLimitedBots).test(userAgent);
}
//#endregion
export { getHtmlLimitedBotRegex, isBotUserAgent };
