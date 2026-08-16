//#region src/plugins/middleware-export-validation.d.ts
declare function hasValidMiddlewareModuleExport(source: string, id: string, isProxy: boolean): boolean;
declare function validateMiddlewareModuleExports(source: string, id: string, filePath: string, isProxy: boolean): void;
//#endregion
export { hasValidMiddlewareModuleExport, validateMiddlewareModuleExports };