import { MetadataFileRoute } from "./metadata-routes.js";
import { Metadata } from "../shims/metadata.js";

//#region src/server/file-based-metadata.d.ts
type AppPageParams = Record<string, string | string[]>;
type FileBasedMetadataSource = {
  routeSegments: readonly string[];
  metadata: Metadata | null;
};
type FileBasedMetadataOptions = {
  routeSegments?: readonly string[] | null;
  metadataSources?: readonly FileBasedMetadataSource[] | null;
  /**
   * The configured next.config `basePath`, prefixed to all file-based
   * metadata URLs emitted in the page <head> (icons, opengraph-image,
   * twitter-image, manifest, apple-icon, favicon).
   *
   * Mirrors Next.js, which bakes basePath into static metadata route URLs
   * during webpack build and threads it through the dynamic image loader's
   * `pathnamePrefix = normalizePathSep(path.join(basePath, segment))`.
   *
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack/loaders/next-metadata-image-loader.ts#L63
   * @see https://github.com/vercel/next.js/blob/canary/packages/next/src/build/webpack/loaders/metadata/discover.ts#L88
   */
  basePath?: string;
};
declare function applyFileBasedMetadata(metadata: Metadata | null, routePath: string, params: AppPageParams, metadataRoutes: readonly MetadataFileRoute[] | null | undefined, options?: FileBasedMetadataOptions): Promise<Metadata | null>;
//#endregion
export { applyFileBasedMetadata };