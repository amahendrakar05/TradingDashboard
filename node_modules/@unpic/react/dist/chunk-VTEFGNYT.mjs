// src/camelize.ts
import * as React from "react";
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

export {
  camelizeProps
};
