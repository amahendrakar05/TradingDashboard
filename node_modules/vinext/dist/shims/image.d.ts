import React from "react";
import { ImageLoader, ImageProps as ImageProps$1, ImgProps, StaticImageData, StaticImport, StaticRequire } from "@vinext/types/next/upstream/dist/shared/lib/get-img-props";

//#region src/shims/image.d.ts
type ImageLoaderProps = Parameters<ImageLoader>[0];
type ImageProps = ImageProps$1;
/**
 * Build a `/_next/image` optimization URL.
 *
 * In production (Cloudflare Workers), the worker intercepts this path and uses
 * the Images binding to resize/transcode on the fly. In dev, the Vite dev
 * server handles it as a passthrough (serves the original file).
 */
declare function imageOptimizationUrl(src: string, width: number, quality?: number): string;
declare const Image: React.ForwardRefExoticComponent<Omit<React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>, "alt" | "height" | "loading" | "ref" | "src" | "srcSet" | "width"> & {
  src: string | StaticImport;
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  loader?: ImageLoader;
  quality?: number | `${number}`;
  preload?: boolean;
  priority?: boolean;
  loading?: "eager" | "lazy" | undefined;
  placeholder?: import("@vinext/types/next/upstream/dist/shared/lib/get-img-props").PlaceholderValue;
  blurDataURL?: string;
  unoptimized?: boolean;
  overrideSrc?: string;
  onLoadingComplete?: import("@vinext/types/next/upstream/dist/shared/lib/get-img-props").OnLoadingComplete;
  layout?: string;
  objectFit?: string;
  objectPosition?: string;
  lazyBoundary?: string;
  lazyRoot?: string;
} & React.RefAttributes<HTMLImageElement>>;
/**
 * getImageProps — for advanced use cases (picture elements, background images).
 * Returns the props that would be passed to the underlying <img> element.
 */
declare function getImageProps(props: ImageProps): {
  props: ImgProps;
};
//#endregion
export { type ImageLoader, ImageLoaderProps, ImageProps, type StaticImageData, type StaticRequire, Image as default, getImageProps, imageOptimizationUrl };