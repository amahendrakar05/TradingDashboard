import { SegmentMap } from "./navigation-context-state.js";
import { ReactNode } from "react";

//#region src/shims/layout-segment-context.d.ts
declare function mergeLayoutSegmentMap(previous: SegmentMap | null, next: SegmentMap): SegmentMap;
/**
 * Wraps children with the layout segment context.
 *
 * Each layout in the App Router tree wraps its children with this provider,
 * passing a map of parallel route key to segment path. The "children" key is
 * always present (the default parallel route). Named parallel slots at this
 * layout level add their own keys.
 *
 * Components inside the provider call useSelectedLayoutSegments(parallelRoutesKey)
 * to read the segments for a specific parallel route.
 */
declare function LayoutSegmentProvider({
  providerId,
  segmentMap,
  children
}: {
  providerId?: string;
  segmentMap: SegmentMap;
  children: ReactNode;
}): string | number | bigint | boolean | import("react").FunctionComponentElement<import("react").ProviderProps<SegmentMap>> | Iterable<ReactNode> | Promise<string | number | bigint | boolean | Iterable<ReactNode> | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | import("react").ReactPortal | null | undefined> | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | null | undefined;
//#endregion
export { LayoutSegmentProvider, mergeLayoutSegmentMap };