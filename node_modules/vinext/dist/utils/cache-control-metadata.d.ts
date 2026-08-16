//#region src/utils/cache-control-metadata.d.ts
declare function readCacheControlNumberField(ctx: Record<string, unknown> | undefined, field: string): number | undefined;
//#endregion
export { readCacheControlNumberField };