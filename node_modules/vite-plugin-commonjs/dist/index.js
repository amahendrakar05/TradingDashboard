"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const MagicString = require("magic-string");
const os = require("node:os");
const node_module = require("node:module");
const vitePluginDynamicImport = require("vite-plugin-dynamic-import");
const DEFAULT_EXTENSIONS = [
  ".cjs",
  ".mjs",
  ".js",
  ".cts",
  ".mts",
  ".ts",
  ".jsx",
  ".tsx",
  ".json"
];
const KNOWN_SFC_EXTENSIONS = [
  ".vue",
  ".svelte"
];
const KNOWN_ASSET_TYPES = [
  // images
  "png",
  "jpe?g",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "svg",
  "ico",
  "webp",
  "avif",
  // media
  "mp4",
  "webm",
  "ogg",
  "mp3",
  "wav",
  "flac",
  "aac",
  // fonts
  "woff2?",
  "eot",
  "ttf",
  "otf",
  // other
  "webmanifest",
  "pdf",
  "txt"
];
const KNOWN_CSS_TYPES = [
  "css",
  // supported pre-processor types
  "less",
  "sass",
  "scss",
  "styl",
  "stylus",
  "pcss",
  "postcss"
];
const multilineCommentsRE = /\/\*(.|[\r\n])*?\*\//gm;
const singlelineCommentsRE = /\/\/.*(?=[\n\r])/g;
function cleanUrl(url) {
  const queryRE = /\?.*$/s;
  const hashRE = /#.*$/s;
  return url.replace(hashRE, "").replace(queryRE, "");
}
async function walk(ast, visitors, ancestors = []) {
  var _a;
  if (!ast)
    return;
  if (Array.isArray(ast)) {
    for (const element of ast) {
      await walk(element, visitors, ancestors);
    }
  } else {
    ancestors = ancestors.concat(ast);
    for (const key of Object.keys(ast)) {
      await (typeof ast[key] === "object" && walk(ast[key], visitors, ancestors));
    }
  }
  await ((_a = visitors[ast.type]) === null || _a === void 0 ? void 0 : _a.call(visitors, ast, ancestors));
}
walk.sync = function walkSync(ast, visitors, ancestors = []) {
  var _a;
  if (!ast)
    return;
  if (Array.isArray(ast)) {
    for (const element of ast) {
      walkSync(element, visitors, ancestors);
    }
  } else {
    ancestors = ancestors.concat(ast);
    for (const key of Object.keys(ast)) {
      typeof ast[key] === "object" && walkSync(ast[key], visitors, ancestors);
    }
  }
  (_a = visitors[ast.type]) === null || _a === void 0 ? void 0 : _a.call(visitors, ast, ancestors);
};
const isWindows = os.platform() === "win32";
function slash(p) {
  return p.replace(/\\/g, "/");
}
function normalizePath(id) {
  return path.posix.normalize(isWindows ? slash(id) : id);
}
const COLOURS = {
  $: (c) => (str) => `\x1B[${c}m` + str + "\x1B[0m",
  gary: (str) => COLOURS.$(90)(str),
  cyan: (str) => COLOURS.$(36)(str),
  yellow: (str) => COLOURS.$(33)(str),
  green: (str) => COLOURS.$(32)(str),
  red: (str) => COLOURS.$(31)(str)
};
function analyzer(ast, code, id) {
  const analyzed = {
    ast,
    code,
    id,
    require: [],
    exports: []
  };
  walk.sync(ast, {
    CallExpression(node, ancestors) {
      if (node.callee.name !== "require")
        return;
      const dynamic = checkDynamicId(node);
      analyzed.require.push({
        node,
        ancestors,
        topScopeNode: dynamic === "dynamic" ? void 0 : findTopLevelScope(ancestors),
        dynamic
      });
    },
    AssignmentExpression(node) {
      if (node.left.type !== "MemberExpression")
        return;
      if (!["module", "exports"].includes(node.left.object.name))
        return;
      analyzed.exports.push({
        node,
        token: {
          left: node.left.object.name,
          right: node.left.property.name
        }
      });
    }
  });
  return analyzed;
}
function checkDynamicId(node) {
  var _a, _b, _c;
  if (((_a = node.arguments[0]) == null ? void 0 : _a.type) === "TemplateLiteral" && ((_b = node.arguments[0]) == null ? void 0 : _b.quasis.length) === 1) {
    return "Literal";
  }
  return ((_c = node.arguments[0]) == null ? void 0 : _c.type) !== "Literal" ? "dynamic" : void 0;
}
function findTopLevelScope(ancestors) {
  const ances = ancestors.map((an) => an.type).join();
  const arr = [...ancestors].reverse();
  if (/Program,ExpressionStatement,(MemberExpression,)?CallExpression$/.test(ances)) {
    return arr.find(
      (e) => e.type === "ExpressionStatement"
      /* ExpressionStatement */
    );
  }
}
function generateImport(analyzed, id, options) {
  const { importRules } = options.advanced ?? {};
  const imports = [];
  let count = 0;
  for (const { node, dynamic } of analyzed.require) {
    if (dynamic === "dynamic")
      continue;
    const impt = { node };
    const importName = `__CJS__import__${count++}__`;
    const requireIdNode = node.arguments[0];
    let requireId;
    if (!requireIdNode)
      continue;
    if (requireIdNode.type === "Literal") {
      requireId = requireIdNode.value;
    } else if (dynamic === "Literal") {
      requireId = requireIdNode.quasis[0].value.raw;
    }
    if (!requireId) {
      const codeSnippets = analyzed.code.slice(node.start, node.end);
      throw new Error(`The following require statement cannot be converted.
      -> ${codeSnippets}
         ${"^".repeat(codeSnippets.length)}`);
    }
    let importInterop = "defaultFirst";
    if (typeof importRules === "string") {
      importInterop = importRules;
    } else if (typeof importRules === "function") {
      importInterop = importRules(id);
    }
    impt.importExpression = `import * as ${importName} from "${requireId}"`;
    switch (importInterop) {
      case "defaultFirst":
        impt.importInterop = `${importName}.default || ${importName}`;
        break;
      case "namedFirst":
        impt.importInterop = `Object.keys(${importName}).join('') !== "default" ? ${importName} : ${importName}.default`;
        break;
      case "merge":
        impt.importInterop = `${importName}.default ? Object.assign(${importName}.default, ${importName}) : ${importName}`;
        break;
      default:
        impt.importInterop = importInterop;
    }
    imports.push(impt);
  }
  return imports;
}
function generateExport(analyzed) {
  if (!analyzed.exports.length) {
    return null;
  }
  const memberDefault = {
    declaration: "const __CJS__export_default__ = (module.exports == null ? {} : module.exports).default || module.exports",
    export: "__CJS__export_default__ as default"
  };
  let members = analyzed.exports.filter((exp) => exp.token.left !== "module" && exp.token.right !== "default").map((exp) => exp.token.right);
  members = [...new Set(members)];
  const membersDeclaration = [
    memberDefault.declaration,
    ...members.map((m) => `const __CJS__export_${m}__ = (module.exports == null ? {} : module.exports).${m}`)
  ];
  const membersExport = [
    memberDefault.export,
    ...members.map((m) => `__CJS__export_${m}__ as ${m}`)
  ];
  return {
    polyfill: "var module = { exports: {} }; var exports = module.exports;",
    exportDeclaration: `
${membersDeclaration.join(";\n")};
export {
  ${membersExport.join(",\n  ")},
}
`.trim()
  };
}
[
  ...node_module.builtinModules.map((m) => !m.startsWith("_")),
  ...node_module.builtinModules.map((m) => !m.startsWith("_")).map((m) => `node:${m}`)
];
function isCommonjs(code) {
  code = code.replace(multilineCommentsRE, "").replace(singlelineCommentsRE, "");
  return /\b(?:require|module|exports)\b/.test(code);
}
class DynaimcRequire {
  constructor(config, options, resolve = new vitePluginDynamicImport.Resolve(config)) {
    this.config = config;
    this.options = options;
    this.resolve = resolve;
  }
  async generateRuntime(analyzed) {
    var _a, _b, _c;
    const options = this.options;
    const id = analyzed.id;
    let counter = 0;
    const importCache = /* @__PURE__ */ new Map(
      /* import-id, import-name */
    );
    const records = [];
    for (const { dynamic, node } of analyzed.require) {
      if (dynamic !== "dynamic")
        continue;
      const importExpression = analyzed.code.slice(node.start, node.end);
      const globResult = await vitePluginDynamicImport.globFiles({
        importeeNode: node.arguments[0],
        importExpression,
        importer: analyzed.id,
        resolve: this.resolve,
        extensions: this.options.extensions,
        loose: ((_a = options.dynamic) == null ? void 0 : _a.loose) !== false
      });
      if (!globResult)
        continue;
      const record = { node };
      let { files, resolved, normally } = globResult;
      if (normally) {
        record.normally = normally;
        continue;
      }
      if (!(files == null ? void 0 : files.length)) {
        console.log(
          TAG,
          COLOURS.yellow(`no files matched: ${importExpression}
`),
          `  file: ${analyzed.id}`
        );
        continue;
      }
      files = files.filter((f) => normalizePath(path.join(path.dirname(id), f)) !== id);
      ((_b = options.dynamic) == null ? void 0 : _b.onFiles) && (files = ((_c = options.dynamic) == null ? void 0 : _c.onFiles(files, id)) || files);
      const maps = vitePluginDynamicImport.mappingPath(
        files,
        resolved ? { [resolved.alias.relative]: resolved.alias.findString } : void 0
      );
      let counter2 = 0;
      record.dynaimc = {
        importee: [],
        runtimeName: `__matchRequireRuntime${counter++}__`,
        runtimeFn: ""
        // to be immediately set
      };
      const cases = [];
      for (const [localFile, importeeList] of Object.entries(maps)) {
        let dynamic_require2import = importCache.get(localFile);
        if (!dynamic_require2import) {
          importCache.set(
            localFile,
            dynamic_require2import = `__dynamic_require2import__${counter}__${counter2++}`
          );
        }
        record.dynaimc.importee.push(`import * as ${dynamic_require2import} from '${localFile}'`);
        cases.push(importeeList.map((importee) => `    case '${importee}':`).concat(`      return ${dynamic_require2import};`).join("\n"));
      }
      record.dynaimc.runtimeFn = `function ${record.dynaimc.runtimeName}(path) {
  switch(path) {
${cases.join("\n")}
    default: throw new Error("Cann't found module: " + path);
  }
}`;
      records.push(record);
    }
    return records.length ? records : null;
  }
}
const TAG = "[vite-plugin-commonjs]";
function commonjs(options = {}) {
  let config;
  let extensions = DEFAULT_EXTENSIONS;
  let dynaimcRequire;
  return {
    name: "vite-plugin-commonjs",
    configResolved(_config) {
      var _a, _b, _c;
      config = _config;
      if ((_a = config.resolve) == null ? void 0 : _a.extensions)
        extensions = config.resolve.extensions;
      dynaimcRequire = new DynaimcRequire(_config, {
        ...options,
        extensions: [
          ...extensions,
          ...KNOWN_SFC_EXTENSIONS,
          ...KNOWN_ASSET_TYPES.map((type) => "." + type),
          ...KNOWN_CSS_TYPES.map((type) => "." + type)
        ]
      });
      (_b = _config.optimizeDeps).esbuildOptions ?? (_b.esbuildOptions = {});
      (_c = _config.optimizeDeps.esbuildOptions).plugins ?? (_c.plugins = []);
      _config.optimizeDeps.esbuildOptions.plugins.push({
        name: "vite-plugin-commonjs:pre-bundle",
        setup(build) {
          build.onLoad({ filter: /.*/ }, async ({ path: id }) => {
            let code;
            try {
              code = fs.readFileSync(id, "utf8");
            } catch (error) {
              return;
            }
            const result = await transformCommonjs({
              options,
              code,
              id,
              extensions,
              dynaimcRequire
            });
            if (result != null) {
              return {
                contents: result.code,
                loader: id.slice(id.lastIndexOf(".") + 1)
              };
            }
          });
        }
      });
    },
    transform(code, id) {
      return transformCommonjs({
        options,
        code,
        id,
        extensions,
        dynaimcRequire
      });
    }
  };
}
async function transformCommonjs({
  options,
  code,
  id,
  extensions,
  dynaimcRequire
}) {
  var _a;
  if (!(extensions.includes(path.extname(id)) || extensions.includes(path.extname(cleanUrl(id)))))
    return;
  if (!isCommonjs(code))
    return;
  const userCondition = (_a = options.filter) == null ? void 0 : _a.call(options, id);
  if (userCondition === false)
    return;
  if (userCondition !== true && id.includes("node_modules"))
    return;
  let ast;
  try {
    ast = acorn.parse(code, { sourceType: "module", ecmaVersion: 14 });
  } catch (error) {
    return null;
  }
  const analyzed = analyzer(ast, code, id);
  const imports = generateImport(analyzed, id, options);
  const exportRuntime = id.includes("node_modules/.vite") ? null : generateExport(analyzed);
  const dynamics = await dynaimcRequire.generateRuntime(analyzed);
  const hoistImports = [];
  const ms = new MagicString(code);
  for (const impt of imports) {
    const {
      node,
      importExpression,
      importInterop
    } = impt;
    if (importExpression != null && importInterop != null) {
      hoistImports.push(importExpression + ";");
      ms.overwrite(node.start, node.end, `(${importInterop})`);
    }
  }
  if (hoistImports.length) {
    ms.prepend([
      `/* ${TAG} import-hoist-S */`,
      ...hoistImports,
      `/* ${TAG} import-hoist-E */`
    ].join(" "));
  }
  if (exportRuntime) {
    const polyfill = [
      `/* ${TAG} export-runtime-S */`,
      exportRuntime.polyfill,
      `/* ${TAG} export-runtime-E */`
    ].join(" ");
    const _exports = [
      `/* ${TAG} export-statement-S */`,
      exportRuntime.exportDeclaration,
      `/* ${TAG} export-statement-E */`
    ].filter(Boolean).join("\n");
    ms.prepend(polyfill).append(_exports);
  }
  if (dynamics) {
    const requires = [];
    const runtimes = [];
    let count = 0;
    for (const dynamic of dynamics) {
      const { node, normally, dynaimc: dymc } = dynamic;
      if (normally) {
        const name = `__require2import__${count++}__`;
        requires.push(`import * as ${name} from "${normally}";`);
        ms.overwrite(node.callee.start, node.callee.end, name);
      } else if (dymc) {
        requires.push(...dymc.importee.map((impt) => impt + ";"));
        runtimes.push(dymc.runtimeFn);
        ms.overwrite(node.callee.start, node.callee.end, dymc.runtimeName);
      }
    }
    if (requires.length) {
      ms.prepend([
        `/* ${TAG} import-require2import-S */`,
        ...requires,
        `/* ${TAG} import-require2import-E */`
      ].join(" "));
    }
    if (runtimes.length) {
      ms.append(
        /* #49 */
        "\n" + runtimes.join("\n")
      );
    }
  }
  if (ms.hasChanged()) {
    return {
      code: ms.toString(),
      map: ms.generateMap({ hires: true, source: id })
    };
  }
}
exports.TAG = TAG;
exports.default = commonjs;
