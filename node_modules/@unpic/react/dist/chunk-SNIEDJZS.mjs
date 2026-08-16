import {
  camelizeProps
} from "./chunk-VTEFGNYT.mjs";

// src/image.tsx
import * as React from "react";
import { transformProps } from "@unpic/core";
import { jsx } from "react/jsx-runtime";
var Image = React.forwardRef(
  function Image2(props, ref) {
    const camelizedProps = camelizeProps(
      transformProps(props)
    );
    return /* @__PURE__ */ jsx("img", { ...camelizedProps, ref });
  }
);

// src/source.tsx
import * as React2 from "react";
import { transformSourceProps } from "@unpic/core";
import { jsx as jsx2 } from "react/jsx-runtime";
var Source = React2.forwardRef(
  function Source2(props, ref) {
    const camelizedProps = camelizeProps(
      transformSourceProps(
        props
      )
    );
    return /* @__PURE__ */ jsx2("source", { ...camelizedProps, ref });
  }
);

export {
  Image,
  Source
};
