//#region src/server/image-optimization.d.ts
/**
 * Image optimization request handler.
 *
 * Handles `/_next/image?url=...&w=...&q=...` requests. In production
 * on Cloudflare Workers, uses the Images binding (`env.IMAGES`) to
 * resize and transcode on the fly. On other runtimes (Node.js dev/prod
 * server), serves the original file as a passthrough with appropriate
 * Cache-Control headers.
 *
 * Format negotiation: inspects the `Accept` header and serves AVIF, WebP,
 * or JPEG depending on client support.
 *
 * Security: All image responses include Content-Security-Policy and
 * X-Content-Type-Options headers to prevent XSS via SVG or Content-Type
 * spoofing. SVG content is blocked by default (following Next.js behavior).
 * When `dangerouslyAllowSVG` is enabled in next.config.js, SVGs are served
 * as-is (no transformation) with security headers applied.
 */
/** The pathname that triggers image optimization (matches Next.js). */
declare const IMAGE_OPTIMIZATION_PATH = "/_next/image";
/**
 * Vinext-prefixed alias for the image optimization endpoint. Accepted
 * alongside IMAGE_OPTIMIZATION_PATH so apps that wire image URLs to the
 * vinext-prefixed path continue to work; emit IMAGE_OPTIMIZATION_PATH
 * for any newly generated URLs.
 */
declare const VINEXT_IMAGE_OPTIMIZATION_PATH = "/_vinext/image";
/**
 * Returns true when `pathname` is either supported image optimization
 * endpoint.
 *
 * A single trailing slash is accepted (`/_next/image/`): with
 * `trailingSlash: true`, Next.js 308-redirects `/_next/image?url=...` to
 * `/_next/image/?url=...` and then serves the slashed form — its route
 * matching strips a trailing slash before matching internal paths (see
 * getItem in packages/next/src/server/lib/router-utils/filesystem.ts).
 * Rejecting the slashed form 404'd every dev-mode next/image request under
 * `trailingSlash: true`.
 */
declare function isImageOptimizationPath(pathname: string): boolean;
/**
 * Image security configuration from next.config.js `images` section.
 * Controls SVG handling and security headers for the image endpoint.
 */
type ImageConfig = {
  /** Allowed device widths. Defaults to Next.js device sizes. */deviceSizes?: number[]; /** Allowed fixed-image widths. Defaults to Next.js image sizes. */
  imageSizes?: number[];
  /**
   * Allowed output qualities. When unset, any quality from 1-100 is permitted
   * (matches Next.js: an unset `images.qualities` is not restricted to a single
   * value). When set, only the listed qualities are accepted.
   */
  qualities?: number[]; /** Allow SVG through the image optimization endpoint. Default: false. */
  dangerouslyAllowSVG?: boolean;
  /**
   * Allow image optimization for hostnames that resolve to private IP addresses.
   * Default: false.
   *
   * Note: This field is currently reserved for future server-side remote-image
   * fetching. vinext's image optimization endpoint only serves local files, so
   * there is no active server-side SSRF vector — the flag is consumed client-side
   * via the image shim instead.
   */
  dangerouslyAllowLocalIP?: boolean; /** Content-Disposition header value. Default: "inline". */
  contentDispositionType?: "inline" | "attachment"; /** Content-Security-Policy header value. Default: "script-src 'none'; frame-src 'none'; sandbox;" */
  contentSecurityPolicy?: string;
};
/**
 * Next.js default device sizes and image sizes.
 * These are the allowed widths for image optimization when no custom
 * config is provided. Matches Next.js defaults exactly.
 */
declare const DEFAULT_DEVICE_SIZES: number[];
declare const DEFAULT_IMAGE_SIZES: number[];
type ParseImageParamsOptions = {
  isDev?: boolean;
};
declare function resolveDevImageRedirect(requestUrl: URL, allowedWidths?: number[], allowedQualities?: number[], options?: ParseImageParamsOptions): string | null;
/**
 * Parse and validate image optimization query parameters.
 * Returns null if the request is malformed.
 *
 * Ported from Next.js:
 * test/integration/image-optimizer/test/index.test.ts
 * https://github.com/vercel/next.js/blob/canary/test/integration/image-optimizer/test/index.test.ts
 */
declare function parseImageParams(url: URL, allowedWidths?: number[], allowedQualities?: number[], options?: ParseImageParamsOptions): {
  imageUrl: string;
  width: number;
  quality: number;
} | null;
/**
 * Negotiate the best output format based on the Accept header.
 * Returns an IANA media type.
 */
