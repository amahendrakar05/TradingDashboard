import React, { ComponentType } from "react";

//#region src/shims/app.d.ts
type AppProps<P = any> = {
  Component: ComponentType<P> & {
    getInitialProps?: (ctx: any) => any;
  };
  pageProps: P;
  router?: any;
  __N_SSG?: boolean;
  __N_SSP?: boolean;
};
/**
 * The context passed to `App.getInitialProps`. Mirrors Next.js's
 * `AppContextType` from `packages/next/src/shared/lib/utils.ts`.
 */
type AppContext = {
  Component: ComponentType<any> & {
    getInitialProps?: (ctx: any) => any;
  };
  AppTree: ComponentType<any>;
  ctx: any;
  router: any;
};
/**
 * The initial props shape returned by `App.getInitialProps`. Mirrors
 * Next.js's `AppInitialProps` from `packages/next/src/shared/lib/utils.ts`.
 */
type AppInitialProps<PageProps = any> = {
  pageProps: PageProps;
};
declare function appGetInitialProps({
  Component,
  ctx
}: AppContext): Promise<AppInitialProps>;
declare class App<P = any, CP = any, S = any> extends React.Component<P & AppProps<CP>, S> {
  static origGetInitialProps: typeof appGetInitialProps;
  static getInitialProps: typeof appGetInitialProps;
  render(): React.ReactElement;
}
//#endregion
export { AppContext, AppInitialProps, AppProps, App as default };