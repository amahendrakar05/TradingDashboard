//#region src/server/metadata-routes.d.ts
type SitemapEntry = {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
  alternates?: {
    languages?: Record<string, string>;
  };
  images?: string[];
  videos?: Array<{
    title: string;
    thumbnail_loc: string;
    description: string;
    content_loc?: string;
    player_loc?: string;
    duration?: number;
    expiration_date?: string | Date;
    rating?: number;
    view_count?: number;
    publication_date?: string | Date;
    family_friendly?: "yes" | "no";
    restriction?: {
      relationship: "allow" | "deny";
      content: string;
    };
    platform?: {
      relationship: "allow" | "deny";
      content: string;
    };
    requires_subscription?: "yes" | "no";
    uploader?: {
      info?: string;
      content?: string;
    };
    live?: "yes" | "no";
    tag?: string;
  }>;
};
type RobotsRule = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
  other?: Record<string, string | number | Array<string | number>>;
};
type RobotsConfig = {
  rules: RobotsRule | RobotsRule[];
  sitemap?: string | string[];
  host?: string;
};
type ManifestConfig = {
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  display?: "fullscreen" | "standalone" | "minimal-ui" | "browser";
  background_color?: string;
  theme_color?: string;
  icons?: Array<{
    src: string;
    sizes?: string;
    type?: string;
    purpose?: string;
  }>;
  [key: string]: unknown;
};
/** Map of metadata file base names to their URL path and content type. */
declare const METADATA_FILE_MAP: Record<string, {
  /** URL path this file is served at */urlPath: string; /** Content type for the response */
  contentType: string; /** Whether this can be dynamic (.ts/.tsx/.js) */
  canBeDynamic: boolean; /** File extensions for static variants */
  staticExtensions: string[]; /** File extensions for dynamic variants */
  dynamicExtensions: string[]; /** Whether this can be nested in sub-segments */
  nestable: boolean;
}>;
/**
 * Convert a sitemap array to XML string.
 */
declare function sitemapToXml(entries: SitemapEntry[]): string;
/**
 * Convert a robots config to text format.
 */
declare function robotsToText(config: RobotsConfig): string;
/**
 * Convert a manifest config to JSON string.
 */
declare function manifestToJson(config: ManifestConfig): string;
/**
 * Compute the static URL for a metadata file given its app directory
 * parent path and filename.
 *
 * Example:
 *   fillStaticMetadataSegment("/", "favicon.ico") -> "/favicon.ico"
 *   fillStaticMetadataSegment("/blog/[slug]", "favicon.ico") -> "/blog/-/favicon.ico"
 *   fillStaticMetadataSegment("/(group)/group", "icon.png") -> "/group/icon-131tc6.png"
 */
declare function fillStaticMetadataSegment(appDirPath: string, lastSegment: string): string;
type MetadataFileRoute = {
  /** Type of metadata file */type: string; /** Whether this is a dynamic (code-generated) route */
  isDynamic: boolean; /** Imported dynamic module for code-generated metadata routes. */
  module?: Record<string, unknown>; /** Absolute file path */
  filePath: string; /** Route prefix where this metadata applies, preserving dynamic segment names. */
  routePrefix: string; /** Raw app tree segments where this metadata file is colocated. */
  routeSegments?: string[]; /** Pattern parts for matching dynamic metadata routes at request time. */
  patternParts?: string[]; /** URL path this file is served at */
  servedUrl: string; /** Content type for the response */
  contentType: string; /** Optional metadata used to inject file-based routes into <head>. */
  headData?: MetadataRouteHeadData; /** Optional content hash for cache-busting metadata links. */
  contentHash?: string; /** Sibling .alt.txt file for static social image metadata routes. */
  altFilePath?: string;
};
type MetadataRouteHeadData = {
  kind: "favicon" | "icon" | "apple";
  href: string;
  type?: string;
  sizes?: string;
} | {
  kind: "openGraph" | "twitter";
  href: string;
  type?: string;
  width?: number;
  height?: number;
  alt?: string;
} | {
  kind: "manifest";
  href: string;
};
declare function getMetadataRouteKind(route: Pick<MetadataFileRoute, "type">): MetadataRouteHeadData["kind"] | null;
declare function getMetadataImageRouteKind(route: Pick<MetadataFileRoute, "type">): Extract<MetadataRouteHeadData["kind"], "icon" | "apple" | "openGraph" | "twitter"> | null;
declare function isValidMetadataImageId(id: string): boolean;
declare function matchMetadataRoutePattern(urlParts: string[], patternParts: string[]): Record<string, string | string[]> | null;
declare function matchMetadataFileBaseName(metaType: string, baseName: string): string | null;
/** Clear the {@link scanMetadataFiles} cache (call when app files change in dev). */
declare function invalidateMetadataFileCache(): void;
/**
 * Scan an app directory for metadata files.
 */
declare function scanMetadataFiles(appDir: string): MetadataFileRoute[];
//#endregion
export { METADATA_FILE_MAP, ManifestConfig, MetadataFileRoute, MetadataRouteHeadData, RobotsConfig, SitemapEntry, fillStaticMetadataSegment, getMetadataImageRouteKind, getMetadataRouteKind, invalidateMetadataFileCache, isValidMetadataImageId, manifestToJson, matchMetadataFileBaseName, matchMetadataRoutePattern, robotsToText, scanMetadataFiles, sitemapToXml };