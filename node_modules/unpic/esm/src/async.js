import { getProviderForUrl } from "./detect.js";
const asyncProviderMap = {
    appwrite: () => import("./providers/appwrite.js"),
    astro: () => import("./providers/astro.js"),
    "builder.io": () => import("./providers/builder.io.js"),
    bunny: () => import("./providers/bunny.js"),
    cloudflare: () => import("./providers/cloudflare.js"),
    cloudflare_images: () => import("./providers/cloudflare_images.js"),
    cloudimage: () => import("./providers/cloudimage.js"),
    cloudinary: () => import("./providers/cloudinary.js"),
    contentful: () => import("./providers/contentful.js"),
    contentstack: () => import("./providers/contentstack.js"),
    directus: () => import("./providers/directus.js"),
    hygraph: () => import("./providers/hygraph.js"),
    imageengine: () => import("./providers/imageengine.js"),
    imagekit: () => import("./providers/imagekit.js"),
    imgix: () => import("./providers/imgix.js"),
    ipx: () => import("./providers/ipx.js"),
    keycdn: () => import("./providers/keycdn.js"),
    "kontent.ai": () => import("./providers/kontent.ai.js"),
    netlify: () => import("./providers/netlify.js"),
    nextjs: () => import("./providers/nextjs.js"),
    scene7: () => import("./providers/scene7.js"),
    shopify: () => import("./providers/shopify.js"),
    storyblok: () => import("./providers/storyblok.js"),
    supabase: () => import("./providers/supabase.js"),
    uploadcare: () => import("./providers/uploadcare.js"),
    vercel: () => import("./providers/vercel.js"),
    wordpress: () => import("./providers/wordpress.js"),
    wsrv: () => import("./providers/wsrv.js"),
};
/**
 * Returns a parser function if the given URL is from a known image CDN
 */
export const getExtractorForUrl = (url) => getExtractorForProvider(getProviderForUrl(url));
/**
 * Dynamically loads the module for the given provider
 */
export function getModuleForProvider(cdn) {
    if (!cdn) {
        return undefined;
    }
    return asyncProviderMap[cdn]?.();
}
/**
 * Dynamically loads the extract function for the given provider
 */
export const getExtractorForProvider = async (cdn) => (await getModuleForProvider(cdn))?.extract;
/**
 * Dynamically loads the generate function for the given provider
 */
export const getGeneratorForProvider = async (cdn) => (await getModuleForProvider(cdn))?.generate;
/**
 * Dynamically loads the transform function for the given provider
 */
export const getTransformerForProvider = async (cdn) => (await getModuleForProvider(cdn))?.transform;
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 *
 * This function is async because it dynamically loads the module for the provider.
 * If you need a synchronous version, import from the root module instead.
 */
export async function transformUrl(url, { provider, cdn: cdnOption, fallback, ...operations }, providerOperations, providerOptions) {
    const cdn = provider || cdnOption ||
        getProviderForUrl(url) || fallback;
    if (!cdn) {
        return undefined;
    }
    const transformer = await getTransformerForProvider(cdn);
    return transformer?.(url, {
        ...operations,
        ...providerOperations?.[cdn],
    }, providerOptions?.[cdn] ?? {});
}
