import { ThenableParams, ThenableParamsObserver } from "../shims/thenable-params.js";
import { AppPageSearchParams } from "./app-page-head.js";

//#region src/server/app-page-search-params-observation.d.ts
type AppPageSearchParamsObservationOptions = {
  markDynamic?: boolean;
  observeReactPromiseStatus?: boolean;
};
declare function createAppPageSearchParamsObserver(options?: AppPageSearchParamsObservationOptions): ThenableParamsObserver;
declare function makeObservedAppPageSearchParamsThenable(pageSearchParams: AppPageSearchParams, options?: AppPageSearchParamsObservationOptions): ThenableParams<AppPageSearchParams>;
//#endregion
export { createAppPageSearchParamsObserver, makeObservedAppPageSearchParamsThenable };