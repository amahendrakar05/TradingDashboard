import React from "react";

//#region src/shims/dynamic-preload-chunks.d.ts
declare function DynamicPreloadChunks(props: {
  moduleIds?: readonly string[];
}): React.FunctionComponentElement<React.FragmentProps> | null;
//#endregion
export { DynamicPreloadChunks };