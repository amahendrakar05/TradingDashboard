import { ThenableParamsObserver } from "./thenable-params.js";
import React from "react";

//#region src/shims/metadata.d.ts
type Viewport = {
  /** Viewport width (default: "device-width") */width?: string | number; /** Viewport height */
  height?: string | number; /** Initial scale */
  initialScale?: number; /** Minimum scale */
  minimumScale?: number; /** Maximum scale */
  maximumScale?: number; /** Whether user can scale */
  userScalable?: boolean; /** Theme color — single color or array of { media, color } */
  themeColor?: string | Array<{
    media?: string;
    color: string;
  }>; /** Color scheme: 'light' | 'dark' | 'light dark' | 'normal' */
  colorScheme?: string;
};
/**
 * Resolve viewport config from a module. Handles both static `viewport` export
 * and async `generateViewport()` function.
 */
declare function resolveModuleViewport(mod: Record<string, unknown>, params: Record<string, string | string[]>, searchParams?: Record<string, string | string[]>, searchParamsObserver?: ThenableParamsObserver): Promise<Viewport | null>;
/**
 * Merge viewport configs from multiple sources (layouts + page).
 * Later entries override earlier ones.
 */
declare const DEFAULT_VIEWPORT: Viewport;
declare function mergeViewport(viewportList: Viewport[]): Viewport;
/**
 * React component that renders viewport meta tags into <head>.
 */
