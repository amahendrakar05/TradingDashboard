//#region src/server/app-static-generation.ts
function getAppPageStaticGenerationErrorMessage() {
	return "Page with `dynamic = \"error\"` used a dynamic API. This page was expected to be fully static, but headers(), cookies(), or searchParams was accessed. Remove the dynamic API usage or change the dynamic config to \"auto\" or \"force-dynamic\".";
}
function getAppRouteStaticGenerationErrorMessage(routePattern, expression) {
	return `Route ${routePattern ?? "unknown route"} with \`dynamic = "error"\` couldn't be rendered statically because it used ${expression ?? "a dynamic request API"}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`;
}
function createStaticGenerationHeadersContext(options) {
	const context = {
		headers: new Headers(),
		cookies: /* @__PURE__ */ new Map(),
		draftModeEnabled: options.draftModeEnabled,
		draftModeSecret: options.draftModeSecret
	};
	if (options.dynamicConfig === "force-static") context.forceStatic = true;
	if (options.dynamicConfig === "error") context.accessError = new Error(options.routeKind === "route" ? getAppRouteStaticGenerationErrorMessage(options.routePattern) : getAppPageStaticGenerationErrorMessage());
	return context;
}
//#endregion
export { createStaticGenerationHeadersContext, getAppPageStaticGenerationErrorMessage, getAppRouteStaticGenerationErrorMessage };
