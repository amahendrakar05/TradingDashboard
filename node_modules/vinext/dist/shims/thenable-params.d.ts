//#region src/shims/thenable-params.d.ts
declare const WELL_KNOWN_PROPERTIES: readonly ["hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toString", "valueOf", "toLocaleString", "then", "catch", "finally", "status", "value", "error", "displayName", "_debugInfo", "toJSON", "$$typeof", "__esModule", "@@iterator"];
type WellKnownProperty = (typeof WELL_KNOWN_PROPERTIES)[number];
type ThenableParams<T extends Record<string, unknown>> = Promise<T> & Omit<T, WellKnownProperty>;
type ThenableParamsObserver = Readonly<{
  observeParamAccess: (keys: readonly string[]) => void;
  observeReactPromiseStatus?: boolean;
}>;
declare function makeThenableParams<T extends Record<string, unknown>>(obj: T, observer?: ThenableParamsObserver): ThenableParams<T>;
//#endregion
export { ThenableParams, ThenableParamsObserver, makeThenableParams };