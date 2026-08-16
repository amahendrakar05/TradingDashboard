import React, { ComponentType } from "react";
import { DynamicOptions, DynamicOptionsLoadingProps, LoadableComponent, LoadableFn, LoadableGeneratedOptions, LoadableOptions, Loader, LoaderComponent, LoaderMap } from "@vinext/types/next/upstream/dynamic";

//#region src/shims/dynamic.d.ts
type DynamicInput<P> = DynamicOptions<P> | Loader<P>;
/**
 * Wait for all pending dynamic() preloads to resolve, then clear the queue.
 * Called by the Pages Router SSR handler before rendering.
 * No-op for the App Router path which uses React.lazy + Suspense.
 */
declare function flushPreloads(): Promise<void[]>;
declare function dynamic<P = {}>(dynamicInput: DynamicInput<P>, options?: DynamicOptions<P>): ComponentType<P>;
declare function noSSR<P = {}>(LoadableInitializer: LoadableFn<P>, loadableOptions: DynamicOptions<P>): React.ComponentType<P>;
//#endregion
export { type DynamicOptions, type DynamicOptionsLoadingProps, type LoadableComponent, type LoadableFn, type LoadableGeneratedOptions, type LoadableOptions, type Loader, type LoaderComponent, type LoaderMap, dynamic as default, flushPreloads, noSSR };