import handler from "virtual:vinext-worker-entry";
//#region src/server/fetch-handler.ts
/**
* Default Cloudflare fetch handler for vinext.
*
* Use this directly in wrangler.jsonc:
*   "main": "vinext/server/fetch-handler"
*
* Or import and delegate to it from a custom worker:
*   import handler from "vinext/server/fetch-handler";
*   return handler.fetch(request, env, ctx);
*
* The vinext plugin resolves this to the App Router or Pages Router handler
* for the current project at build time.
*/
var fetch_handler_default = handler;
//#endregion
export { fetch_handler_default as default };
