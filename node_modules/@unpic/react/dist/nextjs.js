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

// src/nextjs.tsx
var nextjs_exports = {};
__export(nextjs_exports, {
  Image: () => Image3
});
module.exports = __toCommonJS(nextjs_exports);
var import_react = require("react");

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

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/data/domains.js
var domains_default = {
  "images.ctfassets.net": "contentful",
  "cdn.builder.io": "builder.io",
  "images.prismic.io": "imgix",
  "www.datocms-assets.com": "imgix",
  "cdn.sanity.io": "imgix",
  "images.unsplash.com": "imgix",
  "cdn.shopify.com": "shopify",
  "s7d1.scene7.com": "scene7",
  "ip.keycdn.com": "keycdn",
  "assets.caisy.io": "bunny",
  "images.contentstack.io": "contentstack",
  "ucarecdn.com": "uploadcare",
  "imagedelivery.net": "cloudflare_images",
  "wsrv.nl": "wsrv"
};

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/data/subdomains.js
var subdomains_default = {
  "imgix.net": "imgix",
  "wp.com": "wordpress",
  "files.wordpress.com": "wordpress",
  "b-cdn.net": "bunny",
  "storyblok.com": "storyblok",
  "kc-usercontent.com": "kontent.ai",
  "cloudinary.com": "cloudinary",
  "kxcdn.com": "keycdn",
  "imgeng.in": "imageengine",
  "imagekit.io": "imagekit",
  "cloudimg.io": "cloudimage",
  "ucarecdn.com": "uploadcare",
  "supabase.co": "supabase",
  "graphassets.com": "hygraph"
};

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/data/paths.js
var paths_default = {
  "/cdn-cgi/image/": "cloudflare",
  "/cdn-cgi/imagedelivery/": "cloudflare_images",
  "/_next/image": "nextjs",
  "/_vercel/image": "vercel",
  "/is/image": "scene7",
  "/_ipx/": "ipx",
  "/_image": "astro",
  "/.netlify/images": "netlify",
  "/storage/v1/object/public/": "supabase",
  "/storage/v1/render/image/public/": "supabase",
  "/v1/storage/buckets/": "appwrite"
};

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/utils.js
function roundIfNumeric(value) {
  if (!value) {
    return value;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return value;
  }
  return Math.round(num);
}
var toRelativeUrl = (url) => {
  const { pathname, search } = url;
  return `${pathname}${search}`;
};
var toCanonicalUrlString = (url) => {
  return url.hostname === "n" ? toRelativeUrl(url) : url.toString();
};
var toUrl = (url, base) => {
  return typeof url === "string" ? new URL(url, base ?? "http://n/") : url;
};
var escapeChar = (text) => text === " " ? "+" : "%" + text.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
var stripLeadingSlash = (str) => str?.startsWith("/") ? str.slice(1) : str;
var stripTrailingSlash = (str) => str?.endsWith("/") ? str.slice(0, -1) : str;
var addTrailingSlash = (str) => str?.endsWith("/") ? str : `${str}/`;
var createFormatter = (kvSeparator, paramSeparator) => {
  const encodedValueJoiner = escapeChar(kvSeparator);
  const encodedOperationJoiner = escapeChar(paramSeparator);
  function escape(value) {
    return encodeURIComponent(value).replaceAll(kvSeparator, encodedValueJoiner).replaceAll(paramSeparator, encodedOperationJoiner);
  }
  function format(key, value) {
    return `${escape(key)}${kvSeparator}${escape(String(value))}`;
  }
  return (operations) => {
    const ops = Array.isArray(operations) ? operations : Object.entries(operations);
    return ops.flatMap(([key, value]) => {
      if (value === void 0 || value === null) {
        return [];
      }
      if (Array.isArray(value)) {
        return value.map((v) => format(key, v));
      }
      return format(key, value);
    }).join(paramSeparator);
  };
};
var createParser = (kvSeparator, paramSeparator) => {
  if (kvSeparator === "=" && paramSeparator === "&") {
    return queryParser;
  }
  return (url) => {
    const urlString = url.toString();
    return Object.fromEntries(urlString.split(paramSeparator).map((pair) => {
      const [key, value] = pair.split(kvSeparator);
      return [decodeURI(key), decodeURI(value)];
    }));
  };
};
function extractFromURL(url) {
  const parsedUrl = toUrl(url);
  const operations = Object.fromEntries(parsedUrl.searchParams.entries());
  for (const key in ["width", "height", "quality"]) {
    const value = operations[key];
    if (value) {
      const newVal = Number(value);
      if (!isNaN(newVal)) {
        operations[key] = newVal;
      }
    }
  }
  parsedUrl.search = "";
  return {
    operations,
    src: toCanonicalUrlString(parsedUrl)
  };
}
function normaliseOperations({ keyMap = {}, formatMap = {}, defaults = {} }, operations) {
  if (operations.format && operations.format in formatMap) {
    operations.format = formatMap[operations.format];
  }
  if (operations.width) {
    operations.width = roundIfNumeric(operations.width);
  }
  if (operations.height) {
    operations.height = roundIfNumeric(operations.height);
  }
  for (const k in keyMap) {
    if (!Object.prototype.hasOwnProperty.call(keyMap, k)) {
      continue;
    }
    const key = k;
    if (keyMap[key] === false) {
      delete operations[key];
      continue;
    }
    if (keyMap[key] && operations[key]) {
      operations[keyMap[key]] = operations[key];
      delete operations[key];
    }
  }
  for (const k in defaults) {
    if (!Object.prototype.hasOwnProperty.call(defaults, k)) {
      continue;
    }
    const key = k;
    const value = defaults[key];
    if (!operations[key] && value !== void 0) {
      if (keyMap[key] === false) {
        continue;
      }
      const resolvedKey = keyMap[key] ?? key;
      if (resolvedKey in operations) {
        continue;
      }
      operations[resolvedKey] = value;
    }
  }
  return operations;
}
var invertMap = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
function denormaliseOperations({ keyMap = {}, formatMap = {}, defaults = {} }, operations) {
  const invertedKeyMap = invertMap(keyMap);
  const invertedFormatMap = invertMap(formatMap);
  const ops = normaliseOperations({
    keyMap: invertedKeyMap,
    formatMap: invertedFormatMap,
    defaults
  }, operations);
  if (ops.width) {
    ops.width = roundIfNumeric(ops.width);
  }
  if (ops.height) {
    ops.height = roundIfNumeric(ops.height);
  }
  const q = Number(ops.quality);
  if (!isNaN(q)) {
    ops.quality = q;
  }
  return ops;
}
var queryParser = (url) => {
  const parsedUrl = toUrl(url);
  return Object.fromEntries(parsedUrl.searchParams.entries());
};
function createOperationsGenerator({ kvSeparator = "=", paramSeparator = "&", ...options } = {}) {
  const formatter = createFormatter(kvSeparator, paramSeparator);
  return (operations) => {
    const normalisedOperations = normaliseOperations(options, operations);
    return formatter(normalisedOperations);
  };
}
function createOperationsParser({ kvSeparator = "=", paramSeparator = "&", defaults: _, ...options } = {}) {
  const parser = createParser(kvSeparator, paramSeparator);
  return (url) => {
    const operations = url ? parser(url) : {};
    return denormaliseOperations(options, operations);
  };
}
function createOperationsHandlers(config) {
  const operationsGenerator27 = createOperationsGenerator(config);
  const operationsParser22 = createOperationsParser(config);
  return { operationsGenerator: operationsGenerator27, operationsParser: operationsParser22 };
}
function paramToBoolean(value) {
  if (value === void 0 || value === null) {
    return void 0;
  }
  try {
    return Boolean(JSON.parse(value?.toString()));
  } catch {
    return Boolean(value);
  }
}
var removeUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== void 0));
function createExtractAndGenerate(extract29, generate25) {
  return (src, operations, options) => {
    const base = extract29(src, options);
    if (!base) {
      return generate25(src, operations, options);
    }
    return generate25(base.src, {
      ...base.operations,
      ...removeUndefined(operations)
    }, {
      // deno-lint-ignore no-explicit-any
      ...base.options,
      ...options
    });
  };
}

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/detect.js
var cdnDomains = new Map(Object.entries(domains_default));
var cdnSubdomains = Object.entries(subdomains_default);
var cdnPaths = Object.entries(paths_default);
function getProviderForUrl(url) {
  return getProviderForUrlByDomain(url) || getProviderForUrlByPath(url);
}
function getProviderForUrlByDomain(url) {
  if (typeof url === "string" && !url.startsWith("https://")) {
    return false;
  }
  const { hostname } = toUrl(url);
  const cdn = cdnDomains.get(hostname);
  if (cdn) {
    return cdn;
  }
  return cdnSubdomains.find(([subdomain]) => hostname.endsWith(subdomain))?.[1] || false;
}
function getProviderForUrlByPath(url) {
  const { pathname } = toUrl(url);
  return cdnPaths.find(([path]) => pathname.startsWith(path))?.[1] || false;
}

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/appwrite.js
var VIEW_URL_SUFFIX = "/view?";
var PREVIEW_URL_SUFFIX = "/preview?";
var { operationsGenerator, operationsParser } = createOperationsHandlers({
  keyMap: {
    format: "output"
  },
  kvSeparator: "=",
  paramSeparator: "&"
});
var generate = (src, modifiers) => {
  const url = toUrl(src.toString().replace(VIEW_URL_SUFFIX, PREVIEW_URL_SUFFIX));
  const projectParam = url.searchParams.get("project") ?? "";
  const operations = operationsGenerator(modifiers);
  url.search = operations;
  url.searchParams.append("project", projectParam);
  return toCanonicalUrlString(url);
};
var extract = (url) => {
  if (getProviderForUrlByPath(url) !== "appwrite") {
    return null;
  }
  const parsedUrl = toUrl(url);
  const operations = operationsParser(parsedUrl);
  delete operations.project;
  const projectParam = parsedUrl.searchParams.get("project") ?? "";
  parsedUrl.search = "";
  parsedUrl.searchParams.append("project", projectParam);
  const sourceUrl = parsedUrl.href;
  return {
    src: sourceUrl,
    operations
  };
};
var transform = createExtractAndGenerate(extract, generate);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/astro.js
var { operationsParser: operationsParser2, operationsGenerator: operationsGenerator2 } = createOperationsHandlers({
  keyMap: {
    format: "f",
    width: "w",
    height: "h",
    quality: "q"
  },
  defaults: {
    fit: "cover"
  }
});

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/builder.io.js
var operationsGenerator3 = createOperationsGenerator({
  defaults: {
    fit: "cover",
    format: "webp",
    sharp: true
  }
});
var extract2 = extractFromURL;
var generate2 = (src, modifiers) => {
  const operations = operationsGenerator3(modifiers);
  const url = toUrl(src);
  url.search = operations;
  return toCanonicalUrlString(url);
};
var transform2 = createExtractAndGenerate(extract2, generate2);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/bunny.js
var operationsGenerator4 = createOperationsGenerator({
  keyMap: {
    format: "output"
  }
});
var extract3 = extractFromURL;
var generate3 = (src, modifiers) => {
  const operations = operationsGenerator4(modifiers);
  const url = toUrl(src);
  url.search = operations;
  return toCanonicalUrlString(url);
};
var extractAndGenerate = createExtractAndGenerate(extract3, generate3);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/cloudflare.js
var { operationsGenerator: operationsGenerator5, operationsParser: operationsParser3 } = createOperationsHandlers({
  keyMap: {
    "format": "f"
  },
  defaults: {
    format: "auto",
    fit: "cover"
  },
  formatMap: {
    jpg: "jpeg"
  },
  kvSeparator: "=",
  paramSeparator: ","
});
var generate4 = (src, operations, options) => {
  const modifiers = operationsGenerator5(operations);
  const url = toUrl(options?.domain ? `https://${options.domain}` : "/");
  url.pathname = `/cdn-cgi/image/${modifiers}/${stripLeadingSlash(src.toString())}`;
  return toCanonicalUrlString(url);
};
var extract4 = (url, options) => {
  if (getProviderForUrlByPath(url) !== "cloudflare") {
    return null;
  }
  const parsedUrl = toUrl(url);
  const [, , , modifiers, ...src] = parsedUrl.pathname.split("/");
  const operations = operationsParser3(modifiers);
  return {
    src: toCanonicalUrlString(toUrl(src.join("/"))),
    operations,
    options: {
      domain: options?.domain ?? (parsedUrl.hostname === "n" ? void 0 : parsedUrl.hostname)
    }
  };
};
var transform3 = createExtractAndGenerate(extract4, generate4);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/cloudflare_images.js
var { operationsGenerator: operationsGenerator6, operationsParser: operationsParser4 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    format: "f"
  },
  defaults: {
    fit: "cover"
  },
  kvSeparator: "=",
  paramSeparator: ","
});

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/cloudimage.js
var { operationsGenerator: operationsGenerator7, operationsParser: operationsParser5 } = createOperationsHandlers({
  keyMap: {
    format: "force_format",
    width: "w",
    height: "h",
    quality: "q"
  },
  defaults: {
    org_if_sml: 1
  }
});
var generate5 = (src, modifiers = {}, { token } = {}) => {
  if (!token) {
    throw new Error("Token is required for Cloudimage URLs" + src);
  }
  let srcString = src.toString();
  srcString = srcString.replace(/^https?:\/\//, "");
  if (srcString.includes("?")) {
    modifiers.ci_url_encoded = 1;
    srcString = encodeURIComponent(srcString);
  }
  const operations = operationsGenerator7(modifiers);
  const url = new URL(`https://${token}.cloudimg.io/`);
  url.pathname = srcString;
  url.search = operations;
  return url.toString();
};
var extract5 = (src, options = {}) => {
  const url = toUrl(src);
  if (getProviderForUrl(url) !== "cloudimage") {
    return null;
  }
  const operations = operationsParser5(url);
  let originalSrc = url.pathname;
  if (operations.ci_url_encoded) {
    originalSrc = decodeURIComponent(originalSrc);
    delete operations.ci_url_encoded;
  }
  options.token ??= url.hostname.replace(".cloudimg.io", "");
  return {
    src: `${url.protocol}/${originalSrc}`,
    operations,
    options
  };
};
var transform4 = createExtractAndGenerate(extract5, generate5);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/cloudinary.js
var { operationsGenerator: operationsGenerator8, operationsParser: operationsParser6 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    format: "f",
    quality: "q"
  },
  defaults: {
    format: "auto",
    c: "lfill"
  },
  kvSeparator: "_",
  paramSeparator: ","
});

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/contentful.js
var operationsGenerator9 = createOperationsGenerator({
  keyMap: {
    format: "fm",
    width: "w",
    height: "h",
    quality: "q"
  },
  defaults: {
    fit: "fill"
  }
});
var generate6 = (src, modifiers) => {
  const operations = operationsGenerator9(modifiers);
  const url = new URL(src);
  url.search = operations;
  return toCanonicalUrlString(url);
};
var extract6 = extractFromURL;
var extractAndGenerate2 = createExtractAndGenerate(extract6, generate6);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/contentstack.js
var operationsGenerator10 = createOperationsGenerator({
  defaults: {
    auto: "webp",
    disable: "upscale"
  }
});
var generate7 = (src, operations, { baseURL = "https://images.contentstack.io/" } = {}) => {
  if (operations.width && operations.height) {
    operations.fit ??= "crop";
  }
  const modifiers = operationsGenerator10(operations);
  const url = toUrl(src);
  if (url.hostname === "n") {
    url.protocol = "https:";
    url.hostname = new URL(baseURL).hostname;
  }
  url.search = modifiers;
  return toCanonicalUrlString(url);
};
var extract7 = (url) => {
  const { src, operations } = extractFromURL(url) ?? {};
  if (!operations || !src) {
    return null;
  }
  const { origin } = toUrl(url);
  return {
    src,
    operations,
    options: {
      baseURL: origin
    }
  };
};
var transform5 = createExtractAndGenerate(extract7, generate7);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/directus.js
var operationsGenerator11 = createOperationsGenerator({
  defaults: {
    withoutEnlargement: true,
    fit: "cover"
  }
});
var generate8 = (src, operations) => {
  if (Array.isArray(operations.transforms)) {
    operations.transforms = JSON.stringify(operations.transforms);
  }
  const modifiers = operationsGenerator11(operations);
  const url = toUrl(src);
  url.search = modifiers;
  return toCanonicalUrlString(url);
};
var extract8 = (url) => {
  const base = extractFromURL(url);
  if (base?.operations?.transforms && typeof base.operations.transforms === "string") {
    try {
      base.operations.transforms = JSON.parse(base.operations.transforms);
    } catch {
      return null;
    }
  }
  return base;
};
var transform6 = createExtractAndGenerate(extract8, generate8);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/hygraph.js
var hygraphRegex = /https:\/\/(?<region>[a-z0-9-]+)\.graphassets\.com\/(?<envId>[a-zA-Z0-9]+)(?:\/(?<transformations>.*?))?\/(?<handle>[a-zA-Z0-9]+)$/;
var { operationsGenerator: operationsGenerator12, operationsParser: operationsParser7 } = createOperationsHandlers({
  keyMap: {
    width: "width",
    height: "height",
    format: "format"
  },
  defaults: {
    format: "auto",
    fit: "crop"
  }
});
var extract9 = (url) => {
  const parsedUrl = toUrl(url);
  const matches = parsedUrl.toString().match(hygraphRegex);
  if (!matches?.groups) {
    return null;
  }
  const { region, envId, handle, transformations } = matches.groups;
  const operations = {};
  if (transformations) {
    const parts = transformations.split("/");
    parts.forEach((part) => {
      const [operation, params] = part.split("=");
      if (operation === "resize" && params) {
        params.split(",").forEach((param) => {
          const [key, value] = param.split(":");
          if (key === "width" || key === "height") {
            operations[key] = Number(value);
          } else if (key === "fit") {
            operations.fit = value;
          }
        });
      } else if (operation === "output" && params) {
        params.split(",").forEach((param) => {
          const [key, value] = param.split(":");
          if (key === "format") {
            operations.format = value;
          }
        });
      } else if (operation === "auto_image") {
        operations.format = "auto";
      }
    });
  }
  return {
    src: `https://${region}.graphassets.com/${envId}/${handle}`,
    operations,
    options: {
      region,
      envId,
      handle
    }
  };
};
var generate9 = (src, operations, options = {}) => {
  const extracted = extract9(src);
  if (!extracted) {
    throw new Error("Invalid Hygraph URL");
  }
  const { region, envId, handle } = {
    ...extracted.options,
    ...options
  };
  const transforms = [];
  if (operations.width || operations.height) {
    const resize = [];
    if (operations.width && operations.height) {
      resize.push("fit:crop");
    } else if (operations.fit) {
      resize.push(`fit:${operations.fit}`);
    }
    if (operations.width)
      resize.push(`width:${operations.width}`);
    if (operations.height)
      resize.push(`height:${operations.height}`);
    if (resize.length)
      transforms.push(`resize=${resize.join(",")}`);
  }
  if (operations.format === "auto" || !operations.format && !extracted.operations.format) {
    transforms.push("auto_image");
  } else if (operations.format) {
    transforms.push(`output=format:${operations.format}`);
  }
  const baseUrl = `https://${region}.graphassets.com/${envId}`;
  const transformPart = transforms.length > 0 ? "/" + transforms.join("/") : "";
  const finalUrl = toUrl(`${baseUrl}${transformPart}/${handle}`);
  return toCanonicalUrlString(finalUrl);
};
var transform7 = createExtractAndGenerate(extract9, generate9);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/imageengine.js
var { operationsGenerator: operationsGenerator13, operationsParser: operationsParser8 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    format: "f"
  },
  defaults: {
    m: "cropbox"
  },
  kvSeparator: "_",
  paramSeparator: "/"
});
var generate10 = (src, operations) => {
  const modifiers = operationsGenerator13(operations);
  const url = toUrl(src);
  url.searchParams.set("imgeng", modifiers);
  return toCanonicalUrlString(url);
};
var extract10 = (url) => {
  const parsedUrl = toUrl(url);
  const imgeng = parsedUrl.searchParams.get("imgeng");
  if (!imgeng) {
    return null;
  }
  const operations = operationsParser8(imgeng);
  parsedUrl.searchParams.delete("imgeng");
  return {
    src: toCanonicalUrlString(parsedUrl),
    operations
  };
};
var transform8 = createExtractAndGenerate(extract10, generate10);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/imagekit.js
var { operationsGenerator: operationsGenerator14, operationsParser: operationsParser9 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    format: "f",
    quality: "q"
  },
  defaults: {
    c: "maintain_ratio",
    fo: "auto"
  },
  kvSeparator: "-",
  paramSeparator: ","
});
var generate11 = (src, operations) => {
  const modifiers = operationsGenerator14(operations);
  const url = toUrl(src);
  url.searchParams.set("tr", modifiers);
  return toCanonicalUrlString(url);
};
var extract11 = (url) => {
  const parsedUrl = toUrl(url);
  let trPart = null;
  let path = parsedUrl.pathname;
  if (parsedUrl.searchParams.has("tr")) {
    trPart = parsedUrl.searchParams.get("tr");
    parsedUrl.searchParams.delete("tr");
  } else {
    const pathParts = parsedUrl.pathname.split("/");
    const trIndex = pathParts.findIndex((part) => part.startsWith("tr:"));
    if (trIndex !== -1) {
      trPart = pathParts[trIndex].slice(3);
      path = pathParts.slice(0, trIndex).concat(pathParts.slice(trIndex + 1)).join("/");
    }
  }
  if (!trPart) {
    return null;
  }
  parsedUrl.pathname = path;
  const operations = operationsParser9(trPart);
  return {
    src: toCanonicalUrlString(parsedUrl),
    operations
  };
};
var transform9 = createExtractAndGenerate(extract11, generate11);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/imgix.js
var { operationsGenerator: operationsGenerator15, operationsParser: operationsParser10 } = createOperationsHandlers({
  keyMap: {
    format: "fm",
    width: "w",
    height: "h",
    quality: "q"
  },
  defaults: {
    fit: "min",
    auto: "format"
  }
});
var extract12 = (url) => {
  const src = toUrl(url);
  const operations = operationsParser10(url);
  src.search = "";
  return { src: toCanonicalUrlString(src), operations };
};
var generate12 = (src, operations) => {
  const modifiers = operationsGenerator15(operations);
  const url = toUrl(src);
  url.search = modifiers;
  if (url.searchParams.has("fm") && url.searchParams.get("auto") === "format") {
    url.searchParams.delete("auto");
  }
  return toCanonicalUrlString(url);
};
var transform10 = createExtractAndGenerate(extract12, generate12);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/ipx.js
var { operationsGenerator: operationsGenerator16, operationsParser: operationsParser11 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    quality: "q",
    format: "f"
  },
  defaults: {
    f: "auto"
  },
  kvSeparator: "_",
  paramSeparator: ","
});

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/keycdn.js
var BOOLEAN_PARAMS = [
  "enlarge",
  "flip",
  "flop",
  "negate",
  "normalize",
  "grayscale",
  "removealpha",
  "olrepeat",
  "progressive",
  "adaptive",
  "lossless",
  "nearlossless",
  "metadata"
];
var { operationsGenerator: operationsGenerator17, operationsParser: operationsParser12 } = createOperationsHandlers({
  defaults: {
    fit: "cover"
  },
  formatMap: {
    jpg: "jpeg"
  }
});
var generate13 = (src, operations) => {
  const url = toUrl(src);
  for (const key of BOOLEAN_PARAMS) {
    if (operations[key] !== void 0) {
      operations[key] = operations[key] ? 1 : 0;
    }
  }
  url.search = operationsGenerator17(operations);
  return toCanonicalUrlString(url);
};
var extract13 = (url) => {
  const parsedUrl = toUrl(url);
  const operations = operationsParser12(parsedUrl);
  for (const key of BOOLEAN_PARAMS) {
    if (operations[key] !== void 0) {
      operations[key] = paramToBoolean(operations[key]);
    }
  }
  parsedUrl.search = "";
  return {
    src: toCanonicalUrlString(parsedUrl),
    operations
  };
};
var transform11 = createExtractAndGenerate(extract13, generate13);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/kontent.ai.js
var { operationsGenerator: operationsGenerator18, operationsParser: operationsParser13 } = createOperationsHandlers({
  formatMap: {
    jpg: "jpeg"
  },
  keyMap: {
    format: "fm",
    width: "w",
    height: "h",
    quality: "q"
  }
});
var generate14 = (src, operations) => {
  const url = toUrl(src);
  if (operations.lossless !== void 0) {
    operations.lossless = operations.lossless ? 1 : 0;
  }
  if (operations.width && operations.height) {
    operations.fit = "crop";
  }
  url.search = operationsGenerator18(operations);
  return toCanonicalUrlString(url);
};
var extract14 = (url) => {
  const parsedUrl = toUrl(url);
  const operations = operationsParser13(parsedUrl);
  if (operations.lossless !== void 0) {
    operations.lossless = paramToBoolean(operations.lossless);
  }
  parsedUrl.search = "";
  return {
    src: toCanonicalUrlString(parsedUrl),
    operations
  };
};
var transform12 = createExtractAndGenerate(extract14, generate14);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/netlify.js
var { operationsGenerator: operationsGenerator19, operationsParser: operationsParser14 } = createOperationsHandlers({
  defaults: {
    fit: "cover"
  },
  keyMap: {
    format: "fm",
    width: "w",
    height: "h",
    quality: "q"
  }
});
var generate15 = (src, operations, options = {}) => {
  const url = toUrl(`${options.baseUrl || ""}/.netlify/images`);
  url.search = operationsGenerator19(operations);
  url.searchParams.set("url", src.toString());
  return toCanonicalUrlString(url);
};
var extract15 = (url) => {
  if (getProviderForUrlByPath(url) !== "netlify") {
    return null;
  }
  const parsedUrl = toUrl(url);
  const operations = operationsParser14(parsedUrl);
  delete operations.url;
  const sourceUrl = parsedUrl.searchParams.get("url") || "";
  parsedUrl.search = "";
  return {
    src: sourceUrl,
    operations,
    options: {
      baseUrl: parsedUrl.hostname === "n" ? void 0 : parsedUrl.origin
    }
  };
};
var transform13 = createExtractAndGenerate(extract15, generate15);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/vercel.js
var { operationsGenerator: operationsGenerator20, operationsParser: operationsParser15 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    quality: "q",
    height: false,
    format: false
  },
  defaults: {
    q: 75
  }
});
var generate16 = (src, operations, options = {}) => {
  const url = toUrl(`${options.baseUrl || ""}/${options.prefix || "_vercel"}/image`);
  url.search = operationsGenerator20(operations);
  url.searchParams.append("url", src.toString());
  return toCanonicalUrlString(url);
};
var extract16 = (url, options = {}) => {
  if (!["vercel", "nextjs"].includes(getProviderForUrlByPath(url) || "")) {
    return null;
  }
  const parsedUrl = toUrl(url);
  const sourceUrl = parsedUrl.searchParams.get("url") || "";
  parsedUrl.searchParams.delete("url");
  const operations = operationsParser15(parsedUrl);
  parsedUrl.search = "";
  return {
    src: sourceUrl,
    operations,
    options: {
      baseUrl: options.baseUrl ?? parsedUrl.origin
    }
  };
};
var transform14 = createExtractAndGenerate(extract16, generate16);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/nextjs.js
var generate17 = (src, operations, options = {}) => generate16(src, operations, { ...options, prefix: "_next" });
var extract17 = (url, options) => extract16(url, options);
var transform15 = createExtractAndGenerate(extract17, generate17);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/scene7.js
var { operationsGenerator: operationsGenerator21, operationsParser: operationsParser16 } = createOperationsHandlers({
  keyMap: {
    width: "wid",
    height: "hei",
    quality: "qlt",
    format: "fmt"
  },
  defaults: {
    fit: "crop,0"
  }
});
var BASE = "https://s7d1.scene7.com/is/image/";
var generate18 = (src, operations) => {
  const url = new URL(src, BASE);
  url.search = operationsGenerator21(operations);
  return toCanonicalUrlString(url);
};
var extract18 = (url) => {
  if (getProviderForUrl(url) !== "scene7") {
    return null;
  }
  const parsedUrl = new URL(url, BASE);
  const operations = operationsParser16(parsedUrl);
  parsedUrl.search = "";
  return {
    src: parsedUrl.toString(),
    operations
  };
};
var transform16 = createExtractAndGenerate(extract18, generate18);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/shopify.js
var shopifyRegex = /(.+?)(?:_(?:(pico|icon|thumb|small|compact|medium|large|grande|original|master)|(\d*)x(\d*)))?(?:_crop_([a-z]+))?(\.[a-zA-Z]+)(\.png|\.jpg|\.webp|\.avif)?$/;
var { operationsGenerator: operationsGenerator22, operationsParser: operationsParser17 } = createOperationsHandlers({
  keyMap: {
    format: false
  }
});
var generate19 = (src, operations) => {
  const url = toUrl(src);
  const basePath = url.pathname.replace(shopifyRegex, "$1$6");
  url.pathname = basePath;
  url.search = operationsGenerator22(operations);
  return toCanonicalUrlString(url);
};
var extract19 = (url) => {
  const parsedUrl = toUrl(url);
  const match = shopifyRegex.exec(parsedUrl.pathname);
  const operations = operationsParser17(parsedUrl);
  if (match) {
    const [, , , width, height, crop] = match;
    if (width && height && !operations.width && !operations.height) {
      operations.width = parseInt(width, 10);
      operations.height = parseInt(height, 10);
    }
    if (crop) {
      operations.crop ??= crop;
    }
  }
  const basePath = parsedUrl.pathname.replace(shopifyRegex, "$1$6");
  parsedUrl.pathname = basePath;
  for (const key of ["width", "height", "crop", "pad_color", "format"]) {
    parsedUrl.searchParams.delete(key);
  }
  return {
    src: parsedUrl.toString(),
    operations
  };
};
var transform17 = createExtractAndGenerate(extract19, generate19);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/storyblok.js
var storyBlokAssets = /(?<id>\/f\/\d+\/\d+x\d+\/\w+\/[^\/]+)\/?(?<modifiers>m\/?(?<crop>\d+x\d+:\d+x\d+)?\/?(?<resize>(?<flipx>\-)?(?<width>\d+)x(?<flipy>\-)?(?<height>\d+))?\/?(filters\:(?<filters>[^\/]+))?)?$/;
var storyBlokImg2 = /^(?<modifiers>\/(?<crop>\d+x\d+:\d+x\d+)?\/?(?<resize>(?<flipx>\-)?(?<width>\d+)x(?<flipy>\-)?(?<height>\d+))?\/?(filters\:(?<filters>[^\/]+))?\/?)?(?<id>\/f\/.+)$/;
var filterSplitterRegex = /:(?![^(]*\))/;
var splitFilters = (filters) => {
  if (!filters) {
    return {};
  }
  return Object.fromEntries(filters.split(filterSplitterRegex).map((filter) => {
    if (!filter)
      return [];
    const [key, value] = filter.split("(");
    return [key, value.replace(")", "")];
  }));
};
var generateFilters = (filters) => {
  if (!filters) {
    return void 0;
  }
  const filterItems = Object.entries(filters).map(([key, value]) => `${key}(${value ?? ""})`);
  if (filterItems.length === 0) {
    return void 0;
  }
  return `filters:${filterItems.join(":")}`;
};
var extract20 = (url) => {
  const parsedUrl = toUrl(url);
  const regex = parsedUrl.hostname === "img2.storyblok.com" ? storyBlokImg2 : storyBlokAssets;
  const matches = regex.exec(parsedUrl.pathname);
  if (!matches || !matches.groups) {
    return null;
  }
  const { id, crop, width, height, filters, flipx, flipy } = matches.groups;
  const { format, ...filterMap } = splitFilters(filters ?? "");
  if (parsedUrl.hostname === "img2.storyblok.com") {
    parsedUrl.hostname = "a.storyblok.com";
  }
  const operations = Object.fromEntries([
    ["width", Number(width) || void 0],
    ["height", Number(height) || void 0],
    ["format", format],
    ["crop", crop],
    ["filters", filterMap],
    ["flipx", flipx],
    ["flipy", flipy]
  ].filter(([_, value]) => value !== void 0));
  return {
    src: `${parsedUrl.origin}${id}`,
    operations
  };
};
var generate20 = (src, operations) => {
  const url = toUrl(src);
  const { width = 0, height = 0, format, crop, filters = {}, flipx = "", flipy = "" } = operations;
  const size = `${flipx}${width}x${flipy}${height}`;
  if (format) {
    filters.format = format;
  }
  const parts = [
    url.pathname,
    "m",
    crop,
    size,
    generateFilters(filters)
  ].filter(Boolean);
  url.pathname = parts.join("/");
  return toCanonicalUrlString(url);
};
var transform18 = createExtractAndGenerate(extract20, generate20);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/supabase.js
var STORAGE_URL_PREFIX = "/storage/v1/object/public/";
var RENDER_URL_PREFIX = "/storage/v1/render/image/public/";
var isRenderUrl = (url) => url.pathname.startsWith(RENDER_URL_PREFIX);
var { operationsGenerator: operationsGenerator23, operationsParser: operationsParser18 } = createOperationsHandlers({});
var generate21 = (src, operations) => {
  const url = toUrl(src);
  const basePath = url.pathname.replace(RENDER_URL_PREFIX, STORAGE_URL_PREFIX);
  url.pathname = basePath;
  if (operations.format && operations.format !== "origin") {
    delete operations.format;
  }
  url.search = operationsGenerator23(operations);
  return toCanonicalUrlString(url).replace(STORAGE_URL_PREFIX, RENDER_URL_PREFIX);
};
var extract21 = (url) => {
  const parsedUrl = toUrl(url);
  const operations = operationsParser18(parsedUrl);
  const isRender = isRenderUrl(parsedUrl);
  const imagePath = parsedUrl.pathname.replace(RENDER_URL_PREFIX, "").replace(STORAGE_URL_PREFIX, "");
  if (!isRender) {
    return {
      src: toCanonicalUrlString(parsedUrl),
      operations
    };
  }
  return {
    src: `${parsedUrl.origin}${STORAGE_URL_PREFIX}${imagePath}`,
    operations
  };
};
var transform19 = createExtractAndGenerate(extract21, generate21);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/uploadcare.js
var uploadcareRegex = /^https?:\/\/(?<host>[^\/]+)\/(?<uuid>[^\/]+)(?:\/(?<filename>[^\/]+)?)?/;
var { operationsGenerator: operationsGenerator24, operationsParser: operationsParser19 } = createOperationsHandlers({
  keyMap: {
    width: false,
    height: false
  },
  defaults: {
    format: "auto"
  },
  kvSeparator: "/",
  paramSeparator: "/-/"
});
var extract22 = (url) => {
  const parsedUrl = toUrl(url);
  const match = uploadcareRegex.exec(parsedUrl.toString());
  if (!match || !match.groups) {
    return null;
  }
  const { host, uuid } = match.groups;
  const [, ...operationsString] = parsedUrl.pathname.split("/-/");
  const operations = operationsParser19(operationsString.join("/-/") || "");
  if (operations.resize) {
    const [width, height] = operations.resize.split("x");
    if (width)
      operations.width = parseInt(width);
    if (height)
      operations.height = parseInt(height);
    delete operations.resize;
  }
  return {
    src: `https://${host}/${uuid}/`,
    operations,
    options: { host }
  };
};
var generate22 = (src, operations, options = {}) => {
  const url = toUrl(src);
  const host = options.host || url.hostname;
  const match = uploadcareRegex.exec(url.toString());
  if (match?.groups) {
    url.pathname = `/${match.groups.uuid}/`;
  }
  operations.resize = operations.resize || `${operations.width ?? ""}x${operations.height ?? ""}`;
  delete operations.width;
  delete operations.height;
  const modifiers = addTrailingSlash(operationsGenerator24(operations));
  url.hostname = host;
  url.pathname = stripTrailingSlash(url.pathname) + (modifiers ? `/-/${modifiers}` : "") + (match?.groups?.filename ?? "");
  return toCanonicalUrlString(url);
};
var transform20 = createExtractAndGenerate(extract22, generate22);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/wordpress.js
var { operationsGenerator: operationsGenerator25, operationsParser: operationsParser20 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h"
  },
  defaults: {
    crop: "1"
  }
});
var generate23 = (src, operations) => {
  const url = toUrl(src);
  const { crop } = operations;
  if (typeof crop !== "undefined" && crop !== "0") {
    operations.crop = crop ? "1" : "0";
  }
  url.search = operationsGenerator25(operations);
  return toCanonicalUrlString(url);
};
var extract23 = (url) => {
  const parsedUrl = toUrl(url);
  const operations = operationsParser20(parsedUrl);
  if (operations.crop !== void 0) {
    operations.crop = operations.crop === "1";
  }
  parsedUrl.search = "";
  return {
    src: toCanonicalUrlString(parsedUrl),
    operations
  };
};
var transform21 = createExtractAndGenerate(extract23, generate23);

