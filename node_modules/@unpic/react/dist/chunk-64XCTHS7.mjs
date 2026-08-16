import {
  getImageCdnForUrl
} from "./chunk-3I4S5HH6.mjs";
import {
  Image
} from "./chunk-SNIEDJZS.mjs";

// src/next-legacy.tsx
import { useContext, forwardRef, useMemo, useEffect } from "react";
import { imageConfigDefault } from "next/dist/shared/lib/image-config.js";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.js";
import { jsx } from "react/jsx-runtime";
var configEnv = process.env.__NEXT_IMAGE_OPTS;
function checkMatchingPatterns(config, src) {
  if (
    // match-remote-pattern doesn't support the edge runtime
    process.env.NEXT_RUNTIME === "edge" || // we don't have access to the image domains/remotePatterns in production
    process.env.NODE_ENV !== "development"
  ) {
    return;
  }
  if (!src?.startsWith("http://") && !src?.startsWith("https://")) {
    return;
  }
  let parsedSrc;
  try {
    parsedSrc = new URL(src);
  } catch (err) {
    console.error(err);
    return;
  }
  import("next/dist/shared/lib/match-remote-pattern").then((mod) => {
    const hasMatch = mod.hasRemoteMatch ?? mod.hasMatch;
    if (hasMatch && !hasMatch(config.domains, config.remotePatterns, parsedSrc)) {
      throw new Error(
        `[Unpic]: Invalid src (${src}). Images that aren't on a supported image CDN must be configured under images in your \`next.config.js\`
See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host`
      );
    }
  });
}
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
    const configContext = useContext(ImageConfigContext);
    const config = configEnv || configContext || imageConfigDefault;
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
      return getImageCdnForUrl(src);
    }, [src]);
    const isRemoteCdn = cdn && cdn !== "nextjs" && cdn !== "vercel";
    useEffect(() => {
      if (!src || !config || isRemoteCdn) {
        return;
      }
      checkMatchingPatterns(config, src);
    }, [src, isRemoteCdn, config]);
    if (isRemoteCdn) {
      return /* @__PURE__ */ jsx(Image, { ...childProps, src, ref });
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
