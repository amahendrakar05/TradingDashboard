"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUrl = exports.getExtractorForProvider = exports.getExtractorForUrl = exports.parsers = void 0;
const detect_js_1 = require("./detect.js");
const appwrite_js_1 = require("./providers/appwrite.js");
const astro_js_1 = require("./providers/astro.js");
const builder_io_js_1 = require("./providers/builder.io.js");
const bunny_js_1 = require("./providers/bunny.js");
const cloudflare_js_1 = require("./providers/cloudflare.js");
const cloudflare_images_js_1 = require("./providers/cloudflare_images.js");
const cloudimage_js_1 = require("./providers/cloudimage.js");
const cloudinary_js_1 = require("./providers/cloudinary.js");
const contentful_js_1 = require("./providers/contentful.js");
const contentstack_js_1 = require("./providers/contentstack.js");
const directus_js_1 = require("./providers/directus.js");
const hygraph_js_1 = require("./providers/hygraph.js");
const imageengine_js_1 = require("./providers/imageengine.js");
const imagekit_js_1 = require("./providers/imagekit.js");
const imgix_js_1 = require("./providers/imgix.js");
const ipx_js_1 = require("./providers/ipx.js");
const keycdn_js_1 = require("./providers/keycdn.js");
const kontent_ai_js_1 = require("./providers/kontent.ai.js");
const netlify_js_1 = require("./providers/netlify.js");
const nextjs_js_1 = require("./providers/nextjs.js");
const scene7_js_1 = require("./providers/scene7.js");
const shopify_js_1 = require("./providers/shopify.js");
const storyblok_js_1 = require("./providers/storyblok.js");
const supabase_js_1 = require("./providers/supabase.js");
const uploadcare_js_1 = require("./providers/uploadcare.js");
const vercel_js_1 = require("./providers/vercel.js");
const wordpress_js_1 = require("./providers/wordpress.js");
const wsrv_js_1 = require("./providers/wsrv.js");
exports.parsers = {
    appwrite: appwrite_js_1.extract,
    astro: astro_js_1.extract,
    "builder.io": builder_io_js_1.extract,
    bunny: bunny_js_1.extract,
    cloudflare: cloudflare_js_1.extract,
    cloudflare_images: cloudflare_images_js_1.extract,
    cloudimage: cloudimage_js_1.extract,
    cloudinary: cloudinary_js_1.extract,
    contentful: contentful_js_1.extract,
    contentstack: contentstack_js_1.extract,
    directus: directus_js_1.extract,
    hygraph: hygraph_js_1.extract,
    imageengine: imageengine_js_1.extract,
    imagekit: imagekit_js_1.extract,
    imgix: imgix_js_1.extract,
    ipx: ipx_js_1.extract,
    keycdn: keycdn_js_1.extract,
    "kontent.ai": kontent_ai_js_1.extract,
    netlify: netlify_js_1.extract,
    nextjs: nextjs_js_1.extract,
    scene7: scene7_js_1.extract,
    shopify: shopify_js_1.extract,
    storyblok: storyblok_js_1.extract,
    supabase: supabase_js_1.extract,
    uploadcare: uploadcare_js_1.extract,
    vercel: vercel_js_1.extract,
    wordpress: wordpress_js_1.extract,
    wsrv: wsrv_js_1.extract,
};
/**
 * Returns a parser function if the given URL is from a known image CDN
 */
const getExtractorForUrl = (url) => (0, exports.getExtractorForProvider)((0, detect_js_1.getProviderForUrl)(url));
exports.getExtractorForUrl = getExtractorForUrl;
const getExtractorForProvider = (cdn) => {
    if (!cdn) {
        return undefined;
    }
    return exports.parsers[cdn];
};
exports.getExtractorForProvider = getExtractorForProvider;
/**
 * Parses an image URL into its components.
 * If the URL is not from a known image CDN it returns undefined.
 */
const parseUrl = (url, cdn, options) => {
    const detectedCdn = cdn || (0, detect_js_1.getProviderForUrl)(url);
    if (!detectedCdn) {
        return undefined;
    }
    const parser = (0, exports.getExtractorForProvider)(detectedCdn);
    if (!parser) {
        return {
            src: url.toString(),
            operations: {},
            options: {},
            cdn: detectedCdn,
        };
    }
    return { ...parser(url, options), cdn: detectedCdn };
};
exports.parseUrl = parseUrl;