// ../../node_modules/.pnpm/unpic@4.2.2/node_modules/unpic/esm/src/providers/wsrv.js
var { operationsGenerator: operationsGenerator26, operationsParser: operationsParser21 } = createOperationsHandlers({
  keyMap: {
    width: "w",
    height: "h",
    format: "output",
    quality: "q"
  },
  defaults: {
    fit: "cover"
  }
});
var extract24 = (url) => {
  const urlObj = toUrl(url);
  const srcParam = urlObj.searchParams.get("url");
  if (!srcParam) {
    return null;
  }
  let src = srcParam;
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    src = "https://" + src;
  }
  urlObj.searchParams.delete("url");
  const operations = operationsParser21(urlObj);
  return {
    src,
    operations
  };
};
var generate24 = (src, operations) => {
  const url = new URL("https://wsrv.nl/");
  const srcUrl = typeof src === "string" ? src : src.toString();
  const cleanSrc = srcUrl.replace(/^https?:\/\//, "");
  url.searchParams.set("url", cleanSrc);
  const params = operationsGenerator26(operations);
  const searchParams = new URLSearchParams(params);
  for (const [key, value] of searchParams) {
    if (key !== "url") {
      url.searchParams.set(key, value);
    }
  }
  return toCanonicalUrlString(url);
};
var transform22 = createExtractAndGenerate(extract24, generate24);

// src/nextjs.tsx
var import_image_config = require("next/dist/shared/lib/image-config.js");
var import_jsx_runtime3 = require("react/jsx-runtime");
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
var Image3 = (0, import_react.forwardRef)(
  function Image4(props, ref) {
    const config = configEnv || import_image_config.imageConfigDefault;
    const breakpoints = (0, import_react.useMemo)(() => {
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
    const cdn = (0, import_react.useMemo)(() => {
      if (src?.startsWith("/")) {
        return "nextjs";
      }
      return getProviderForUrl(src);
    }, [src]);
    const isRemoteCdn = cdn && cdn !== "nextjs" && cdn !== "vercel";
    if (isRemoteCdn) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Image, { ...childProps, src, ref, fallback: "nextjs" });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Image
});
