//#region src/server/pages-router-entry.d.ts
/**
 * Router-specific Cloudflare Worker entry point for vinext Pages Router.
 *
 * New projects should usually use the router-selected entry in wrangler.jsonc:
 *   "main": "vinext/server/fetch-handler"
 *
 * This Pages Router entry remains available for existing configs and for custom
 * workers that need to opt into the Pages Router handler explicitly:
 *   "main": "vinext/server/pages-router-entry"
 *
 * Or import and delegate to it from a custom worker:
 *   import handler from "vinext/server/pages-router-entry";
 *   return handler.fetch(request, env, ctx);
 */
type AssetFetcher = {
  fetch(request: Request): Promise<Response> | Response;
};
type PagesWorkerEnv = {
  ASSETS?: AssetFetcher;
} & Record<string, unknown>;
type PagesWorkerExecutionContext = {
  waitUntil?(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
};
declare const _default: {
  fetch(request: Request, env?: PagesWorkerEnv, ctx?: PagesWorkerExecutionContext): Promise<Response>;
};
//#endregion
export { _default as default };