import React from "react";
import { ImageLoader, ImageLoaderProps, ImageProps } from "@vinext/types/next/upstream/dist/client/legacy/image";

//#region src/shims/legacy-image.d.ts
declare function LegacyImage(props: ImageProps): React.ReactElement;
//#endregion
export { type ImageLoader, type ImageLoaderProps, type ImageProps, LegacyImage as default };