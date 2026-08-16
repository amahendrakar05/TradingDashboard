import { RenderObservation } from "../server/cache-proof.js";

//#region src/shims/cache-handler.d.ts
type CacheHandlerValue = {
  lastModified: number;
  age?: number;
  cacheState?: string;
  cacheControl?: CacheControlMetadata;
  value: IncrementalCacheValue | null;
};
type CacheControlMetadata = {
  revalidate: number;
  expire?: number;
};
type IncrementalCacheValue = CachedFetchValue | CachedAppPageValue | CachedPagesValue | CachedRouteValue | CachedRedirectValue | CachedImageValue;
type CachedFetchValue = {
  kind: "FETCH";
  data: {
    headers: Record<string, string>;
    body: string;
    url: string;
    status?: number;
  };
  tags?: string[];
  revalidate: number | false;
};
type CachedAppPageValue = {
  kind: "APP_PAGE";
  html: string;
  rscData: ArrayBuffer | undefined;
  headers: Record<string, string | string[]> | undefined;
  postponed: string | undefined;
  renderObservation?: RenderObservation;
  status: number | undefined;
};
type CachedPagesValue = {
  kind: "PAGES";
  html: string;
  pageData: object;
  generatedFromDataRequest?: boolean;
  headers: Record<string, string | string[]> | undefined;
  status: number | undefined;
};
type CachedRouteValue = {
  kind: "APP_ROUTE";
  body: ArrayBuffer;
  status: number;
  headers: Record<string, string | string[]>;
};
type CachedRedirectValue = {
  kind: "REDIRECT";
  props: object;
};
type CachedImageValue = {
  kind: "IMAGE";
  etag: string;
  buffer: ArrayBuffer;
  extension: string;
  revalidate?: number;
};
type CacheHandlerContext = {
  dev?: boolean;
  maxMemoryCacheSize?: number;
  revalidatedTags?: string[];
  [key: string]: unknown;
};
type CacheHandler = {
  get(key: string, ctx?: Record<string, unknown>): Promise<CacheHandlerValue | null>;
  set(key: string, data: IncrementalCacheValue | null, ctx?: Record<string, unknown>): Promise<void>;
  revalidateTag(tags: string | string[], durations?: {
    expire?: number;
  }): Promise<void>;
  resetRequestCache?(): void;
};
declare class NoOpCacheHandler implements CacheHandler {
  get(_key: string, _ctx?: Record<string, unknown>): Promise<CacheHandlerValue | null>;
  set(_key: string, _data: IncrementalCacheValue | null, _ctx?: Record<string, unknown>): Promise<void>;
  revalidateTag(_tags: string | string[], _durations?: {
    expire?: number;
  }): Promise<void>;
}
type MemoryCacheHandlerOptions = Pick<CacheHandlerContext, "maxMemoryCacheSize"> & {
  cacheMaxMemorySize?: number;
};
declare class MemoryCacheHandler implements CacheHandler {
  private store;
  private tagRevalidatedAt;
  private readonly maxMemoryCacheSize;
  private currentMemoryCacheSize;
  constructor(options?: number | MemoryCacheHandlerOptions);
  private estimateEntrySize;
  private deleteEntry;
  private touchEntry;
  private evictLeastRecentlyUsed;
  get(key: string, ctx?: Record<string, unknown>): Promise<CacheHandlerValue | null>;
  set(key: string, data: IncrementalCacheValue | null, ctx?: Record<string, unknown>): Promise<void>;
  revalidateTag(tags: string | string[]): Promise<void>;
  resetRequestCache(): void;
}
declare function configureMemoryCacheHandler(options?: MemoryCacheHandlerOptions): void;
declare function setDataCacheHandler(handler: CacheHandler): void;
declare function getDataCacheHandler(): CacheHandler;
declare function setCacheHandler(handler: CacheHandler): void;
declare function getCacheHandler(): CacheHandler;
//#endregion
export { CacheControlMetadata, CacheHandler, CacheHandlerContext, CacheHandlerValue, CachedAppPageValue, CachedFetchValue, CachedImageValue, CachedPagesValue, CachedRedirectValue, CachedRouteValue, IncrementalCacheValue, MemoryCacheHandler, NoOpCacheHandler, configureMemoryCacheHandler, getCacheHandler, getDataCacheHandler, setCacheHandler, setDataCacheHandler };