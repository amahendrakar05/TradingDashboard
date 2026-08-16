//#region src/shims/constants.ts
/**
* next/constants shim
*
* Provides build/runtime phase constants used by next.config.js
* and some third-party libraries.
*/
const MODERN_BROWSERSLIST_TARGET = [
	"chrome 111",
	"edge 111",
	"firefox 111",
	"safari 16.4"
];
const COMPILER_NAMES = {
	client: "client",
	server: "server",
	edgeServer: "edge-server"
};
const COMPILER_INDEXES = {
	[COMPILER_NAMES.client]: 0,
	[COMPILER_NAMES.server]: 1,
	[COMPILER_NAMES.edgeServer]: 2
};
const UNDERSCORE_NOT_FOUND_ROUTE = "/_not-found";
const UNDERSCORE_NOT_FOUND_ROUTE_ENTRY = `${UNDERSCORE_NOT_FOUND_ROUTE}/page`;
const UNDERSCORE_GLOBAL_ERROR_ROUTE = "/_global-error";
const UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY = `${UNDERSCORE_GLOBAL_ERROR_ROUTE}/page`;
let AdapterOutputType = /* @__PURE__ */ function(AdapterOutputType) {
	/**
	* `PAGES` represents all the React pages that are under `pages/`.
	*/
	AdapterOutputType["PAGES"] = "PAGES";
	/**
	* `PAGES_API` represents all the API routes under `pages/api/`.
	*/
	AdapterOutputType["PAGES_API"] = "PAGES_API";
	/**
	* `APP_PAGE` represents all the React pages that are under `app/` with the
	* filename of `page.{j,t}s{,x}`.
	*/
	AdapterOutputType["APP_PAGE"] = "APP_PAGE";
	/**
	* `APP_ROUTE` represents all the API routes and metadata routes that are under `app/` with the
	* filename of `route.{j,t}s{,x}`.
	*/
	AdapterOutputType["APP_ROUTE"] = "APP_ROUTE";
	/**
	* `PRERENDER` represents an ISR enabled route that might
	* have a seeded cache entry or fallback generated during build
	*/
	AdapterOutputType["PRERENDER"] = "PRERENDER";
	/**
	* `STATIC_FILE` represents a static file (ie /_next/static)
	*/
	AdapterOutputType["STATIC_FILE"] = "STATIC_FILE";
	/**
	* `MIDDLEWARE` represents the middleware output if present
	*/
	AdapterOutputType["MIDDLEWARE"] = "MIDDLEWARE";
	return AdapterOutputType;
}({});
const PHASE_EXPORT = "phase-export";
const PHASE_ANALYZE = "phase-analyze";
const PHASE_PRODUCTION_BUILD = "phase-production-build";
const PHASE_PRODUCTION_SERVER = "phase-production-server";
const PHASE_DEVELOPMENT_SERVER = "phase-development-server";
const PHASE_TEST = "phase-test";
const PHASE_INFO = "phase-info";
const PAGES_MANIFEST = "pages-manifest.json";
const APP_PATHS_MANIFEST = "app-paths-manifest.json";
const APP_PATH_ROUTES_MANIFEST = "app-path-routes-manifest.json";
const BUILD_MANIFEST = "build-manifest.json";
const FUNCTIONS_CONFIG_MANIFEST = "functions-config-manifest.json";
const SUBRESOURCE_INTEGRITY_MANIFEST = "subresource-integrity-manifest";
const NEXT_FONT_MANIFEST = "next-font-manifest";
const EXPORT_MARKER = "export-marker.json";
const EXPORT_DETAIL = "export-detail.json";
const PREFETCH_HINTS = "prefetch-hints.json";
const PRERENDER_MANIFEST = "prerender-manifest.json";
const ROUTES_MANIFEST = "routes-manifest.json";
const IMAGES_MANIFEST = "images-manifest.json";
const SERVER_FILES_MANIFEST = "required-server-files";
const DEV_CLIENT_PAGES_MANIFEST = "_devPagesManifest.json";
const MIDDLEWARE_MANIFEST = "middleware-manifest.json";
const TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST = "_clientMiddlewareManifest.js";
const TURBOPACK_CLIENT_BUILD_MANIFEST = "client-build-manifest.json";
const DEV_CLIENT_MIDDLEWARE_MANIFEST = "_devMiddlewareManifest.json";
const REACT_LOADABLE_MANIFEST = "react-loadable-manifest.json";
const SERVER_DIRECTORY = "server";
const CONFIG_FILES = [
	"next.config.js",
	"next.config.mjs",
	"next.config.ts",
	...process?.features?.typescript ? ["next.config.mts"] : []
];
const BUILD_ID_FILE = "BUILD_ID";
const BLOCKED_PAGES = [
	"/_document",
	"/_app",
	"/_error"
];
const CLIENT_PUBLIC_FILES_PATH = "public";
const CLIENT_STATIC_FILES_PATH = "static";
const STRING_LITERAL_DROP_BUNDLE = "__NEXT_DROP_CLIENT_FILE__";
const NEXT_BUILTIN_DOCUMENT = "__NEXT_BUILTIN_DOCUMENT__";
const BARREL_OPTIMIZATION_PREFIX = "__barrel_optimize__";
const CLIENT_REFERENCE_MANIFEST = "client-reference-manifest";
const SERVER_REFERENCE_MANIFEST = "server-reference-manifest";
const MIDDLEWARE_BUILD_MANIFEST = "middleware-build-manifest";
const MIDDLEWARE_REACT_LOADABLE_MANIFEST = "middleware-react-loadable-manifest";
const INTERCEPTION_ROUTE_REWRITE_MANIFEST = "interception-route-rewrite-manifest";
const DYNAMIC_CSS_MANIFEST = "dynamic-css-manifest";
const CLIENT_STATIC_FILES_RUNTIME_MAIN = `main`;
const CLIENT_STATIC_FILES_RUNTIME_MAIN_APP = `${CLIENT_STATIC_FILES_RUNTIME_MAIN}-app`;
const APP_CLIENT_INTERNALS = "app-pages-internals";
const CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH = `react-refresh`;
const CLIENT_STATIC_FILES_RUNTIME_WEBPACK = `webpack`;
const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS = "polyfills";
const CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL = Symbol(CLIENT_STATIC_FILES_RUNTIME_POLYFILLS);
const DEFAULT_RUNTIME_WEBPACK = "webpack-runtime";
const EDGE_RUNTIME_WEBPACK = "edge-runtime-webpack";
const STATIC_PROPS_ID = "__N_SSG";
const SERVER_PROPS_ID = "__N_SSP";
const DEFAULT_SERIF_FONT = {
	name: "Times New Roman",
	xAvgCharWidth: 821,
	azAvgWidth: 854.3953488372093,
	unitsPerEm: 2048
};
const DEFAULT_SANS_SERIF_FONT = {
	name: "Arial",
	xAvgCharWidth: 904,
	azAvgWidth: 934.5116279069767,
	unitsPerEm: 2048
};
const STATIC_STATUS_PAGES = ["/500"];
const TRACE_OUTPUT_VERSION = 1;
const TURBO_TRACE_DEFAULT_MEMORY_LIMIT = 6e3;
const RSC_MODULE_TYPES = {
	client: "client",
	server: "server"
};
const EDGE_UNSUPPORTED_NODE_APIS = [
	"clearImmediate",
	"setImmediate",
	"BroadcastChannel",
	"ByteLengthQueuingStrategy",
	"CompressionStream",
	"CountQueuingStrategy",
	"DecompressionStream",
	"DomException",
	"MessageChannel",
	"MessageEvent",
	"MessagePort",
	"ReadableByteStreamController",
	"ReadableStreamBYOBRequest",
	"ReadableStreamDefaultController",
	"TransformStreamDefaultController",
	"WritableStreamDefaultController"
];
const SYSTEM_ENTRYPOINTS = /* @__PURE__ */ new Set([
	CLIENT_STATIC_FILES_RUNTIME_MAIN,
	CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH,
	CLIENT_STATIC_FILES_RUNTIME_MAIN_APP
]);
//#endregion
export { APP_CLIENT_INTERNALS, APP_PATHS_MANIFEST, APP_PATH_ROUTES_MANIFEST, AdapterOutputType, BARREL_OPTIMIZATION_PREFIX, BLOCKED_PAGES, BUILD_ID_FILE, BUILD_MANIFEST, CLIENT_PUBLIC_FILES_PATH, CLIENT_REFERENCE_MANIFEST, CLIENT_STATIC_FILES_PATH, CLIENT_STATIC_FILES_RUNTIME_MAIN, CLIENT_STATIC_FILES_RUNTIME_MAIN_APP, CLIENT_STATIC_FILES_RUNTIME_POLYFILLS, CLIENT_STATIC_FILES_RUNTIME_POLYFILLS_SYMBOL, CLIENT_STATIC_FILES_RUNTIME_REACT_REFRESH, CLIENT_STATIC_FILES_RUNTIME_WEBPACK, COMPILER_INDEXES, COMPILER_NAMES, CONFIG_FILES, DEFAULT_RUNTIME_WEBPACK, DEFAULT_SANS_SERIF_FONT, DEFAULT_SERIF_FONT, DEV_CLIENT_MIDDLEWARE_MANIFEST, DEV_CLIENT_PAGES_MANIFEST, DYNAMIC_CSS_MANIFEST, EDGE_RUNTIME_WEBPACK, EDGE_UNSUPPORTED_NODE_APIS, EXPORT_DETAIL, EXPORT_MARKER, FUNCTIONS_CONFIG_MANIFEST, IMAGES_MANIFEST, INTERCEPTION_ROUTE_REWRITE_MANIFEST, MIDDLEWARE_BUILD_MANIFEST, MIDDLEWARE_MANIFEST, MIDDLEWARE_REACT_LOADABLE_MANIFEST, MODERN_BROWSERSLIST_TARGET, NEXT_BUILTIN_DOCUMENT, NEXT_FONT_MANIFEST, PAGES_MANIFEST, PHASE_ANALYZE, PHASE_DEVELOPMENT_SERVER, PHASE_EXPORT, PHASE_INFO, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_TEST, PREFETCH_HINTS, PRERENDER_MANIFEST, REACT_LOADABLE_MANIFEST, ROUTES_MANIFEST, RSC_MODULE_TYPES, SERVER_DIRECTORY, SERVER_FILES_MANIFEST, SERVER_PROPS_ID, SERVER_REFERENCE_MANIFEST, STATIC_PROPS_ID, STATIC_STATUS_PAGES, STRING_LITERAL_DROP_BUNDLE, SUBRESOURCE_INTEGRITY_MANIFEST, SYSTEM_ENTRYPOINTS, TRACE_OUTPUT_VERSION, TURBOPACK_CLIENT_BUILD_MANIFEST, TURBOPACK_CLIENT_MIDDLEWARE_MANIFEST, TURBO_TRACE_DEFAULT_MEMORY_LIMIT, UNDERSCORE_GLOBAL_ERROR_ROUTE, UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY, UNDERSCORE_NOT_FOUND_ROUTE, UNDERSCORE_NOT_FOUND_ROUTE_ENTRY };
