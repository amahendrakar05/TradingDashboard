import { DomainLocale } from "../utils/domain-locale.js";

//#region src/shims/client-locale.d.ts
declare function getCurrentBrowserLocale({
  basePath,
  domainLocales,
  hostname
}: {
  basePath: string;
  domainLocales: readonly DomainLocale[] | undefined;
  hostname: string | null | undefined;
}): string | undefined;
//#endregion
export { getCurrentBrowserLocale };