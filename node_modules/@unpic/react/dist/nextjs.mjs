import {
  getProviderForUrl
} from "./chunk-3I4S5HH6.mjs";
import {
  Image
} from "./chunk-SNIEDJZS.mjs";
import "./chunk-VTEFGNYT.mjs";

// src/nextjs.tsx
import { forwardRef, useMemo } from "react";
import {
  imageConfigDefault
} from "next/dist/shared/lib/image-config.js";
import { jsx } from "react/jsx-runtime";
var configEnv = process.env.__NEXT_IMAGE_OPTS;
function getImageData(src) {
  if (typeof src === "string") {
    return;
  }
  if ("default" in src) {
    return src.default;
  }
  return src;
}
var Image2 = forwardRef(
  function Image3(props, ref) {
    const config = configEnv || imageConfigDefault;
    const breakpoints = useMemo(() => {
      return [...config.deviceSizes, ...config.imageSizes];
    }, [config]);
    const { src: origSrc, ...rest } = props;
    const childProps = rest;
    const imageData = getImageData(origSrc);
    const src = imageData?.src || origSrc;
    if (imageData && props.layout !== "fullWidth") {
      if (!childProps.width) {
        if (childProps.height) {
          childProps.width = childProps.aspectRatio ? childProps.height * childProps.aspectRatio : childProps.height * (imageData.width / imageData.height);
        } else {
          childProps.width = imageData.width;
        }
      }
      if (!childProps.height) {
        if (childProps.width) {
          childProps.height = childProps.aspectRatio ? childProps.width / childProps.aspectRatio : childProps.width * (imageData.height / imageData.width);
        } else {
          childProps.height = imageData.height;
        }
      }
    }
    childProps.background ||= imageData?.blurDataURL;
    const cdn = useMemo(() => {
      if (src?.startsWith("/")) {
        return "nextjs";
      }
      return getProviderForUrl(src);
    }, [src]);
    const isRemoteCdn = cdn && cdn !== "nextjs" && cdn !== "vercel";
    if (isRemoteCdn) {
      return /* @__PURE__ */ jsx(Image, { ...childProps, src, ref, fallback: "nextjs" });
    }
    return /* @__PURE__ */ jsx(
      Image,
      {
        ...childProps,
        src,
        ref,
        breakpoints,
        cdn: "nextjs"
      }
    );
  }
);
export {
  Image2 as Image
};
