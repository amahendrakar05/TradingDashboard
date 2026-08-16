"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransformerForProvider = exports.getGeneratorForProvider = exports.getExtractorForProvider = exports.getExtractorForUrl = void 0;
exports.getModuleForProvider = getModuleForProvider;
exports.transformUrl = transformUrl;
const detect_js_1 = require("./detect.js");
const asyncProviderMap = {
    appwrite: () => Promise.resolve().then(() => __importStar(require("./providers/appwrite.js"))),
    astro: () => Promise.resolve().then(() => __importStar(require("./providers/astro.js"))),
    "builder.io": () => Promise.resolve().then(() => __importStar(require("./providers/builder.io.js"))),
    bunny: () => Promise.resolve().then(() => __importStar(require("./providers/bunny.js"))),
    cloudflare: () => Promise.resolve().then(() => __importStar(require("./providers/cloudflare.js"))),
    cloudflare_images: () => Promise.resolve().then(() => __importStar(require("./providers/cloudflare_images.js"))),
    cloudimage: () => Promise.resolve().then(() => __importStar(require("./providers/cloudimage.js"))),
    cloudinary: () => Promise.resolve().then(() => __importStar(require("./providers/cloudinary.js"))),
    contentful: () => Promise.resolve().then(() => __importStar(require("./providers/contentful.js"))),
    contentstack: () => Promise.resolve().then(() => __importStar(require("./providers/contentstack.js"))),
    directus: () => Promise.resolve().then(() => __importStar(require("./providers/directus.js"))),
    hygraph: () => Promise.resolve().then(() => __importStar(require("./providers/hygraph.js"))),
    imageengine: () => Promise.resolve().then(() => __importStar(require("./providers/imageengine.js"))),
    imagekit: () => Promise.resolve().then(() => __importStar(require("./providers/imagekit.js"))),
    imgix: () => Promise.resolve().then(() => __importStar(require("./providers/imgix.js"))),
    ipx: () => Promise.resolve().then(() => __importStar(require("./providers/ipx.js"))),
    keycdn: () => Promise.resolve().then(() => __importStar(require("./providers/keycdn.js"))),
    "kontent.ai": () => Promise.resolve().then(() => __importStar(require("./providers/kontent.ai.js"))),
    netlify: () => Promise.resolve().then(() => __importStar(require("./providers/netlify.js"))),
    nextjs: () => Promise.resolve().then(() => __importStar(require("./providers/nextjs.js"))),
    scene7: () => Promise.resolve().then(() => __importStar(require("./providers/scene7.js"))),
    shopify: () => Promise.resolve().then(() => __importStar(require("./providers/shopify.js"))),
    storyblok: () => Promise.resolve().then(() => __importStar(require("./providers/storyblok.js"))),
    supabase: () => Promise.resolve().then(() => __importStar(require("./providers/supabase.js"))),
    uploadcare: () => Promise.resolve().then(() => __importStar(require("./providers/uploadcare.js"))),
    vercel: () => Promise.resolve().then(() => __importStar(require("./providers/vercel.js"))),
    wordpress: () => Promise.resolve().then(() => __importStar(require("./providers/wordpress.js"))),
    wsrv: () => Promise.resolve().then(() => __importStar(require("./providers/wsrv.js"))),
};
/**
 * Returns a parser function if the given URL is from a known image CDN
 */
const getExtractorForUrl = (url) => (0, exports.getExtractorForProvider)((0, detect_js_1.getProviderForUrl)(url));
exports.getExtractorForUrl = getExtractorForUrl;
/**
 * Dynamically loads the module for the given provider
 */
function getModuleForProvider(cdn) {
    if (!cdn) {
        return undefined;
    }
    return asyncProviderMap[cdn]?.();
}
/**
 * Dynamically loads the extract function for the given provider
 */
const getExtractorForProvider = async (cdn) => (await getModuleForProvider(cdn))?.extract;
exports.getExtractorForProvider = getExtractorForProvider;
/**
 * Dynamically loads the generate function for the given provider
 */
const getGeneratorForProvider = async (cdn) => (await getModuleForProvider(cdn))?.generate;
exports.getGeneratorForProvider = getGeneratorForProvider;
/**
 * Dynamically loads the transform function for the given provider
 */
const getTransformerForProvider = async (cdn) => (await getModuleForProvider(cdn))?.transform;
exports.getTransformerForProvider = getTransformerForProvider;
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 *
 * This function is async because it dynamically loads the module for the provider.
 * If you need a synchronous version, import from the root module instead.
 */
async function transformUrl(url, { provider, cdn: cdnOption, fallback, ...operations }, providerOperations, providerOptions) {
    const cdn = provider || cdnOption ||
        (0, detect_js_1.getProviderForUrl)(url) || fallback;
    if (!cdn) {
        return undefined;
    }
    const transformer = await (0, exports.getTransformerForProvider)(cdn);
    return transformer?.(url, {
        ...operations,
        ...providerOperations?.[cdn],
    }, providerOptions?.[cdn] ?? {});
}
