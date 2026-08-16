import { ReactElement } from "react";
import { ImageResponseOptions, ImageResponseOptions as ImageResponseOptions$1 } from "@vercel/og";

//#region src/shims/og.d.ts
/**
 * next/og shim.
 *
 * The vinext:og-inline-fetch-assets Vite plugin patches @vercel/og's runtime
 * asset fetches so this wrapper can delegate image generation while preserving
 * Next.js's public ImageResponse headers and option merging semantics.
 */
declare class ImageResponse extends Response {
  static displayName: string;
  constructor(element: ReactElement, options?: ImageResponseOptions$1);
}
//#endregion
export { ImageResponse, type ImageResponseOptions };