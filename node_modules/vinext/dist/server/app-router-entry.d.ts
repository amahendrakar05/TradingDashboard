import { ExecutionContextLike } from "../shims/request-context.js";

//#region src/server/app-router-entry.d.ts
type WorkerAssetEnv = {
  ASSETS?: {
    fetch(request: Request): Promise<Response> | Response;
  };
};
declare const _default: {
  fetch(request: Request, env?: WorkerAssetEnv, ctx?: ExecutionContextLike): Promise<Response>;
};
//#endregion
export { _default as default };