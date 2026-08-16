import {
  camelizeProps
} from "../chunk-VTEFGNYT.mjs";

// src/base/image.tsx
import {
  transformBaseImageProps
} from "@unpic/core/base";
import { jsx } from "react/jsx-runtime";
function Image({
  transformer,
  ...props
}) {
  const camelizedProps = camelizeProps(
    transformBaseImageProps({
      transformer,
      ...props
    })
  );
  return /* @__PURE__ */ jsx("img", { ...camelizedProps });
}

// src/base/source.tsx
import {
  transformBaseSourceProps
} from "@unpic/core/base";
import { jsx as jsx2 } from "react/jsx-runtime";
function Source(props) {
  const camelizedProps = camelizeProps(transformBaseSourceProps(props));
  return /* @__PURE__ */ jsx2("source", { ...camelizedProps });
}
export {
  Image,
  Source
};
