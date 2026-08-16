import { Ref } from "react";

//#region src/shims/use-merged-ref.d.ts
declare function useMergedRef<TElement>(refA: Ref<TElement>, refB: Ref<TElement>): Ref<TElement>;
//#endregion
export { useMergedRef };