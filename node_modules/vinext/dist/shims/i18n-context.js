//#region src/shims/i18n-context.ts
let _getI18nContext = () => {
	if (globalThis.__VINEXT_DEFAULT_LOCALE__ == null && globalThis.__VINEXT_LOCALE__ == null) return null;
	return {
		locale: globalThis.__VINEXT_LOCALE__,
		locales: globalThis.__VINEXT_LOCALES__,
		defaultLocale: globalThis.__VINEXT_DEFAULT_LOCALE__,
		domainLocales: globalThis.__VINEXT_DOMAIN_LOCALES__,
		hostname: globalThis.__VINEXT_HOSTNAME__
	};
};
let _setI18nContextImpl = (ctx) => {
	if (ctx) {
		globalThis.__VINEXT_LOCALE__ = ctx.locale;
		globalThis.__VINEXT_LOCALES__ = ctx.locales;
		globalThis.__VINEXT_DEFAULT_LOCALE__ = ctx.defaultLocale;
		globalThis.__VINEXT_DOMAIN_LOCALES__ = ctx.domainLocales;
		globalThis.__VINEXT_HOSTNAME__ = ctx.hostname;
	} else {
		globalThis.__VINEXT_LOCALE__ = void 0;
		globalThis.__VINEXT_LOCALES__ = void 0;
		globalThis.__VINEXT_DEFAULT_LOCALE__ = void 0;
		globalThis.__VINEXT_DOMAIN_LOCALES__ = void 0;
		globalThis.__VINEXT_HOSTNAME__ = void 0;
	}
};
/**
* Register ALS-backed accessors. Called by i18n-state.ts on import.
* @internal
*/
function _registerI18nStateAccessors(accessors) {
	_getI18nContext = accessors.getI18nContext;
	_setI18nContextImpl = accessors.setI18nContext;
}
function getI18nContext() {
	return _getI18nContext();
}
function setI18nContext(ctx) {
	_setI18nContextImpl(ctx);
}
//#endregion
export { _registerI18nStateAccessors, getI18nContext, setI18nContext };
