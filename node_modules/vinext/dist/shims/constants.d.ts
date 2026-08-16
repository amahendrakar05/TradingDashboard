//#region src/shims/constants.d.ts
/**
 * next/constants shim
 *
 * Provides build/runtime phase constants used by next.config.js
 * and some third-party libraries.
 */
declare const MODERN_BROWSERSLIST_TARGET: string[];
type ValueOf<T> = Required<T>[keyof T];
declare const COMPILER_NAMES: {
  readonly client: "client";
  readonly server: "server";
  readonly edgeServer: "edge-server";
};
type CompilerNameValues = ValueOf<typeof COMPILER_NAMES>;
declare const COMPILER_INDEXES: { [compilerKey in CompilerNameValues]: number };
declare const UNDERSCORE_NOT_FOUND_ROUTE = "/_not-found";
declare const UNDERSCORE_NOT_FOUND_ROUTE_ENTRY = "/_not-found/page";
declare const UNDERSCORE_GLOBAL_ERROR_ROUTE = "/_global-error";
declare const UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY = "/_global-error/page";
declare enum AdapterOutputType {
  /**
   * `PAGES` represents all the React pages that are under `pages/`.
   */
  PAGES = "PAGES",
  /**
   * `PAGES_API` represents all the API routes under `pages/api/`.
   */
  PAGES_API = "PAGES_API",
  /**
   * `APP_PAGE` represents all the React pages that are under `app/` with the
   * filename of `page.{j,t}s{,x}`.
   */
  APP_PAGE = "APP_PAGE",
  /**
   * `APP_ROUTE` represents all the API routes and metadata routes that are under `app/` with the
   * filename of `route.{j,t}s{,x}`.
   */
  APP_ROUTE = "APP_ROUTE",
  /**
   * `PRERENDER` represents an ISR enabled route that might
   * have a seeded cache entry or fallback generated during build
   */
  PRERENDER = "PRERENDER",
  /**
   * `STATIC_FILE` represents a static file (ie /_next/static)
   */
  STATIC_FILE = "STATIC_FILE",
  /**
   * `MIDDLEWARE` represents the middleware output if present
   */
  MIDDLEWARE = "MIDDLEWARE"
}
declare const PHASE_EXPORT = "phase-export";
declare const PHASE_ANALYZE = "phase-analyze";
declare const PHASE_PRODUCTION_BUILD = "phase-production-build";
declare const PHASE_PRODUCTION_SERVER = "phase-production-server";
declare const PHASE_DEVELOPMENT_SERVER = "phase-development-server";
declare const PHASE_TEST = "phase-test";
declare const PHASE_INFO = "phase-info";
type PHASE_TYPE = typeof PHASE_INFO | typeof PHASE_TEST | typeof PHASE_EXPORT | typeof PHASE_ANALYZE | typeof PHASE_PRODUCTION_BUILD | typeof PHASE_PRODUCTION_SERVER | typeof PHASE_DEVELOPMENT_SERVER;
declare const PAGES_MANIFEST = "pages-manifest.json";
declare const APP_PATHS_MANIFEST = "app-paths-manifest.json";
declare const APP_PATH_ROUTES_MANIFEST = "app-path-routes-manifest.json";
declare const BUILD_MANIFEST = "build-manifest.json";
declare const FUNCTIONS_CONFIG_MANIFEST = "functions-config-manifest.json";
declare const SUBRESOURCE_INTEGRITY_MANIFEST = "subresource-integrity-manifest";
declare const NEXT_FONT_MANIFEST = "next-font-manifest";
declare const EXPORT_MARKER = "export-marker.json";
declare const EXPORT_DETAIL = "export-detail.json";
declare const PREFETCH_HINTS = "prefetch-hints.json";
declare const PRERENDER_MANIFEST = "prerender-manifest.json";
declare const ROUTES_MANIFEST = "routes-manifest.json";
declare const IMAGES_MANIFEST = "images-manifest.json";
declare const SERVER_FILES_MANIFEST = "required-server-files";
declare const DEV_CLIENT_PAGES_MANIFEST = "_devPagesManifest.json";
declare const MIDDLEWARE_MANIFEST = "middleware-manifest.json";
declare const TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST = "_clientMiddlewareManifest.js";
declare const TURBOPACK_CLIENT_BUILD_MANIFEST = "client-build-manifest.json";
declare const DEV_CLIENT_MIDDLEWARE_MANIFEST = "_devMiddlewareManifest.json";
declare const REACT_LOADABLE_MANIFEST = "react-loadable-manifest.json";
declare const SERVER_DIRECTORY = "server";
declare const CONFIG_FILES: string[];
declare const BUILD_ID_FILE = "BUILD_ID";
declare const BLOCKED_PAGES: string[];
declare const CLIENT_PUBLIC_FILES_PATH = "public";
declare const CLIENT_STATIC_FILES_PATH = "static";
declare const STRING_LITERAL_DROP_BUNDLE = "__NEXT_DROP_CLIENT_FILE__";
declare const NEXT_BUILTIN_DOCUMENT = "__NEXT_BUILTIN_DOCUMENT__";
declare const BARREL_OPTIMIZATION_PREFIX = "__barrel_optimize__";
declare const CLIENT_REFERENCE_MANIFEST = "client-reference-manifest";
declare const SERVER_REFERENCE_MANIFEST = "server-reference-manifest";
declare const MIDDLEWARE_BUILD_MANIFEST = "middleware-build-manifest";
declare const MIDDLEWARE_REACT_LOADABLE_MANIFEST = "middleware-react-loadable-manifest";
declare const INTERCEPTION_ROUTE_REWRITE_MANIFEST = "interception-route-rewrite-manifest";
declare const DYNAMIC_CSS_MANIFEST = "dynamic-css-manifest";
declare const CLIENT_STATIC_FILES_RUNTIME_MAIN = "main";
declare const CLIENT_STATIC_FILES_RUNTIME_MAIN_APP = "main-app";
declare const APP_CLIENT_INTERNALS = "app-pages-internals";
declare const CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = "react-refresh";
declare const CLIENT_STATIC_FILES_RUNTIME_WEBPACK = "webpack";
declare const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS = "polyfills";
declare const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL: unique symbol;
declare const DEFAULT_RUNTIME_WEBPACK = "webpack-runtime";
declare const EDGE_RUNTIME_WEBPACK = "edge-runtime-webpack";
declare const STATIC_PROPS_ID = "__N_SSG";
declare const SERVER_PROPS_ID = "__N_SSP";
declare const DEFAULT_SERIF_FONT: {
  name: string;
  xAvgCharWidth: number;
  azAvgWidth: number;
  unitsPerEm: number;
};
declare const DEFAULT_SANS_SERIF_FONT: {
  name: string;
  xAvgCharWidth: number;
  azAvgWidth: number;
  unitsPerEm: number;
};
declare const STATIC_STATUS_PAGES: string[];
declare const TRACE_OUTPUT_VERSION = 1;
declare const TURBO_TRACE_DEFAULT_MEMORY_LIMIT = 6000;
declare const RSC_MODULE_TYPES: {
  readonly client: "client";
  readonly server: "server";
};
declare const EDGE_UNSUPPORTED_NODE_APIS: string[];
declare const SYSTEM_ENTRYPOINTS: Set<string>;
//#endregion
export { APP_CLIENT_INTERNALS, APP_PATHS_MANIFEST, APP_PATH_ROUTES_MANIFEST, AdapterOutputType, BARREL_OPTIMIZATION_PREFIX, BLOCKED_PAGES, BUILD_ID_FILE, BUILD_MANIFEST, CLIENT_PUBLIC_FILES_PATH, CLIENT_REFERENCE_MANIFEST, CLIENT_STATIC_FILES_PATH, CLIENT_STATIC_FILES_RUNTIME_MAIN, CLIENT_STATIC_FILES_RUNTIME_MAIN_APP, CLIENT_STATIC_FILES_RUNTIME_POLYFILLS, CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL, CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH, CLIENT_STATIC_FILES_RUNTIME_WEBPACK, COMPILER_INDEXES, COMPILER_NAMES, CONFIG_FILES, CompilerNameValues, DEFAULT_RUNTIME_WEBPACK, DEFAULT_SANS_SERIF_FONT, DEFAULT_SERIF_FONT, DEV_CLIENT_MIDDLEWARE_MANIFEST, DEV_CLIENT_PAGES_MANIFEST, DYNAMIC_CSS_MANIFEST, EDGE_RUNTIME_WEBPACK, EDGE_UNSUPPORTED_NODE_APIS, EXPORT_DETAIL, EXPORT_MARKER, FUNCTIONS_CONFIG_MANIFEST, IMAGES_MANIFEST, INTERCEPTION_ROUTE_REWRITE_MANIFEST, MIDDLEWARE_BUILD_MANIFEST, MIDDLEWARE_MANIFEST, MIDDLEWARE_REACT_LOADABLE_MANIFEST, MODERN_BROWSERSLIST_TARGET, NEXT_BUILTIN_DOCUMENT, NEXT_FONT_MANIFEST, PAGES_MANIFEST, PHASE_ANALYZE, PHASE_DEVELOPMENT_SERVER, PHASE_EXPORT, PHASE_INFO, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_TEST, PHASE_TYPE, PREFETCH_HINTS, PRERENDER_MANIFEST, REACT_LOADABLE_MANIFEST, ROUTES_MANIFEST, RSC_MODULE_TYPES, SERVER_DIRECTORY, SERVER_FILES_MANIFEST, SERVER_PROPS_ID, SERVER_REFERENCE_MANIFEST, STATIC_PROPS_ID, STATIC_STATUS_PAGES, STRING_LITERAL_DROP_BUNDLE, SUBRESOURCE_INTEGRITY_MANIFEST, SYSTEM_ENTRYPOINTS, TRACE_OUTPUT_VERSION, TURBOPACK_CLIENT_BUILD_MANIFEST, TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST, TURBO_TRACE_DEFAULT_MEMORY_LIMIT, UNDERSCORE_GLOBAL_ERROR_ROUTE, UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY, UNDERSCORE_NOT_FOUND_ROUTE, UNDERSCORE_NOT_FOUND_ROUTE_ENTRY, ValueOf };