declare function negotiateImageFormat(acceptHeader: string | null): string;
/**
 * Standard Cache-Control header for optimized images.
 * Optimized images are immutable because the URL encodes the transform params.
 */
declare const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/**
 * Content-Security-Policy for image optimization responses.
 * Blocks script execution and framing to prevent XSS via SVG or other
 * active content that might be served through the image endpoint.
 * Matches Next.js default: script-src 'none'; frame-src 'none'; sandbox;
 */
declare const IMAGE_CONTENT_SECURITY_POLICY = "script-src 'none'; frame-src 'none'; sandbox;";
/**
 * Check if a Content-Type header value is a safe image type.
 * Returns false for SVG (unless dangerouslyAllowSVG is true), HTML, or any non-image type.
 */
declare function isSafeImageContentType(contentType: string | null, dangerouslyAllowSVG?: boolean): boolean;
/**
 * Handlers for image optimization I/O operations.
 * Workers provide these callbacks to adapt their specific bindings.
 */
type ImageHandlers = {
  /** Fetch the source image from storage (e.g., Cloudflare ASSETS binding). */fetchAsset: (path: string, request: Request) => Promise<Response>; /** Optional: Transform the image (resize, format, quality). */
  transformImage?: (body: ReadableStream, options: {
    width: number;
    format: string;
    quality: number;
  }) => Promise<Response>;
};
/**
 * Handle image optimization requests.
 *
 * Parses and validates the request, fetches the source image via the provided
 * handlers, optionally transforms it, and returns the response with appropriate
 * cache headers.
 */
declare function handleImageOptimization(request: Request, handlers: ImageHandlers, allowedWidths?: number[], imageConfig?: ImageConfig): Promise<Response>;
/**
 * A server-side image optimizer: the transform backend that resizes/transcodes
 * a source image. Produced by an adapter factory (e.g. `imagesOptimizer()` from
 * `@vinext/cloudflare/images/images-optimizer`) and registered via
 * {@link setImageOptimizer}.
 */
type ImageOptimizer = {
  /** Transform the source image (resize, format, quality). */transformImage: (body: ReadableStream, options: {
    width: number;
    format: string;
    quality: number;
  }) => Promise<Response>;
};
/**
 * Register the active image optimizer (transform backend). An explicit
 * registration always wins; passing `null` clears it (falling back to
 * unoptimized passthrough).
 *
 * Configure this declaratively via the `images.optimizer` option on the
 * `vinext()` plugin in your `vite.config.ts` rather than calling it directly.
 * On Cloudflare Workers:
 *
 * ```ts
 * import { vinext } from "vinext";
 * import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
 *
 * export default defineConfig({
 *   plugins: [vinext({ images: { optimizer: imagesOptimizer() } })],
 * });
 * ```
 *
 * The plugin registers the optimizer across every runtime/router entry, so you
 * don't have to wire `env.IMAGES` into a custom worker entry. This setter
 * remains the internal registration target.
 */
declare function setImageOptimizer(optimizer: ImageOptimizer | null): void;
/** Get the active image optimizer, or `null` when none is configured. */
declare function getImageOptimizer(): ImageOptimizer | null;
/**
 * Handle an image optimization request using the configured optimizer (if any).
 *
 * This is the single entry point every runtime/router seam (App Router worker,
 * Pages worker, Node prod server) should call: it reads the registered
 * {@link ImageOptimizer} and wires its `transformImage` into
 * {@link handleImageOptimization}, with the caller supplying the runtime's
 * `fetchAsset` (e.g. the Cloudflare `ASSETS` binding, or filesystem reads on
 * Node). When no optimizer is registered, the request is served unoptimized
 * (passthrough) with the same security/cache headers.
 */
declare function handleConfiguredImageOptimization(request: Request, fetchAsset: (path: string, request: Request) => Promise<Response>, allowedWidths?: number[], imageConfig?: ImageConfig): Promise<Response>;
//#endregion
export { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, IMAGE_CACHE_CONTROL, IMAGE_CONTENT_SECURITY_POLICY, IMAGE_OPTIMIZATION_PATH, ImageConfig, ImageHandlers, ImageOptimizer, ParseImageParamsOptions, VINEXT_IMAGE_OPTIMIZATION_PATH, getImageOptimizer, handleConfiguredImageOptimization, handleImageOptimization, isImageOptimizationPath, isSafeImageContentType, negotiateImageFormat, parseImageParams, resolveDevImageRedirect, setImageOptimizer };