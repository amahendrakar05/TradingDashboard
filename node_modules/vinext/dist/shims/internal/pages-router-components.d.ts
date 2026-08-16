//#region src/shims/internal/pages-router-components.d.ts
type PagesRouterComponentsMap = Record<string, {
  __appRouter: true;
} | Record<string, unknown>>;
declare function getPagesRouterComponentsMap(): PagesRouterComponentsMap;
//#endregion
export { PagesRouterComponentsMap, getPagesRouterComponentsMap };