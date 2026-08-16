//#region src/utils/sorted-array.d.ts
type SortedStringPosition = Readonly<{
  found: boolean;
  index: number;
}>;
declare function findSortedStringPosition(values: readonly string[], candidate: string): SortedStringPosition;
//#endregion
export { findSortedStringPosition };