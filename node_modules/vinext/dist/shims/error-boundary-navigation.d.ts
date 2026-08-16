import { AppRouterInstance } from "./internal/app-router-context.js";

//#region src/shims/error-boundary-navigation.d.ts
declare function useErrorBoundaryPathname(): string;
declare function useErrorBoundaryRouter(): AppRouterInstance;
//#endregion
export { useErrorBoundaryPathname, useErrorBoundaryRouter };