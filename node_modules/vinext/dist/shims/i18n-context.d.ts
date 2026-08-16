import { DomainLocale } from "../utils/domain-locale.js";

//#region src/shims/i18n-context.d.ts
type I18nContext = {
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  domainLocales?: readonly DomainLocale[];
  hostname?: string;
};
/**
 * Register ALS-backed accessors. Called by i18n-state.ts on import.
 * @internal
 */
declare function _registerI18nStateAccessors(accessors: {
  getI18nContext: () => I18nContext | null;
  setI18nContext: (ctx: I18nContext | null) => void;
}): void;
declare function getI18nContext(): I18nContext | null;
declare function setI18nContext(ctx: I18nContext | null): void;
//#endregion
export { I18nContext, _registerI18nStateAccessors, getI18nContext, setI18nContext };