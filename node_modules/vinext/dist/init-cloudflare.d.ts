import { CloudflareInitOptions } from "./init-platform.js";

//#region src/init-cloudflare.d.ts
type CloudflareProjectInfo = {
  root: string;
  projectName: string;
  isAppRouter: boolean;
  hasISR: boolean;
  hasMDX: boolean;
  nativeModulesToStub: string[];
};
type CloudflarePlatformSetupContext = {
  root: string;
  isAppRouter: boolean;
  existingViteConfigPath?: string;
  prerender?: boolean;
  today?: string;
};
type CloudflarePlatformSetupResult = {
  generatedViteConfig: boolean;
  skippedViteConfig: boolean;
  generatedPlatformFiles: string[];
  nextSteps: string[];
};
declare function validateCloudflarePlatformSetup(context: CloudflarePlatformSetupContext, cloudflare: CloudflareInitOptions): void;
declare function setupCloudflarePlatform(context: CloudflarePlatformSetupContext, cloudflare: CloudflareInitOptions): CloudflarePlatformSetupResult;
declare function generateWranglerConfig(info: CloudflareProjectInfo, options?: CloudflareInitOptions, today?: string): string;
declare function updateWranglerConfigForCloudflare(code: string, options: CloudflareInitOptions): string;
declare function getWranglerImagesBinding(code: string): string;
/** Generate vite.config.ts for App Router */
declare function generateAppRouterViteConfig(info?: CloudflareProjectInfo, options?: CloudflareInitOptions, imagesBinding?: string, prerender?: boolean): string;
/** Generate vite.config.ts for Pages Router */
declare function generatePagesRouterViteConfig(info?: CloudflareProjectInfo, options?: CloudflareInitOptions, imagesBinding?: string, prerender?: boolean): string;
declare function updateViteConfigForCloudflare(filePath: string, code: string, options: {
  isAppRouter: boolean;
  nativeModulesToStub: string[];
  cache?: CloudflareInitOptions;
  imagesBinding?: string;
  prerender?: boolean;
}): string;
declare function usesCommonJsViteConfig(filePath: string, code: string): boolean;
//#endregion
export { CloudflarePlatformSetupContext, CloudflarePlatformSetupResult, CloudflareProjectInfo, generateAppRouterViteConfig, generatePagesRouterViteConfig, generateWranglerConfig, getWranglerImagesBinding, setupCloudflarePlatform, updateViteConfigForCloudflare, updateWranglerConfigForCloudflare, usesCommonJsViteConfig, validateCloudflarePlatformSetup };