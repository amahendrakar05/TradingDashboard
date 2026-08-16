import { scanMetadataFiles } from "../server/metadata-routes.js";
import { prerenderApp, prerenderPages } from "./prerender.js";
//#region src/build/static-export.ts
/**
* Convert a `PrerenderResult` into the legacy `StaticExportResult` shape.
*/
function toStaticExportResult(routes, extraOutputFiles = []) {
	const result = {
		pageCount: 0,
		files: [],
		warnings: [],
		errors: []
	};
	for (const r of routes) if (r.status === "rendered") {
		result.pageCount++;
		result.files.push(...r.outputFiles.filter((f) => f.endsWith(".html")));
	} else if (r.status === "skipped") {
		if (r.reason === "api") result.warnings.push(`API route ${r.route} skipped — API routes are not supported with output: 'export'`);
	} else if (r.status === "error") result.errors.push({
		route: r.route,
		error: r.error
	});
	result.files.push(...extraOutputFiles);
	return result;
}
/**
* Run static export for Pages Router.
*
* Delegates to `prerenderPages()` in export mode.
*/
async function staticExportPages(options) {
	return toStaticExportResult((await prerenderPages({
		mode: "export",
		pagesBundlePath: options.pagesBundlePath,
		routes: options.routes,
		apiRoutes: options.apiRoutes,
		pagesDir: options.pagesDir,
		outDir: options.outDir,
		config: options.config
	})).routes);
}
/**
* Run static export for App Router.
*
* Delegates to `prerenderApp()` in export mode.
*/
async function staticExportApp(options) {
	const metadataRoutes = options.appDir ? scanMetadataFiles(options.appDir) : [];
	const result = await prerenderApp({
		mode: "export",
		rscBundlePath: options.rscBundlePath,
		routes: options.routes,
		metadataRoutes,
		outDir: options.outDir,
		config: options.config
	});
	return toStaticExportResult(result.routes, result.outputFiles);
}
//#endregion
export { staticExportApp, staticExportPages };
