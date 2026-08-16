import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { findFileWithExts } from "../routing/file-matcher.js";
import { patternToNextFormat } from "../routing/route-validation.js";
import { apiRouter, pagesRouter } from "../routing/pages-router.js";
import { hasExportedName } from "../build/report.js";
import { readFile } from "node:fs/promises";
//#region src/entries/pages-client-entry.ts
/**
* Pages Router client hydration entry generator.
*
* Generates the virtual client entry module (`virtual:vinext-client-entry`).
* This is the entry point for `vite build` (client bundle). It maps route
* patterns to dynamic imports of page modules so Vite code-splits each page
* into its own chunk. At runtime it reads __NEXT_DATA__ to determine which
* page to hydrate.
*
* Extracted from index.ts.
*/
/**
* Project a Pages `Route` down to the public `VinextPagesLinkPrefetchRoute`
* shape used for client-side hybrid ownership decisions. Mirrors
* `toLinkPrefetchRoute` in `app-browser-entry.ts`.
*
* Lives here (not in `routing/pages-router.ts`) so the routing module
* stays free of `vitext/client` type imports.
*/
function toPagesLinkPrefetchRoute(route) {
	return {
		canPrefetchLoadingShell: false,
		isDynamic: route.isDynamic,
		patternParts: [...route.patternParts]
	};
}
async function hasGetStaticPropsExport(filePath) {
	return hasExportedName(await readFile(filePath, "utf8"), "getStaticProps");
}
async function hasGetServerSidePropsExport(filePath) {
	return hasExportedName(await readFile(filePath, "utf8"), "getServerSideProps");
}
async function generateClientEntry(pagesDir, nextConfig, fileMatcher, options = {}) {
	const pageRoutes = await pagesRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
	const apiRoutes = await apiRouter(pagesDir, nextConfig?.pageExtensions, fileMatcher);
	const appFilePath = findFileWithExts(pagesDir, "_app", fileMatcher);
	const errorFilePath = findFileWithExts(pagesDir, "_error", fileMatcher);
	const hasApp = appFilePath !== null;
	const appPrefetchRoutes = options.appPrefetchRoutes ?? [];
	const pagesPrefetchRoutes = [...pageRoutes.map(toPagesLinkPrefetchRoute), ...apiRoutes.map((route) => ({
		...toPagesLinkPrefetchRoute(route),
		documentOnly: true
	}))];
	const pagesSsgPatterns = (await Promise.all(pageRoutes.map(async (route) => await hasGetStaticPropsExport(route.filePath) ? patternToNextFormat(route.pattern) : null))).filter((pattern) => pattern !== null);
	const pagesSspPatterns = (await Promise.all(pageRoutes.map(async (route) => await hasGetServerSidePropsExport(route.filePath) ? patternToNextFormat(route.pattern) : null))).filter((pattern) => pattern !== null);
	const instrumentationClientPath = options.instrumentationClientPath ?? null;
	const loaderEntries = pageRoutes.map((r) => {
		const absPath = r.filePath;
		const nextFormatPattern = patternToNextFormat(r.pattern);
		return `  ${JSON.stringify(nextFormatPattern)}: () => import(${JSON.stringify(absPath)})`;
	});
	loaderEntries.push(errorFilePath !== null ? `  "/_error": () => import(${JSON.stringify(errorFilePath)})` : "  \"/_error\": () => import(\"next/error\")");
	const appFileBase = appFilePath ?? void 0;
	const userInstrumentationImport = instrumentationClientPath ? `import ${JSON.stringify(toSlash(instrumentationClientPath))};\n` : "";
	const reactPreambleImport = options.reactPreamble === false ? "" : "import \"@vitejs/plugin-react/preamble\";\n";
	const reactStrictModeEnabled = nextConfig.reactStrictMode === true;
	return `${userInstrumentationImport}${reactPreambleImport}
import "vinext/instrumentation-client";
import React from "react";
import { hydrateRoot } from "react-dom/client";
import Router, {
  wrapWithRouterContext,
  _initializePagesRouterReadyFromNextData,
} from "next/router";

const pageLoaders = {
${loaderEntries.join(",\n")}
};
${hasApp ? `
const appLoader = () => import(${JSON.stringify(appFileBase)});
` : `
const appLoader = undefined;
`}
// Expose the code-split loader manifest on window so client-side
// _next/data navigations in shims/router.ts can resolve the correct page
// chunk for any route. Without this, navigateClient() would have to extract
// the chunk URL from an HTML response — the whole point of switching to the
// JSON data endpoint is to avoid that round trip.
//
// Keys are route patterns in Next.js bracket format (matching __NEXT_DATA__.page
// and the keys of pageLoaders above). The patterns list is the same as
// Object.keys(pageLoaders), exposed separately so navigateClient() can iterate
// it without re-keying the map. Ordering is the insertion order of pageRoutes,
// which pagesRouter() has already sorted by specificity (static → dynamic →
// catch-all → optional catch-all) via sortRoutes — so matchPagesPattern()
// can iterate in order and trust the first match.
window.__VINEXT_PAGE_LOADERS__ = pageLoaders;
window.__VINEXT_PAGE_PATTERNS__ = Object.keys(pageLoaders);
// reactStrictMode flag — read by wrapWithRouterContext (next/router) so the
// <React.StrictMode> wrap is applied on initial hydration and every navigation.
window.__VINEXT_REACT_STRICT_MODE__ = ${JSON.stringify(reactStrictModeEnabled)};
window.__VINEXT_PAGES_SSG_PATTERNS__ = ${JSON.stringify(pagesSsgPatterns)};
window.__VINEXT_PAGES_SSP_PATTERNS__ = ${JSON.stringify(pagesSspPatterns)};
window.__VINEXT_MIDDLEWARE_MATCHER__ = ${JSON.stringify(options.middlewareMatcher)};
window.__VINEXT_APP_LOADER__ = appLoader;
// Expose the App Router prefetch manifest so Pages Router \`<Link>\`s and
// \`Router.prefetch\` can detect when a prefetch target is actually an App
// Router route, and mark it on \`Router.components[urlPathname]\` with
// \`{ __appRouter: true }\`. Mirrors Next.js's \`_bfl\`-driven marker write at
// .nextjs-ref/packages/next/src/shared/lib/router/router.ts:2525, which the
// Next.js deploy test
//   test/e2e/app-dir/app/index.test.ts → "should successfully detect app
//   route during prefetch"
// asserts via \`window.next.router.components[<path>]\`. Issue #1526.
//
// In a hybrid Pages + App Router build, this entry runs when the user lands
// on a Pages Router page. The App Router browser entry sets the same global
// when the user lands on an App Router page (see app-browser-entry.ts) — the
// two writes do not race because only one entry executes per page load.
window.__VINEXT_LINK_PREFETCH_ROUTES__ = ${JSON.stringify(appPrefetchRoutes)};
// Pages route manifest, exposed so the App Router runtime can decide when
// a soft-navigated URL is actually owned by Pages (and must hard-navigate
// instead of issuing an RSC request). Set here AND in app-browser-entry.ts
// so whichever entry runs first emits the Pages manifest.
window.__VINEXT_PAGES_LINK_PREFETCH_ROUTES__ = ${JSON.stringify(pagesPrefetchRoutes)};
window.__VINEXT_CLIENT_REDIRECTS__ = ${JSON.stringify(nextConfig.redirects)};
window.__VINEXT_CLIENT_REWRITES__ = ${JSON.stringify(nextConfig.rewrites)};

const nextDataElement = document.getElementById("__NEXT_DATA__");
if (nextDataElement?.textContent) {
  window.__NEXT_DATA__ = JSON.parse(nextDataElement.textContent);
  window.__VINEXT_LOCALE__ = window.__NEXT_DATA__.locale;
  window.__VINEXT_LOCALES__ = window.__NEXT_DATA__.locales;
  window.__VINEXT_DEFAULT_LOCALE__ = window.__NEXT_DATA__.defaultLocale;
}

async function hydrate() {
  const nextData = window.__NEXT_DATA__;
  if (!nextData) {
    console.error("[vinext] No __NEXT_DATA__ found");
    return;
  }

  _initializePagesRouterReadyFromNextData(nextData);

  let hydrateRootOptions;
  if (import.meta.env.DEV) {
    const overlay = await import("vinext/dev-error-overlay");
    overlay.installDevErrorOverlay();
    overlay.installViteHmrErrorHandler(import.meta.hot);
    overlay.reportInitialDevServerErrors();
    hydrateRootOptions = {
      onCaughtError: overlay.devOnCaughtError,
      onUncaughtError: overlay.devOnUncaughtError,
    };
  }

  const props = nextData.props && typeof nextData.props === "object" ? nextData.props : {};
  const rawPageProps = props.pageProps;
  const pageProps = rawPageProps && typeof rawPageProps === "object" ? rawPageProps : {};
  const loader = pageLoaders[nextData.page];
  if (!loader) {
    console.error("[vinext] No page loader for route:", nextData.page);
    return;
  }

  const pageModule = await loader();
  const PageComponent = pageModule.default;
  if (!PageComponent) {
    console.error("[vinext] Page module has no default export");
    return;
  }

  let element;
  ${hasApp ? `
  try {
    const appModule = await appLoader();
    const AppComponent = appModule.default;
    window.__VINEXT_APP__ = AppComponent;
    element = React.createElement(AppComponent, {
      ...props,
      Component: PageComponent,
      pageProps: rawPageProps,
      router: Router,
    });
  } catch {
    element = React.createElement(PageComponent, pageProps);
  }
  ` : `
  element = React.createElement(PageComponent, pageProps);
  `}

  let resolveHydrationCommit;
  const hydrationCommitted = new Promise((resolve) => {
    resolveHydrationCommit = resolve;
  });

  // Wrap with RouterContext.Provider so next/router and next/compat/router work during hydration.
  // When reactStrictMode is enabled, wrapWithRouterContext also wraps the tree
  // in <React.StrictMode> (see next/router) — applied here and on every
  // navigation render, matching Next.js.
  element = wrapWithRouterContext(element, resolveHydrationCommit);

  const container = document.getElementById("__next");
  if (!container) {
    console.error("[vinext] No #__next element found");
    return;
  }

  const root = hydrateRoot(container, element, hydrateRootOptions);
  window.__VINEXT_ROOT__ = root;
  await hydrationCommitted;
  const hydratedAt = performance.now();
  window.__VINEXT_HYDRATED_AT = hydratedAt;
  window.__NEXT_HYDRATED = true;
  window.__NEXT_HYDRATED_AT = hydratedAt;
  window.__NEXT_HYDRATED_CB?.();

  if (nextData.isFallback) {
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    const routeUrl = nextData.__vinext?.routeUrl;
    await Router.replace(
      routeUrl || currentUrl,
      routeUrl ? currentUrl : undefined,
      { _h: 1, scroll: false },
    );
  }
}

hydrate();
`;
}
//#endregion
export { generateClientEntry };
