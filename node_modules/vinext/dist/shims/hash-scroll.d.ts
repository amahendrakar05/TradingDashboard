//#region src/shims/hash-scroll.d.ts
declare function decodeHashFragment(fragment: string): string;
declare function scrollToHashTarget(hash: string): void;
declare function scrollToHashTargetOnNextFrame(hash: string): void;
declare function retryScrollTo(x: number, y: number, opts?: {
  minFrames?: number;
  shouldContinue?: () => boolean;
}): void;
//#endregion
export { decodeHashFragment, retryScrollTo, scrollToHashTarget, scrollToHashTargetOnNextFrame };