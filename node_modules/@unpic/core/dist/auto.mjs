import {
  DEFAULT_RESOLUTIONS,
  getBreakpoints,
  getSizes,
  getSrcSet,
  getSrcSetEntries,
  getStyle,
  inferImageDimensions,
  normalizeImageType,
  transformBaseImageProps,
  transformBaseSourceProps
} from "./chunk-7DG3H6KO.mjs";

// src/auto.ts
import {
  getProviderForUrl,
  getTransformerForCdn
} from "unpic";
function transformProps({
  cdn,
  fallback,
  operations = {},
  options,
  ...props
}) {
  cdn ??= getProviderForUrl(props.src) || fallback;
  if (!cdn) {
    return props;
  }
  const transformer = getTransformerForCdn(cdn);
  if (!transformer) {
    return props;
  }
  return transformBaseImageProps({
    ...props,
    operations: operations?.[cdn],
    options: options?.[cdn],
    transformer
  });
}
function transformSourceProps({
  cdn,
  fallback,
  operations,
  options,
  ...props
}) {
  cdn ??= getProviderForUrl(props.src) || fallback;
  if (!cdn) {
    return props;
  }
  const transformer = getTransformerForCdn(cdn);
  if (!transformer) {
    return props;
  }
  return transformBaseSourceProps({
    ...props,
    operations: operations?.[cdn],
    options: options?.[cdn],
    transformer
  });
}
export {
  DEFAULT_RESOLUTIONS,
  getBreakpoints,
  getSizes,
  getSrcSet,
  getSrcSetEntries,
  getStyle,
  inferImageDimensions,
  normalizeImageType,
  transformProps,
  transformSourceProps
};
