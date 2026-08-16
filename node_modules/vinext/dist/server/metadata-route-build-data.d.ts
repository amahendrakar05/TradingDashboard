import { MetadataFileRoute, MetadataRouteHeadData } from "./metadata-routes.js";

//#region src/server/metadata-route-build-data.d.ts
type MetadataRouteEntrySourceInput = {
  entryData: MetadataRouteEntryData;
  moduleName?: string;
  patternParts?: readonly string[] | null;
};
type MetadataRouteEntryData = {
  type: MetadataFileRoute["type"];
  isDynamic: boolean;
  routePrefix: string;
  routeSegments: readonly string[];
  servedUrl: string;
  contentType: string;
  contentHash: string;
  headData?: MetadataRouteHeadData | null;
  fileDataBase64?: string;
};
declare function createMetadataRouteEntryData(route: MetadataFileRoute): MetadataRouteEntryData;
declare function createMetadataRouteEntrySource(input: MetadataRouteEntrySourceInput): string;
declare function createMetadataRouteEntriesSource(routes: readonly MetadataFileRoute[], moduleNames: ReadonlyMap<string, string>): string[];
//#endregion
export { createMetadataRouteEntriesSource, createMetadataRouteEntryData, createMetadataRouteEntrySource };