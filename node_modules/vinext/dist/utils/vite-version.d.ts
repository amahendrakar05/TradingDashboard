//#region src/utils/vite-version.d.ts
declare function serializeViteDefine(value: unknown): string;
declare function getDepOptimizeNodeEnvOptions(nodeEnvDefine: string): {
  rolldownOptions?: {
    transform: {
      define: Record<string, string>;
    };
    moduleTypes?: Record<string, "jsx">;
  };
};
declare function supportsNativeTypeofWindowFolding(viteVersion: string, bundledRolldownVersion?: string): boolean;
declare function assertSupportedViteVersion(): {
  supportsNativeTypeofWindowFolding: boolean;
};
//#endregion
export { assertSupportedViteVersion, getDepOptimizeNodeEnvOptions, serializeViteDefine, supportsNativeTypeofWindowFolding };