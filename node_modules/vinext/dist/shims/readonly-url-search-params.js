//#region src/shims/readonly-url-search-params.ts
var ReadonlyURLSearchParamsError = class extends Error {
	constructor() {
		super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams");
	}
};
/**
* Read-only URLSearchParams wrapper matching Next.js runtime behavior.
* Mutation methods remain present for instanceof/API compatibility but throw.
*/
var ReadonlyURLSearchParams = class extends URLSearchParams {
	append() {
		throw new ReadonlyURLSearchParamsError();
	}
	delete() {
		throw new ReadonlyURLSearchParamsError();
	}
	set() {
		throw new ReadonlyURLSearchParamsError();
	}
	sort() {
		throw new ReadonlyURLSearchParamsError();
	}
};
//#endregion
export { ReadonlyURLSearchParams };
