//#region src/server/app-browser-hydration.ts
const RSC_FORM_STATE_GLOBAL = "__VINEXT_RSC_FORM_STATE__";
function consumeInitialFormState(global) {
	const formState = global["__VINEXT_RSC_FORM_STATE__"] ?? null;
	delete global[RSC_FORM_STATE_GLOBAL];
	return formState;
}
function createVinextHydrateRootOptions(options) {
	const hydrateOptions = {
		formState: options.formState,
		...options.onRecoverableError ? { onRecoverableError: options.onRecoverableError } : {},
		onUncaughtError: options.onUncaughtError
	};
	if (options.onCaughtError) return {
		...hydrateOptions,
		onCaughtError: options.onCaughtError
	};
	return hydrateOptions;
}
function hydrateRootInTransition(options) {
	let root;
	options.startTransition(() => {
		root = options.hydrateRoot(options.container, options.children, options.options);
	});
	if (root === void 0) throw new Error("[vinext] React.startTransition did not synchronously start hydration");
	return root;
}
//#endregion
export { RSC_FORM_STATE_GLOBAL, consumeInitialFormState, createVinextHydrateRootOptions, hydrateRootInTransition };
