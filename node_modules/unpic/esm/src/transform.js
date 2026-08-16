import { getProviderForUrl } from "./detect.js";
import { transform as appwrite } from "./providers/appwrite.js";
import { transform as astro } from "./providers/astro.js";
import { transform as builderio } from "./providers/builder.io.js";
import { transform as bunny } from "./providers/bunny.js";
import { transform as cloudflare } from "./providers/cloudflare.js";
import { transform as cloudflare_images } from "./providers/cloudflare_images.js";
import { transform as cloudimage } from "./providers/cloudimage.js";
import { transform as cloudinary } from "./providers/cloudinary.js";
import { transform as contentful } from "./providers/contentful.js";
import { transform as contentstack } from "./providers/contentstack.js";
import { transform as directus } from "./providers/directus.js";
import { transform as hygraph } from "./providers/hygraph.js";
import { transform as imageengine } from "./providers/imageengine.js";
import { transform as imagekit } from "./providers/imagekit.js";
import { transform as imgix } from "./providers/imgix.js";
import { transform as ipx } from "./providers/ipx.js";
import { transform as keycdn } from "./providers/keycdn.js";
import { transform as kontentai } from "./providers/kontent.ai.js";
import { transform as netlify } from "./providers/netlify.js";
import { transform as nextjs } from "./providers/nextjs.js";
import { transform as scene7 } from "./providers/scene7.js";
import { transform as shopify } from "./providers/shopify.js";
import { transform as storyblok } from "./providers/storyblok.js";
import { transform as supabase } from "./providers/supabase.js";
import { transform as uploadcare } from "./providers/uploadcare.js";
import { transform as vercel } from "./providers/vercel.js";
import { transform as wordpress } from "./providers/wordpress.js";
import { transform as wsrv } from "./providers/wsrv.js";
const transformerMap = {
    appwrite,
    astro,
    "builder.io": builderio,
    bunny,
    cloudflare,
    cloudflare_images,
    cloudimage,
    cloudinary,
    contentful,
    contentstack,
    directus,
    hygraph,
    imageengine,
    imagekit,
    imgix,
    ipx,
    keycdn,
    "kontent.ai": kontentai,
    netlify,
    nextjs,
    scene7,
    shopify,
    storyblok,
    supabase,
    uploadcare,
    vercel,
    wordpress,
    wsrv,
};
/**
 * Returns a transformer function if the given CDN is supported
 */
export function getTransformerForCdn(cdn) {
    if (!cdn) {
        return undefined;
    }
    return transformerMap[cdn];
}
/**
 * Transforms an image URL to a new URL with the given options.
 * If the URL is not from a known image CDN it returns undefined.
 */
export function transformUrl({ url, provider, cdn: cdnOption, fallback, width, height, format, quality, }, providerOperations, providerOptions) {
    const cdn = provider || cdnOption ||
        getProviderForUrl(url) || fallback;
    if (!cdn) {
        return undefined;
    }
    return getTransformerForCdn(cdn)?.(url, {
        ...{ width, height, format, quality },
        ...providerOperations?.[cdn],
    }, providerOptions?.[cdn] ?? {});
}
