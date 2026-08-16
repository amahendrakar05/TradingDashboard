"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Image: () => Image,
  Source: () => Source
});
module.exports = __toCommonJS(src_exports);

// src/image.tsx
var React2 = __toESM(require("react"));
var import_core = require("@unpic/core");

// src/camelize.ts
var React = __toESM(require("react"));
var nestedKeys = /* @__PURE__ */ new Set(["style"]);
var isNewReact = "use" in React;
var fixedMap = {
  srcset: "srcSet",
  fetchpriority: isNewReact ? "fetchPriority" : "fetchpriority"
};
var camelize = (key) => {
  if (key.startsWith("data-") || key.startsWith("aria-")) {
    return key;
  }
  return fixedMap[key] || key.replace(/-./g, (suffix) => suffix[1].toUpperCase());
};
function camelizeProps(props) {
  return Object.fromEntries(
    Object.entries(props).map(([k, v]) => [
      camelize(k),
      nestedKeys.has(k) && v && typeof v !== "string" ? camelizeProps(v) : v
    ])
  );
}

// src/image.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var Image = React2.forwardRef(
  function Image2(props, ref) {
    const camelizedProps = camelizeProps(
      (0, import_core.transformProps)(props)
    );
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", { ...camelizedProps, ref });
  }
);

// src/source.tsx
var React3 = __toESM(require("react"));
var import_core2 = require("@unpic/core");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Source = React3.forwardRef(
  function Source2(props, ref) {
    const camelizedProps = camelizeProps(
      (0, import_core2.transformSourceProps)(
        props
      )
    );
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("source", { ...camelizedProps, ref });
  }
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Image,
  Source
});
