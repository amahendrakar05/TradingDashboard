import { UrlQuery } from "../../utils/query.js";

//#region src/shims/internal/interpolate-as.d.ts
/**
 * Wire-compatible alias for Node's `querystring.ParsedUrlQuery`. Inlined here
 * so this module has no dependency on the `querystring` types package.
 */
type ParsedUrlQuery = {
  [key: string]: string | string[] | undefined;
};
type DynamicRouteHrefProjection = {
  href: string;
  params: string[];
  query: ParsedUrlQuery;
  routePathname: string;
};
/**
 * Resolve a bracket-pattern route href against its displayed href. Query
 * values can be supplied directly (object-form hrefs) or parsed from the route
 * href (string-form hrefs). A `?` after `#` is part of the fragment, not a
 * query delimiter.
 */
declare function interpolateDynamicRouteHref(routeHref: string, asHref: string, queryInput?: UrlQuery): DynamicRouteHrefProjection | null;
//#endregion
export { DynamicRouteHrefProjection, interpolateDynamicRouteHref };