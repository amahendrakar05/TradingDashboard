//#region src/shims/internal/pages-router-accessor.d.ts
/**
 * Shared Pages Router navigation accessor.
 *
 * Both `next/navigation` (usePathname/useParams/useSearchParams) and the
 * internal `useUntrackedPathname` read from the same global Symbol. Keeping
 * the lookup in one place avoids the Symbol string and the error-handling
 * shape from drifting across modules.
 *
 * @internal
 */
type PagesNavigationContext = {
  pathname: string | null;
  searchParams: URLSearchParams;
  params: Record<string, string | string[]> | null;
};
declare function getPagesNavigationContext(): PagesNavigationContext | null;
//#endregion
export { PagesNavigationContext, getPagesNavigationContext };