import { Alias } from "vite";

//#region src/plugins/og-asset-ownership.d.ts
type OgAssetModuleBoundary = {
  assetRoot: string;
  moduleDir: string;
};
declare class OgAssetOwnership {
  private projectRoot;
  private readonly linkedPackageRoots;
  private readonly dependencyPackageNames;
  private readonly stringAliasesByFirstCharacter;
  private regularExpressionAliases;
  private configuredAliases;
  configure(projectRoot: string, aliases: readonly Alias[]): void;
  reset(): void;
  shouldTrackImport(source: string): boolean;
  recordResolvedImport(source: string, resolvedId: string): Promise<void>;
  resolveModuleBoundary(moduleId: string): Promise<OgAssetModuleBoundary | null>;
  resolveContainedAsset(assetRoot: string, assetPath: string): Promise<string | null>;
  private findAlias;
  private getExpectedPackageName;
  private resolveAliasPackageRoot;
  private resolveConfiguredAliasRoot;
}
//#endregion
export { OgAssetModuleBoundary, OgAssetOwnership };