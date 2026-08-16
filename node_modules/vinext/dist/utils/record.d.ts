//#region src/utils/record.d.ts
declare function isUnknownRecord(value: unknown): value is Record<string, unknown>;
//#endregion
export { isUnknownRecord };