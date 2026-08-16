//#region src/build/module-dependency-cache.d.ts
declare function createModuleDependencyCache<T>(collect: (moduleId: string) => Promise<T>): (moduleId: string) => Promise<T>;
//#endregion
export { createModuleDependencyCache };