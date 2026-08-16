"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransformerForCdn = getTransformerForCdn;
exports.transformUrl = transformUrl;
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
const transformerMap = {
    appwrite: appwrite_js_1.transform,
    astro: astro_js_1.transform,
    "builder.io": builder_io_js_1.transform,
    bunny: bunny_js_1.transform,
    cloudflare: cloudflare_js_1.transform,
    cloudflare_images: cloudflare_images_js_1.transform,
    cloudimage: cloudimage_js_1.transform,
    cloudinary: cloudinary_js_1.transform,
    contentful: contentful_js_1.transform,
    contentstack: contentstack_js_1.transform,
    directus: directus_js_1.transform,
    hygraph: hygraph_js_1.transform,
    imageengine: imageengine_js_1.transform,
    imagekit: imagekit_js_1.transform,
    imgix: imgix_js_1.transform,
    ipx: ipx_js_1.transform,
    keycdn: keycdn_js_1.transform,
    "kontent.ai": kontent_ai_js_1.transform,
    netlify: netlify_js_1.transform,
    nextjs: nextjs_js_1.transform,
    scene7: scene7_js_1.transform,
    shopify: shopify_js_1.transform,
    storyblok: storyblok_js_1.transform,
    supabase: supabase_js_1.transform,
    uploadcare: uploadcare_js_1.transform,
    vercel: vercel_js_1.transform,
    wordpress: wordpress_js_1.transform,
    wsrv: wsrv_js_1.transform,
};
/**
 * Returns a transformer function if the given CDN is supported
 */
function getTransformerForCdn(cdn) {
    if (!cdn) {
        return undefined;
    }
    return transformerMap[cdn];
}
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 */
function transformUrl({ url, provider, cdn: cdnOption, fallback, width, height, format, quality, }, providerOperations, providerOptions) {
    const cdn = provider || cdnOption ||
        (0, detect_js_1.getProviderForUrl)(url) || fallback;
    if (!cdn) {
        return undefined;
    }
    return getTransformerForCdn(cdn)?.(url, {
        ...{ width, height, format, quality },
        ...providerOperations?.[cdn],
    }, providerOptions?.[cdn] ?? {});
}