declare function ViewportHead({
  viewport
}: {
  viewport: Viewport;
}): React.JSX.Element;
type Metadata = {
  title?: string | {
    default?: string;
    template?: string;
    absolute?: string;
  };
  description?: string;
  generator?: string;
  applicationName?: string;
  referrer?: string;
  keywords?: string | string[];
  authors?: Array<{
    name?: string;
    url?: string;
  }> | {
    name?: string;
    url?: string;
  };
  creator?: string;
  publisher?: string;
  robots?: string | {
    index?: boolean;
    follow?: boolean;
    googleBot?: string | {
      index?: boolean;
      follow?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  openGraph?: {
    title?: string;
    description?: string;
    url?: string | URL;
    siteName?: string;
    images?: string | URL | SocialImageDescriptor | Array<string | URL | SocialImageDescriptor>;
    videos?: Array<{
      url: string | URL;
      width?: number;
      height?: number;
    }>;
    audio?: Array<{
      url: string | URL;
    }>;
    locale?: string;
    type?: string;
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
  };
  twitter?: {
    card?: string;
    site?: string;
    siteId?: string;
    title?: string;
    description?: string;
    images?: string | URL | SocialImageDescriptor | Array<string | URL | SocialImageDescriptor>;
    creator?: string;
    creatorId?: string;
    players?: TwitterPlayerDescriptor | TwitterPlayerDescriptor[];
    app?: TwitterAppDescriptor;
  };
  icons?: IconsMetadata;
  manifest?: string | URL;
  alternates?: {
    canonical?: string | URL;
    languages?: Record<string, string | URL>;
    media?: Record<string, string | URL>;
    types?: Record<string, string | URL>;
  };
  verification?: {
    google?: string;
    yahoo?: string;
    yandex?: string;
    other?: Record<string, string | string[]>;
  };
  metadataBase?: URL | null;
  appleWebApp?: {
    capable?: boolean;
    title?: string;
    statusBarStyle?: string;
    startupImage?: string | Array<{
      url: string;
      media?: string;
    }>;
  };
  formatDetection?: {
    email?: boolean;
    address?: boolean;
    telephone?: boolean;
  };
  category?: string;
  itunes?: {
    appId: string;
    appArgument?: string;
  };
  appLinks?: {
    ios?: AppLinksApple | AppLinksApple[];
    iphone?: AppLinksApple | AppLinksApple[];
    ipad?: AppLinksApple | AppLinksApple[];
    android?: AppLinksAndroid | AppLinksAndroid[];
    windows_phone?: AppLinksWindows | AppLinksWindows[];
    windows?: AppLinksWindows | AppLinksWindows[];
    windows_universal?: AppLinksWindows | AppLinksWindows[];
    web?: AppLinksWeb | AppLinksWeb[];
  };
  other?: Record<string, string | string[]>;
  [key: string]: unknown;
};
type AppLinksApple = {
  url: string | URL;
  app_store_id?: string | number;
  app_name?: string;
};
type AppLinksAndroid = {
  package: string;
  url?: string | URL;
  class?: string;
  app_name?: string;
};
type AppLinksWindows = {
  url: string | URL;
  app_id?: string;
  app_name?: string;
};
type AppLinksWeb = {
  url: string | URL;
  should_fallback?: boolean;
};
type TwitterPlayerDescriptor = {
  playerUrl: string | URL;
  streamUrl: string | URL;
  width: number;
  height: number;
};
type TwitterAppDescriptor = {
  id: {
    iphone?: string | number;
    ipad?: string | number;
    googleplay?: string;
  };
  url?: {
    iphone?: string | URL;
    ipad?: string | URL;
    googleplay?: string | URL;
  };
  name?: string;
};
type SocialImageDescriptor = {
  url: string | URL;
  alt?: string;
  width?: number;
  height?: number;
  type?: string;
};
type IconDescriptor = {
  url: string | URL;
  sizes?: string;
  type?: string;
  media?: string;
};
type AppleIconDescriptor = {
  url: string | URL;
  sizes?: string;
  type?: string;
};
type IconInput = string | URL | IconDescriptor;
type AppleIconInput = string | URL | AppleIconDescriptor;
type OtherIconDescriptor = {
  rel: string;
  url: string | URL;
  sizes?: string;
  type?: string;
};
type IconsMap = {
  icon?: IconInput | IconInput[];
  shortcut?: string | URL | Array<string | URL>;
  apple?: AppleIconInput | AppleIconInput[];
  other?: OtherIconDescriptor | OtherIconDescriptor[];
};
type IconsMetadata = IconInput | IconInput[] | IconsMap;
type MetadataMergeEntry = {
  contributesTitle?: boolean;
  isPage?: boolean;
  metadata: Metadata;
};
/**
 * Merge metadata from multiple sources (layouts + page).
 *
 * The list is ordered [rootLayout, nestedLayout, ..., page].
 * Title template from layouts applies to the page title but NOT to
 * the segment that defines the template itself. `title.absolute`
 * skips all templates. `title.default` is the fallback when no
 * child provides a title.
 *
 * Shallow merge: later entries override earlier ones (per Next.js docs).
 */
declare function mergeMetadata(metadataList: Metadata[]): Metadata;
/**
 * Post-process merged metadata to cross-fill openGraph and Twitter fields.
 *
 * Next.js runs this once after all layouts/pages and file-based metadata
 * have been resolved. When openGraph exists, it auto-fills missing
 * twitter:title/description/images from openGraph (falling back to root
 * metadata title/description). Existing openGraph/twitter objects also inherit
 * missing title/description from root metadata.
 *
 * Ported from Next.js:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/lib/metadata/resolve-metadata.ts
 */
declare function postProcessMetadata(merged: Metadata): Metadata;
/**
 * Merge metadata from multiple sources (layouts + page).
 *
 * The list is ordered [rootLayout, nestedLayout, ..., page].
 * Title template from layouts applies to the page title but NOT to
 * the segment that defines the template itself. `title.absolute`
 * skips all templates. `title.default` is the fallback when no
 * child provides a title.
 *
 * For top-level keys, later entries override earlier ones. `other` custom meta
 * tags are the exception: Next.js merges those across segments.
 */
declare function mergeMetadataEntries(entries: readonly MetadataMergeEntry[]): Metadata;
/**
 * Resolve metadata from a module. Handles both static `metadata` export
 * and async `generateMetadata()` function.
 *
 * @param parent - A Promise that resolves to the accumulated (merged) metadata
 *   from all ancestor segments. Passed as the second argument to
 *   `generateMetadata()`, matching Next.js's eager-execution-with-serial-
 *   resolution approach. If not provided, defaults to a promise that resolves
 *   to an empty object (so `await parent` never throws).
 */
declare function resolveModuleMetadata(mod: Record<string, unknown>, params?: Record<string, string | string[]>, searchParams?: Record<string, string | string[]>, parent?: Promise<Metadata>, searchParamsObserver?: ThenableParamsObserver): Promise<Metadata | null>;
type MetadataHeadProps = {
  metadata: Metadata;
  pathname?: string;
  trailingSlash?: boolean;
};
declare function renderMetadataToHtml(metadata: Metadata, pathname?: string, options?: {
  trailingSlash?: boolean;
}): string;
declare function MetadataHead({
  metadata,
  pathname,
  trailingSlash
}: MetadataHeadProps): React.JSX.Element;
//#endregion
export { DEFAULT_VIEWPORT, Metadata, MetadataHead, MetadataMergeEntry, Viewport, ViewportHead, mergeMetadata, mergeMetadataEntries, mergeViewport, postProcessMetadata, renderMetadataToHtml, resolveModuleMetadata, resolveModuleViewport };