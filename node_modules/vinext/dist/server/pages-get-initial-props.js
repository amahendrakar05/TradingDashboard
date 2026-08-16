//#region src/server/pages-get-initial-props.ts
/**
* Build the URL-state subset of Next.js's ServerRouter used by isolated
* initial-props helpers. Real request handlers pass their full `next/router`
* instance; this fallback keeps direct helper callers and tests aligned with
* the same required fields.
*/
function createPagesGetInitialPropsRouter(pathname, query, asPath) {
	return {
		route: pathname.replace(/\/$/, "") || "/",
		pathname,
		query,
		asPath
	};
}
function isObjectLike(value) {
	return typeof value === "object" && value !== null || typeof value === "function";
}
function isPagesGetInitialProps(value) {
	return typeof value === "function";
}
function getObjectProperty(target, property) {
	if (!isObjectLike(target)) return void 0;
	return Reflect.get(target, property);
}
function getDisplayName(component) {
	const displayName = getObjectProperty(component, "displayName");
	if (typeof displayName === "string" && displayName.length > 0) return displayName;
	const name = getObjectProperty(component, "name");
	if (typeof name === "string" && name.length > 0) return name;
	return "Component";
}
function getInitialPropsFn(component) {
	const getInitialProps = getObjectProperty(component, "getInitialProps");
	return isPagesGetInitialProps(getInitialProps) ? getInitialProps : null;
}
function hasPagesGetInitialProps(component) {
	return getInitialPropsFn(component) !== null;
}
function isResponseSent(res) {
	return getObjectProperty(res, "headersSent") === true || getObjectProperty(res, "writableEnded") === true;
}
function isPropsObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function describeInitialPropsValue(value) {
	if (value === void 0) return "undefined";
	if (value === null) return "null";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return `${value}`;
	if (typeof value === "symbol") return value.description ? `Symbol(${value.description})` : "Symbol()";
	if (typeof value === "function") return `[function ${getDisplayName(value)}]`;
	return Object.prototype.toString.call(value);
}
async function loadPagesGetInitialProps(component, context) {
	const getInitialProps = getInitialPropsFn(component);
	if (!getInitialProps) return null;
	const result = await Promise.resolve(getInitialProps.call(component, context));
	if (isResponseSent(context.res)) return isPropsObject(result) ? result : {};
	if (!isPropsObject(result)) throw new Error(`"${getDisplayName(component)}.getInitialProps()" should resolve to an object. But found "${describeInitialPropsValue(result)}" instead.`);
	return result;
}
/**
* Run the custom `App`'s `getInitialProps` for the dev SSR render path and
* return a decision the caller applies.
*
* This is the dev-server counterpart to the production page-data resolver's
* app-initial-props loading. It is invoked lazily — only when a request is
* actually going to render (cache miss / on-demand revalidation), never on an
* ISR cache HIT/STALE that serves cached HTML verbatim — so userland `App`
* data code does not run on the cache hot path.
*/
async function loadDevAppInitialProps(ctx) {
	if (!hasPagesGetInitialProps(ctx.appComponent)) return { kind: "skip" };
	const initialProps = await loadPagesGetInitialProps(ctx.appComponent, {
		AppTree: ctx.appTree,
		Component: ctx.component,
		router: ctx.router ?? createPagesGetInitialPropsRouter(ctx.pathname, ctx.query, ctx.asPath),
		ctx: {
			req: ctx.req,
			res: ctx.res,
			pathname: ctx.pathname,
			query: ctx.query,
			asPath: ctx.asPath,
			locale: ctx.locale,
			locales: ctx.locales,
			defaultLocale: ctx.defaultLocale
		}
	});
	if (isResponseSent(ctx.res)) return { kind: "response-sent" };
	const initialPageProps = isPropsObject(initialProps) ? initialProps.pageProps : void 0;
	return {
		kind: "render",
		pageProps: isPropsObject(initialPageProps) ? initialPageProps : {},
		renderProps: isPropsObject(initialProps) ? {
			...initialProps,
			pageProps: initialPageProps
		} : { pageProps: initialPageProps }
	};
}
//#endregion
export { createPagesGetInitialPropsRouter, hasPagesGetInitialProps, isResponseSent, loadDevAppInitialProps, loadPagesGetInitialProps };
