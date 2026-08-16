import { NextRouter } from "../router.js";
import { Context } from "react";

//#region src/shims/internal/router-context.d.ts
declare const RouterContext: Context<NextRouter | null>;
//#endregion
export { RouterContext };