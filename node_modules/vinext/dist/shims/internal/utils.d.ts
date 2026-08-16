//#region src/shims/internal/utils.d.ts
/**
 * Shim for next/dist/shared/lib/utils
 *
 * Used by: @sentry/nextjs (type-only import of NEXT_DATA).
 * Provides the NEXT_DATA type that matches window.__NEXT_DATA__.
 */
type NEXT_DATA = {
  props: Record<string, unknown>;
  page: string;
  query: Record<string, string | string[]>;
  buildId?: string;
  assetPrefix?: string;
  runtimeConfig?: Record<string, unknown>;
  nextExport?: boolean;
  autoExport?: boolean;
  isFallback?: boolean;
  dynamicIds?: (string | number)[];
  err?: {
    message: string;
    statusCode: number;
    name?: string;
  };
  isExperimentalCompile?: boolean;
  gsp?: boolean;
  gssp?: boolean;
  customServer?: boolean;
  gip?: boolean;
  appGip?: boolean;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  domainLocales?: ReadonlyArray<{
    domain: string;
    defaultLocale: string;
    locales?: readonly string[];
    http?: true;
  }>;
  scriptLoader?: unknown[];
  isPreview?: boolean;
  notFoundSrcPage?: string;
};
/**
 * Standard Next.js error shape.
 */
declare function execOnce<T extends (...args: unknown[]) => unknown>(fn: T): T;
declare function getLocationOrigin(): string;
declare function getURL(): string;
declare const SP: boolean;
declare const ST: boolean;
//#endregion
export { NEXT_DATA, SP, ST, execOnce, getLocationOrigin, getURL };