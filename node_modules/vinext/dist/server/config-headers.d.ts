import { NextHeader } from "../config/next-config.js";
import { RequestContext } from "../config/request-context.js";
import { BasePathMatchState } from "../config/config-matchers.js";
import { HeaderRecord } from "./request-pipeline.js";

//#region src/server/config-headers.d.ts
type ApplyConfigHeadersOptions = {
  configHeaders: NextHeader[];
  pathname: string;
  requestContext: RequestContext;
  /**
   * basePath gating state. When omitted, every rule is treated as a default
   * (basePath: true) rule for backward compatibility — callers that need to
   * support `basePath: false` headers must pass this in.
   */
  basePathState?: BasePathMatchState; /** Existing framework-generated headers that matching config rules may replace. */
  overwriteExisting?: ReadonlySet<string>;
};
/** Apply matched next.config.js headers to a Web Headers object. */
declare function applyConfigHeadersToResponse(responseHeaders: Headers, options: ApplyConfigHeadersOptions): void;
/** Apply matched next.config.js headers to an early response header record. */
declare function applyConfigHeadersToHeaderRecord(headers: HeaderRecord, options: ApplyConfigHeadersOptions): void;
//#endregion
export { applyConfigHeadersToHeaderRecord, applyConfigHeadersToResponse };