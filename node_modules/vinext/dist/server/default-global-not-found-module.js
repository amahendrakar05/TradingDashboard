import DefaultNotFound from "../shims/default-not-found.js";
import React from "react";
//#region src/server/default-global-not-found-module.ts
function DefaultGlobalNotFound() {
	return React.createElement("html", null, React.createElement("body", null, React.createElement(DefaultNotFound)));
}
/**
* Module-shaped wrapper around Next.js's built-in global not-found document.
* Unlike the regular default not-found boundary, this component owns the
* document shell because global not-found responses skip the root layout.
*/
const DEFAULT_GLOBAL_NOT_FOUND_MODULE = { default: DefaultGlobalNotFound };
//#endregion
export { DEFAULT_GLOBAL_NOT_FOUND_MODULE };
