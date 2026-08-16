import { Readable, Writable } from "node:stream";

//#region src/init-platform.d.ts
type InitPlatform = "cloudflare" | "node";
type InitDataCache = "kv" | "none";
type InitCdnCache = "data-cache" | "workers-cache";
type InitImageOptimization = "cloudflare-images" | "none";
type CloudflareInitOptions = {
  dataCache: InitDataCache;
  cdnCache: InitCdnCache;
  imageOptimization: InitImageOptimization;
  warmCdnCache?: boolean;
};
declare const INIT_PLATFORMS: {
  cloudflare: {
    name: string;
    options: typeof resolveCloudflareInitOptions;
  };
  node: {
    name: string;
    options: () => Promise<undefined>;
  };
};
type PlatformPromptOptions = {
  env?: Record<string, string | undefined>;
  input?: Readable;
  output?: Writable;
  isInteractive?: boolean;
  question?: (prompt: string) => Promise<string>;
};
type ResolvedInitOptions = {
  platform: InitPlatform;
  cloudflare?: CloudflareInitOptions;
  prerender: boolean;
};
declare function isAgentEnvironment(env?: Record<string, string | undefined>): boolean;
declare function parsePlatformArg(args: string[]): InitPlatform | undefined;
declare function parseDataCacheArg(args: string[]): InitDataCache | undefined;
declare function parseCdnCacheArg(args: string[]): InitCdnCache | undefined;
declare function parseImageOptimizationArg(args: string[]): InitImageOptimization | undefined;
declare function parsePrerenderArg(args: string[]): boolean | undefined;
declare function parseWarmCdnCacheArg(args: string[]): boolean | undefined;
declare function resolveInitPlatform(args: string[], options?: PlatformPromptOptions): Promise<InitPlatform>;
declare function resolveInitOptions(args: string[], options?: PlatformPromptOptions): Promise<ResolvedInitOptions>;
declare function resolveInitPrerender(args: string[], options?: PlatformPromptOptions): Promise<boolean>;
declare function resolveInitWarmCdnCache(args: string[], options?: PlatformPromptOptions): Promise<boolean>;
declare function resolveCloudflareInitOptions(args: string[], options?: PlatformPromptOptions): Promise<CloudflareInitOptions>;
//#endregion
export { CloudflareInitOptions, INIT_PLATFORMS, InitCdnCache, InitDataCache, InitImageOptimization, InitPlatform, PlatformPromptOptions, ResolvedInitOptions, isAgentEnvironment, parseCdnCacheArg, parseDataCacheArg, parseImageOptimizationArg, parsePlatformArg, parsePrerenderArg, parseWarmCdnCacheArg, resolveCloudflareInitOptions, resolveInitOptions, resolveInitPlatform, resolveInitPrerender, resolveInitWarmCdnCache };