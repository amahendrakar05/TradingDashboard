import { AppElementValue, AppElements, UNMATCHED_SLOT } from "../server/app-elements-wire.js";
import * as React$1 from "react";

//#region src/shims/slot.d.ts
/**
 * Holds resolved AppElements (not a Promise). React 19's use(Promise) during
 * hydration triggers "async Client Component" for native Promises that lack
 * React's internal .status property. Storing resolved values sidesteps this.
 */
declare const ElementsContext: React$1.Context<Readonly<Record<string, AppElementValue>>>;
declare const ChildrenContext: React$1.Context<React$1.ReactNode>;
declare const ParallelSlotsContext: React$1.Context<Readonly<Record<string, React$1.ReactNode>> | null>;
declare const BfcacheStateKeyMapContext: React$1.Context<Readonly<Record<string, string>>>;
type BfcacheSlotEntry = {
  content: React$1.ReactNode;
  elements?: AppElements;
  segmentId?: string;
  stateKey: string;
  stateKeyMap?: Readonly<Record<string, string>>;
};
type MergeElementsOptions = {
  clearAbsentSlots?: boolean;
  preserveAbsentSlots?: boolean;
  preserveElementIds?: readonly string[];
  preservePreviousSlotIds?: readonly string[];
};
declare function updateBfcacheSlotEntryOrder(previousOrder: readonly string[], activeStateKey: string, maxEntries?: number): string[];
declare function mergeElements(prev: AppElements, next: AppElements, options?: MergeElementsOptions | boolean): AppElements;
declare function Slot({
  id,
  children,
  parallelSlots
}: {
  id: string;
  children?: React$1.ReactNode;
  parallelSlots?: Readonly<Record<string, React$1.ReactNode>>;
}): React$1.JSX.Element | null;
declare function Children(): React$1.ReactNode;
declare function ParallelSlot({
  name
}: {
  name: string;
}): string | number | bigint | boolean | Iterable<React$1.ReactNode> | Promise<string | number | bigint | boolean | Iterable<React$1.ReactNode> | React$1.ReactElement<unknown, string | React$1.JSXElementConstructor<any>> | React$1.ReactPortal | null | undefined> | React$1.ReactElement<unknown, string | React$1.JSXElementConstructor<any>> | null;
//#endregion
export { BfcacheSlotEntry, BfcacheStateKeyMapContext, Children, ChildrenContext, ElementsContext, ParallelSlot, ParallelSlotsContext, Slot, UNMATCHED_SLOT, mergeElements, updateBfcacheSlotEntryOrder };