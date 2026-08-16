import {
  Image
} from "./chunk-64XCTHS7.mjs";
import "./chunk-3I4S5HH6.mjs";
import "./chunk-SNIEDJZS.mjs";
import "./chunk-VTEFGNYT.mjs";

// src/next.tsx
import { forwardRef } from "react";
import { jsx } from "react/jsx-runtime";
var warned = false;
var Image2 = forwardRef(
  function Image3(props, ref) {
    if (process.env.NODE_ENV !== "production" && !warned) {
      console.warn(
        `\u26A0\uFE0F Please update your import to "@unpic/react/nextjs" if using next@>=14, or "@unpic/react/next-legacy" if using next@<14`
      );
      warned = true;
    }
    return /* @__PURE__ */ jsx(Image, { ...props, ref });
  }
);
export {
  Image2 as Image
};
