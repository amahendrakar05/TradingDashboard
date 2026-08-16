import { getProviderForUrl } from "./detect.js";
import { extract as appwrite } from "./providers/appwrite.js";
import { extract as astro } from "./providers/astro.js";
import { extract as builder } from "./providers/builder.io.js";
import { extract as bunny } from "./providers/bunny.js";
import { extract as cloudflare } from "./providers/cloudflare.js";
import { extract as cloudflareImages } from "./providers/cloudflare_images.js";
import { extract as cloudimage } from "./providers/cloudimage.js";
import { extract as cloudinary } from "./providers/cloudinary.js";
import { extract as contentful } from "./providers/contentful.js";
import { extract as contentstack } from "./providers/contentstack.js";
import { extract as directus } from "./providers/directus.js";
import { extract as hygraph } from "./providers/hygraph.js";
import { extract as imageengine } from "./providers/imageengine.js";
import { extract as imagekit } from "./providers/imagekit.js";
import { extract as imgix } from "./providers/imgix.js";
import { extract as ipx } from "./providers/ipx.js";
import { extract as keycdn } from "./providers/keycdn.js";
import { extract as kontentai } from "./providers/kontent.ai.js";
import { extract as netlify } from "./providers/netlify.js";
import { extract as nextjs } from "./providers/nextjs.js";
import { extract as scene7 } from "./providers/scene7.js";
import { extract as shopify } from "./providers/shopify.js";
import { extract as storyblok } from "./providers/storyblok.js";
import { extract as supabase } from "./providers/supabase.js";
import { extract as uploadcare } from "./providers/uploadcare.js";
import { extract as vercel } from "./providers/vercel.js";
import { extract as wordpress } from "./providers/wordpress.js";
import { extract as wsrv } from "./providers/wsrv.js";
export const parsers = {
    appwrite,
    astro,
    "builder.io": builder,
    bunny,
    cloudflare,
    cloudflare_images: cloudflareImages,
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
 * Returns a parser function if the given URL is from a known image CDN
 */
export const getExtractorForUrl = (url) => getExtractorForProvider(getProviderForUrl(url));
export const getExtractorForProvider = (cdn) => {
    if (!cdn) {
        return undefined;
    }
    return parsers[cdn];
};
/**
 * Parses an image URL into its components.
 * If the URL is not from a known image CDN it returns undefined.
 */
export const parseUrl = (url, cdn, options) => {
    const detectedCdn = cdn || getProviderForUrl(url);
    if (!detectedCdn) {
        return undefined;
    }
    const parser = getExtractorForProvider(detectedCdn);
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
