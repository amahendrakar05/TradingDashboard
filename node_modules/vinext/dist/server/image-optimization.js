import { badRequestResponse } from "./http-error-responses.js";
//#region src/server/image-optimization.ts
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
const IMAGE_OPTIMIZATION_PATH = "/_next/image";
/**
* Vinext-prefixed alias for the image optimization endpoint. Accepted
* alongside IMAGE_OPTIMIZATION_PATH so apps that wire image URLs to the
* vinext-prefixed path continue to work; emit IMAGE_OPTIMIZATION_PATH
* for any newly generated URLs.
*/
const VINEXT_IMAGE_OPTIMIZATION_PATH = "/_vinext/image";
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
function isImageOptimizationPath(pathname) {
	if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
	return pathname === "/_next/image" || pathname === "/_vinext/image";
}
/**
* Next.js default device sizes and image sizes.
* These are the allowed widths for image optimization when no custom
* config is provided. Matches Next.js defaults exactly.
*/
const DEFAULT_DEVICE_SIZES = [
	640,
	750,
	828,
	1080,
	1200,
	1920,
	2048,
	3840
];
const DEFAULT_IMAGE_SIZES = [
	16,
	32,
	48,
	64,
	96,
	128,
	256,
	384
];
const DEV_BLUR_MAX_WIDTH = 8;
const DEV_BLUR_QUALITY = 70;
function resolveDevImageRedirect(requestUrl, allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES], allowedQualities, options = { isDev: true }) {
	const params = parseImageParams(requestUrl, allowedWidths, allowedQualities, options);
	if (!params) return null;
	if (params.imageUrl.startsWith("/@") || params.imageUrl.startsWith("/__vite") || params.imageUrl.startsWith("/node_modules")) return null;
	const resolved = new URL(params.imageUrl, requestUrl.origin);
	if (resolved.origin !== requestUrl.origin) return null;
	return resolved.pathname + resolved.search;
}
/**
* Parse and validate image optimization query parameters.
* Returns null if the request is malformed.
*
* Ported from Next.js:
* test/integration/image-optimizer/test/index.test.ts
* https://github.com/vercel/next.js/blob/canary/test/integration/image-optimizer/test/index.test.ts
*/
function parseImageParams(url, allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES], allowedQualities, options = {}) {
	const allowedParamNames = /* @__PURE__ */ new Set([
		"url",
		"w",
		"q",
		"dpl"
	]);
	for (const name of url.searchParams.keys()) if (!allowedParamNames.has(name) || url.searchParams.getAll(name).length !== 1) return null;
	const imageUrl = url.searchParams.get("url");
	if (!imageUrl) return null;
	if (imageUrl.length > 3072) return null;
	const widthParam = url.searchParams.get("w");
	const qualityParam = url.searchParams.get("q");
	if (!widthParam || !/^[0-9]+$/.test(widthParam)) return null;
	if (!qualityParam || !/^[0-9]+$/.test(qualityParam)) return null;
	const width = Number.parseInt(widthParam, 10);
	const quality = Number.parseInt(qualityParam, 10);
	if (String(width) !== widthParam || String(quality) !== qualityParam) return null;
	const isDevBlurWidth = options.isDev && width <= DEV_BLUR_MAX_WIDTH;
	const isDevBlurQuality = options.isDev && quality === DEV_BLUR_QUALITY;
	if (width <= 0 || !allowedWidths.includes(width) && !isDevBlurWidth) return null;
	if (quality < 1 || quality > 100) return null;
	if (allowedQualities && !allowedQualities.includes(quality) && !isDevBlurQuality) return null;
	const normalizedUrl = imageUrl.replaceAll("\\", "/");
	if (!normalizedUrl.startsWith("/") || normalizedUrl.startsWith("//")) return null;
	try {
		const base = "https://localhost";
		if (new URL(normalizedUrl, base).origin !== base) return null;
	} catch {
		return null;
	}
	return {
		imageUrl: normalizedUrl,
		width,
		quality
	};
}
/**
* Negotiate the best output format based on the Accept header.
* Returns an IANA media type.
*/
function negotiateImageFormat(acceptHeader) {
	if (!acceptHeader) return "image/jpeg";
	if (acceptHeader.includes("image/avif")) return "image/avif";
	if (acceptHeader.includes("image/webp")) return "image/webp";
	return "image/jpeg";
}
/**
* Standard Cache-Control header for optimized images.
* Optimized images are immutable because the URL encodes the transform params.
*/
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
/**
* Content-Security-Policy for image optimization responses.
* Blocks script execution and framing to prevent XSS via SVG or other
* active content that might be served through the image endpoint.
* Matches Next.js default: script-src 'none'; frame-src 'none'; sandbox;
*/
const IMAGE_CONTENT_SECURITY_POLICY = "script-src 'none'; frame-src 'none'; sandbox;";
/**
* Allowlist of Content-Types that are safe to serve from the image endpoint.
* SVG is intentionally excluded — it can contain embedded JavaScript and is
* essentially an XML document, not a safe raster image format.
*/
const SAFE_IMAGE_CONTENT_TYPES = /* @__PURE__ */ new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/x-icon",
	"image/vnd.microsoft.icon",
	"image/bmp",
	"image/tiff"
]);
/**
* Check if a Content-Type header value is a safe image type.
* Returns false for SVG (unless dangerouslyAllowSVG is true), HTML, or any non-image type.
*/
function isSafeImageContentType(contentType, dangerouslyAllowSVG = false) {
	if (!contentType) return false;
	const mediaType = contentType.split(";")[0].trim().toLowerCase();
	if (SAFE_IMAGE_CONTENT_TYPES.has(mediaType)) return true;
	if (dangerouslyAllowSVG && mediaType === "image/svg+xml") return true;
	return false;
}
/**
* Apply security headers to an image optimization response.
* These headers are set on every response from the image endpoint,
* regardless of whether the image was transformed or served as-is.
* When an ImageConfig is provided, uses its values for CSP and Content-Disposition.
*/
function setImageSecurityHeaders(headers, config) {
	headers.set("Content-Security-Policy", config?.contentSecurityPolicy ?? "script-src 'none'; frame-src 'none'; sandbox;");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Content-Disposition", config?.contentDispositionType === "attachment" ? "attachment" : "inline");
}
function createPassthroughImageResponse(source, config) {
	const headers = new Headers(source.headers);
	headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
	headers.set("Vary", "Accept");
	setImageSecurityHeaders(headers, config);
	return new Response(source.body, {
		status: 200,
		headers
	});
}
/**
* Handle image optimization requests.
*
* Parses and validates the request, fetches the source image via the provided
* handlers, optionally transforms it, and returns the response with appropriate
* cache headers.
*/
async function handleImageOptimization(request, handlers, allowedWidths, imageConfig) {
	const params = parseImageParams(new URL(request.url), allowedWidths, imageConfig?.qualities);
	if (!params) return badRequestResponse();
	const { imageUrl, width, quality } = params;
	const source = await handlers.fetchAsset(imageUrl, request);
	if (!source.ok || !source.body) return new Response("Image not found", { status: 404 });
	const format = negotiateImageFormat(request.headers.get("Accept"));
	const sourceContentType = source.headers.get("Content-Type");
	if (!isSafeImageContentType(sourceContentType, imageConfig?.dangerouslyAllowSVG)) return new Response("The requested resource is not an allowed image type", { status: 400 });
	if (sourceContentType?.split(";")[0].trim().toLowerCase() === "image/svg+xml") return createPassthroughImageResponse(source, imageConfig);
	if (handlers.transformImage) try {
		const transformed = await handlers.transformImage(source.body, {
			width,
			format,
			quality
		});
		const headers = new Headers(transformed.headers);
		headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
		headers.set("Vary", "Accept");
		setImageSecurityHeaders(headers, imageConfig);
		if (!isSafeImageContentType(headers.get("Content-Type"), imageConfig?.dangerouslyAllowSVG)) headers.set("Content-Type", format);
		return new Response(transformed.body, {
			status: 200,
			headers
		});
	} catch (e) {
		console.error("[vinext] Image optimization error:", e);
	}
	try {
		return createPassthroughImageResponse(source, imageConfig);
	} catch (e) {
		console.error("[vinext] Image fallback error, refetching source image:", e);
		const refetchedSource = await handlers.fetchAsset(imageUrl, request);
		if (!refetchedSource.ok || !refetchedSource.body) return new Response("Image not found", { status: 404 });
		if (!isSafeImageContentType(refetchedSource.headers.get("Content-Type"), imageConfig?.dangerouslyAllowSVG)) return new Response("The requested resource is not an allowed image type", { status: 400 });
		return createPassthroughImageResponse(refetchedSource, imageConfig);
	}
}
const _IMAGE_OPTIMIZER_KEY = Symbol.for("vinext.imageOptimizer");
const _gImageOptimizer = globalThis;
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
function setImageOptimizer(optimizer) {
	_gImageOptimizer[_IMAGE_OPTIMIZER_KEY] = optimizer ?? void 0;
}
/** Get the active image optimizer, or `null` when none is configured. */
function getImageOptimizer() {
	return _gImageOptimizer[_IMAGE_OPTIMIZER_KEY] ?? null;
}
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
function handleConfiguredImageOptimization(request, fetchAsset, allowedWidths, imageConfig) {
	const optimizer = getImageOptimizer();
	return handleImageOptimization(request, {
		fetchAsset,
		transformImage: optimizer ? (body, options) => optimizer.transformImage(body, options) : void 0
	}, allowedWidths, imageConfig);
}
//#endregion
export { DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES, IMAGE_CACHE_CONTROL, IMAGE_CONTENT_SECURITY_POLICY, IMAGE_OPTIMIZATION_PATH, VINEXT_IMAGE_OPTIMIZATION_PATH, getImageOptimizer, handleConfiguredImageOptimization, handleImageOptimization, isImageOptimizationPath, isSafeImageContentType, negotiateImageFormat, parseImageParams, resolveDevImageRedirect, setImageOptimizer };
