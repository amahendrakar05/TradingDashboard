import { ReactNode } from "react";

//#region src/server/app-render-dependency.d.ts
type AppRenderDependency = {
  promise: Promise<void>;
  release: () => void;
};
declare function registerAppElementRenderDependencies(elements: Readonly<Record<string, unknown>>, dependenciesByElementId: ReadonlyMap<string, AppRenderDependency>): void;
declare function releaseAppElementRenderDependency(elements: Readonly<Record<string, unknown>>, elementId: string): void;
declare function createAppRenderDependency(): AppRenderDependency;
declare function renderAfterAppDependencies(children: ReactNode, dependencies: readonly AppRenderDependency[]): ReactNode;
declare function renderWithAppDependencyBarrier(children: ReactNode, dependency: AppRenderDependency): ReactNode;
//#endregion
export { AppRenderDependency, createAppRenderDependency, registerAppElementRenderDependencies, releaseAppElementRenderDependency, renderAfterAppDependencies, renderWithAppDependencyBarrier };