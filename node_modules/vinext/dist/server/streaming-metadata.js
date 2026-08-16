import { getHtmlLimitedBotRegex } from "../utils/html-limited-bots.js";
//#region src/server/streaming-metadata.ts
function shouldServeStreamingMetadata(userAgent, htmlLimitedBots) {
	if (!userAgent) return true;
	return !getHtmlLimitedBotRegex(htmlLimitedBots).test(userAgent);
}
//#endregion
export { shouldServeStreamingMetadata };
