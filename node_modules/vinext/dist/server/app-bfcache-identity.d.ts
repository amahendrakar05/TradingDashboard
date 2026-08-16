import { AppElements, AppElementsWire } from "./app-elements-wire.js";
import { BfcacheIdMap } from "./app-history-state.js";

//#region src/server/app-bfcache-identity.d.ts
type BfcacheStateKeyMap = Readonly<Record<string, string>>;
type InitialBfcacheMaps = Readonly<{
  bfcacheIds: BfcacheIdMap;
  stateKeys: BfcacheStateKeyMap;
}>;
type AppElementsMetadata = ReturnType<typeof AppElementsWire.readMetadata>;
declare function createInitialBfcacheIdMap(elements: AppElements): BfcacheIdMap;
declare function createBfcacheSegmentStateKeyMap(options: {
  elements: AppElements;
  pathname: string;
}): BfcacheStateKeyMap;
declare function createInitialBfcacheMaps(options: {
  elements: AppElements;
  metadata: AppElementsMetadata;
  pathname: string;
}): InitialBfcacheMaps;
declare function createNextBfcacheIdMap(options: {
  current: BfcacheIdMap;
  currentElements: AppElements;
  currentPathname: string;
  elements: AppElements;
  nextPathname: string;
  restored?: BfcacheIdMap | null;
  reuseCurrent?: boolean;
}): BfcacheIdMap;
declare function preserveBfcacheIdsForMergedElements(options: {
  elements: AppElements;
  next: BfcacheIdMap;
  previous: BfcacheIdMap;
}): BfcacheIdMap;
//#endregion
export { BfcacheStateKeyMap, InitialBfcacheMaps, createBfcacheSegmentStateKeyMap, createInitialBfcacheIdMap, createInitialBfcacheMaps, createNextBfcacheIdMap, preserveBfcacheIdsForMergedElements };