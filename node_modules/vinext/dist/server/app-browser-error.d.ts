//#region src/server/app-browser-error.d.ts
type VinextHydrateRootErrorInfo = {
  componentStack?: string;
  errorBoundary?: unknown;
};
type HydrateRootErrorHandler = (error: unknown, errorInfo: VinextHydrateRootErrorInfo) => void;
declare function createOnUncaughtError(): HydrateRootErrorHandler;
declare function createProdOnCaughtError(onImplicitRootError: HydrateRootErrorHandler): HydrateRootErrorHandler;
declare function createDevOnCaughtError(onCaughtError: HydrateRootErrorHandler, onImplicitRootError: HydrateRootErrorHandler): HydrateRootErrorHandler;
declare function prodOnCaughtError(error: unknown, errorInfo: VinextHydrateRootErrorInfo): void;
declare function prodOnRecoverableError(error: unknown): void;
//#endregion
export { createDevOnCaughtError, createOnUncaughtError, createProdOnCaughtError, prodOnCaughtError, prodOnRecoverableError };