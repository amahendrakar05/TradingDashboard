//#region src/server/streaming-metadata.d.ts
declare function shouldServeStreamingMetadata(userAgent: string, htmlLimitedBots: string | undefined): boolean;
//#endregion
export { shouldServeStreamingMetadata };