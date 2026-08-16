//#region src/utils/prerender-output-paths.ts
/**
* Determine the HTML output file path for a prerendered URL.
* Respects trailingSlash config.
*/
function getOutputPath(urlPath, trailingSlash) {
	if (urlPath === "/") return "index.html";
	const clean = urlPath.replace(/^\//, "");
	if (trailingSlash) return `${clean}/index.html`;
	return `${clean}.html`;
}
/**
* Determine the RSC output file path for a prerendered URL.
* "/blog/hello-world" -> "blog/hello-world.rsc"
* "/"                 -> "index.rsc"
*/
function getRscOutputPath(urlPath) {
	if (urlPath === "/") return "index.rsc";
	return urlPath.replace(/^\//, "") + ".rsc";
}
//#endregion
export { getOutputPath, getRscOutputPath };
