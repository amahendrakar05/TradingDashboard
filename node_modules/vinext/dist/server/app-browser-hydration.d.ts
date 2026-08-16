import { ReactFormState, hydrateRoot } from "react-dom/client";

//#region src/server/app-browser-hydration.d.ts
type HydrateRootOptions = NonNullable<Parameters<typeof hydrateRoot>[2]>;
type HydrateRoot = typeof hydrateRoot;
type HydrateRootContainer = Parameters<HydrateRoot>[0];
type HydrateRootChildren = Parameters<HydrateRoot>[1];
type HydrateRootReturn = ReturnType<HydrateRoot>;
type HydrateRootCaughtErrorHandler = NonNullable<HydrateRootOptions["onCaughtError"]>;
type HydrateRootUncaughtErrorHandler = NonNullable<HydrateRootOptions["onUncaughtError"]>;
type HydrateRootRecoverableErrorHandler = NonNullable<HydrateRootOptions["onRecoverableError"]>;
type StartTransition = (action: () => void) => void;
declare const RSC_FORM_STATE_GLOBAL = "__VINEXT_RSC_FORM_STATE__";
type FormStateGlobal = {
  [RSC_FORM_STATE_GLOBAL]?: ReactFormState;
};
declare function consumeInitialFormState(global: FormStateGlobal): ReactFormState | null;
declare function createVinextHydrateRootOptions(options: {
  formState: ReactFormState | null;
  onCaughtError?: HydrateRootCaughtErrorHandler;
  onRecoverableError?: HydrateRootRecoverableErrorHandler;
  onUncaughtError: HydrateRootUncaughtErrorHandler;
}): HydrateRootOptions;
declare function hydrateRootInTransition(options: {
  children: HydrateRootChildren;
  container: HydrateRootContainer;
  hydrateRoot: HydrateRoot;
  options: HydrateRootOptions;
  startTransition: StartTransition;
}): HydrateRootReturn;
//#endregion
export { RSC_FORM_STATE_GLOBAL, consumeInitialFormState, createVinextHydrateRootOptions, hydrateRootInTransition };