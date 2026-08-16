import { NextI18nConfig } from "../config/next-config.js";
import { Route } from "../routing/pages-router.js";
import { ModuleImporter } from "./instrumentation.js";
import { IncomingMessage, ServerResponse } from "node:http";

//#region src/server/api-handler.d.ts
/**
 * Handle an API route request.
 * Returns true if the request was handled, false if no API route matched.
 */
declare function handleApiRoute(runner: ModuleImporter, req: IncomingMessage, res: ServerResponse, url: string, apiRoutes: Route[], nextConfig?: {
  basePath?: string;
  i18n?: NextI18nConfig | null;
  trailingSlash?: boolean;
}): Promise<boolean>;
//#endregion
export { handleApiRoute };