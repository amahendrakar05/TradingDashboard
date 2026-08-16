//#region src/shims/internal/app-page-props-cache-key.d.ts
declare function markAppPagePropsForUseCache<T extends object>(props: T): T;
declare function isMarkedAppPagePropsObject(value: object): boolean;
//#endregion
export { isMarkedAppPagePropsObject, markAppPagePropsForUseCache };