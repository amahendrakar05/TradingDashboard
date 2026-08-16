"use client";
import { getDeploymentId } from "../utils/deployment-id.js";
import { useMergedRef } from "./use-merged-ref.js";
import { hasRemoteMatch, isPrivateIp } from "./image-config.js";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { jsx } from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import { Image as Image$1 } from "@unpic/react";
//#region src/shims/image.tsx
/**
* next/image shim
*
* Translates Next.js Image props to @unpic/react Image component.
* @unpic/react auto-detects CDN from URL and uses native transforms.
* For local images (relative paths), routes through `/_next/image`
* for server-side optimization (resize, format negotiation, quality).
*
* Remote images are validated against `images.remotePatterns` and
* `images.domains` from next.config.js. Unmatched URLs are blocked
* in production and warn in development, matching Next.js behavior.
*/
/**
* Image config injected at build time via Vite define.
* Serialized as JSON — parsed once at module level.
*/
const __imageRemotePatterns = (() => {
	try {
		return JSON.parse(process.env.__VINEXT_IMAGE_REMOTE_PATTERNS ?? "[]");
	} catch {
		return [];
	}
})();
const __imageDomains = (() => {
	try {
		return JSON.parse(process.env.__VINEXT_IMAGE_DOMAINS ?? "[]");
	} catch {
		return [];
	}
})();
const __hasImageConfig = __imageRemotePatterns.length > 0 || __imageDomains.length > 0;
const __isDev = process.env.NODE_ENV !== "production";
const __imageDeviceSizes = (() => {
	try {
		return JSON.parse(process.env.__VINEXT_IMAGE_DEVICE_SIZES ?? "[640,750,828,1080,1200,1920,2048,3840]");
	} catch {
		return [
			640,
			750,
			828,
			1080,
			1200,
			1920,
			2048,
			3840
		];
	}
})();
const __imageSizes = (() => {
	try {
		return JSON.parse(process.env.__VINEXT_IMAGE_SIZES ?? "[16,32,48,64,96,128,256,384]");
	} catch {
		return [
			16,
			32,
			48,
			64,
			96,
			128,
			256,
			384
		];
	}
})();
/**
* Whether dangerouslyAllowSVG is enabled in next.config.js.
* When false (default), .svg sources auto-skip the optimization endpoint
* and are served directly, matching Next.js behavior.
* When true, .svg sources are routed through the optimizer (served as-is
* with security headers).
*/
const __dangerouslyAllowSVG = process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_SVG === "true";
/**
* Whether dangerouslyAllowLocalIP is enabled in next.config.js.
* When false (default), remote image URLs with literal private-IP hostnames
* are blocked to mitigate SSRF risk.
*/
const __dangerouslyAllowLocalIP = process.env.__VINEXT_IMAGE_DANGEROUSLY_ALLOW_LOCAL_IP === "true";
const __globallyUnoptimized = process.env.__VINEXT_IMAGE_UNOPTIMIZED === "true";
/**
* Validate that a remote URL is allowed by the configured remote patterns.
* Returns true if the URL is allowed, false otherwise.
*
* When no remotePatterns/domains are configured, all remote URLs are allowed
* (backwards-compatible — user hasn't opted into restriction).
*
* When patterns ARE configured, only matching URLs are allowed.
* In development, non-matching URLs produce a console warning.
* In production, non-matching URLs are blocked (src replaced with empty string).
*
* Private-IP hostnames are additionally rejected unless dangerouslyAllowLocalIP
* is set, mirroring Next.js's fetchExternalImage guard.
*/
function validateRemoteUrl(src) {
	let url;
	try {
		url = new URL(src, "http://n");
	} catch {
		return {
			allowed: false,
			reason: `Invalid URL: ${src}`
		};
	}
	if (!__dangerouslyAllowLocalIP && isPrivateIp(url.hostname)) return {
		allowed: false,
		reason: `Image URL "${src}" resolved to private IP. If this is expected and you understand SSRF risk, use images.dangerouslyAllowLocalIP = true to continue.`
	};
	if (!__hasImageConfig) return { allowed: true };
	if (hasRemoteMatch(__imageDomains, __imageRemotePatterns, url)) return { allowed: true };
	return {
		allowed: false,
		reason: `Image URL "${src}" is not configured in images.remotePatterns or images.domains in next.config.js. See: https://nextjs.org/docs/messages/next-image-unconfigured-host`
	};
}
/**
* A version of useLayoutEffect that doesn't warn during SSR.
* Do not rename this to "isomorphic layout effect". There is no such thing as
* an isomorphic Layout Effect since there is no Layout on the server.
* Ported from Next.js: https://github.com/vercel/next.js/pull/93209
*/
const useNonWarningLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/**
* Create a synthetic React load event for replaying onLoad/onLoadingComplete
* during hydration when the image already completed loading.
*
* This function creates a native Event("load") via the DOM Event constructor
* and must only be called in a browser context (client-side layout effect).
* It mirrors the pattern used in Next.js `handleLoading`.
*/
function createSyntheticLoadEvent(img) {
	const nativeEvent = new Event("load");
	Object.defineProperty(nativeEvent, "target", {
		writable: false,
		value: img
	});
	let prevented = false;
	let stopped = false;
	return {
		bubbles: nativeEvent.bubbles,
		cancelable: nativeEvent.cancelable,
		currentTarget: img,
		defaultPrevented: false,
		eventPhase: nativeEvent.eventPhase,
		isTrusted: false,
		nativeEvent,
		target: img,
		timeStamp: nativeEvent.timeStamp,
		type: "load",
		isDefaultPrevented: () => prevented,
		isPropagationStopped: () => stopped,
		persist: () => {},
		preventDefault: () => {
			prevented = true;
			nativeEvent.preventDefault();
		},
		stopPropagation: () => {
			stopped = true;
			nativeEvent.stopPropagation();
		}
	};
}
/**
* Sanitize a blurDataURL to prevent CSS injection.
*
* A crafted data URL containing `)` can break out of the `url()` CSS function,
* allowing injection of arbitrary CSS properties or rules. Characters like `{`,
* `}`, and `\` can also assist in crafting injection payloads.
*
* This validates the URL starts with `data:image/` and rejects characters that
* could escape the `url()` context. Semicolons are allowed since they're part
* of valid data URLs (`data:image/png;base64,...`) and harmless inside `url()`.
*
* Returns undefined for invalid URLs, which causes the blur placeholder to be
* skipped gracefully.
*/
function sanitizeBlurDataURL(url) {
	if (!url.startsWith("data:image/")) return void 0;
	if (/[)(}{\\'"\n\r]/.test(url)) return void 0;
	return url;
}
/**
* Determine if a src is a remote URL (CDN-optimizable) or local.
*/
function isRemoteUrl(src) {
	return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//");
}
function isSvgUrl(src) {
	try {
		return new URL(src, "http://vinext.local").pathname.toLowerCase().endsWith(".svg");
	} catch {
		return false;
	}
}
function getFillStyle(style, backgroundStyle) {
	return {
		position: "absolute",
		inset: 0,
		width: "100%",
		height: "100%",
		objectFit: "cover",
		...backgroundStyle,
		...style
	};
}
/**
* Resolve src, width, height, blurDataURL from Image props (string or StaticImageData).
* Shared by the Image component and getImageProps to keep behavior in sync.
*/
function resolveImageSource(v) {
	const staticData = typeof v.src === "object" && "default" in v.src ? v.src.default : v.src;
	const src = typeof staticData === "string" ? staticData : staticData.src;
	const sourceWidth = v.width ?? (typeof staticData === "object" ? staticData.width : void 0);
	const sourceHeight = v.height ?? (typeof staticData === "object" ? staticData.height : void 0);
	return {
		src,
		width: typeof sourceWidth === "string" ? Number(sourceWidth) : sourceWidth,
		height: typeof sourceHeight === "string" ? Number(sourceHeight) : sourceHeight,
		blurDataURL: v.blurDataURL ?? (typeof staticData === "object" ? staticData.blurDataURL : void 0)
	};
}
/**
* Responsive image widths matching Next.js's device sizes config.
* These are the breakpoints used for srcSet generation.
* Configurable via `images.deviceSizes` in next.config.js.
*/
const RESPONSIVE_WIDTHS = [...__imageDeviceSizes].sort((left, right) => left - right);
const ALL_IMAGE_WIDTHS = [...RESPONSIVE_WIDTHS, ...__imageSizes].sort((left, right) => left - right);
function extractLocalDeploymentId(src) {
	let deploymentId = getDeploymentId();
	if (!src.startsWith("/") || src.startsWith("//")) return {
		src,
		deploymentId
	};
	const queryIndex = src.indexOf("?");
	if (queryIndex === -1) return {
		src,
		deploymentId
	};
	const params = new URLSearchParams(src.slice(queryIndex + 1));
	const sourceDeploymentId = params.get("dpl");
	if (!sourceDeploymentId) return {
		src,
		deploymentId
	};
	deploymentId = sourceDeploymentId;
	params.delete("dpl");
	const remainingQuery = params.toString();
	return {
		src: src.slice(0, queryIndex) + (remainingQuery ? `?${remainingQuery}` : ""),
		deploymentId
	};
}
/**
* Build a `/_next/image` optimization URL.
*
* In production (Cloudflare Workers), the worker intercepts this path and uses
* the Images binding to resize/transcode on the fly. In dev, the Vite dev
* server handles it as a passthrough (serves the original file).
*/
function imageOptimizationUrl(src, width, quality = 75) {
	const source = extractLocalDeploymentId(src);
	const deploymentQuery = source.src.startsWith("/") && source.deploymentId ? `&dpl=${source.deploymentId}` : "";
	return `/_next/image?url=${encodeURIComponent(source.src)}&w=${width}&q=${quality}${deploymentQuery}`;
}
function preloadImageResource(input) {
	if (!input.shouldPreload) return;
	if (typeof ReactDOM.preload !== "function") return;
	ReactDOM.preload(input.src, {
		as: "image",
		imageSrcSet: input.srcSet,
		imageSizes: input.sizes,
		fetchPriority: input.fetchPriority
	});
}
/**
* Generate a srcSet string for responsive images.
*
* Each width points to the `/_next/image` optimization endpoint so the
* server can resize and transcode the image.
*/
function getImageWidths(width) {
	return [...new Set([width, width * 2].map((targetWidth) => ALL_IMAGE_WIDTHS.find((configuredWidth) => configuredWidth >= targetWidth) ?? ALL_IMAGE_WIDTHS[ALL_IMAGE_WIDTHS.length - 1]))];
}
function generateImageAttributes(src, width, quality = 75, sizes) {
	if (sizes) {
		const viewportPercentages = Array.from(sizes.matchAll(/(^|\s)(1?\d?\d)vw/g), (match) => Number.parseInt(match[2], 10));
		const minimumWidth = viewportPercentages.length > 0 ? RESPONSIVE_WIDTHS[0] * (Math.min(...viewportPercentages) * .01) : 0;
		const candidates = ALL_IMAGE_WIDTHS.filter((candidateWidth) => candidateWidth >= minimumWidth);
		return {
			src: imageOptimizationUrl(src, candidates[candidates.length - 1], quality),
			srcSet: candidates.map((candidateWidth) => `${imageOptimizationUrl(src, candidateWidth, quality)} ${candidateWidth}w`).join(", ")
		};
	}
	const widths = getImageWidths(width);
	return {
		src: imageOptimizationUrl(src, widths[widths.length - 1], quality),
		srcSet: widths.map((candidateWidth, index) => `${imageOptimizationUrl(src, candidateWidth, quality)} ${index + 1}x`).join(", ")
	};
}
const Image = forwardRef(function Image({ src: srcProp, alt, width, height, fill, preload, priority, quality, placeholder, blurDataURL, loader, sizes, className, style, onLoad, onLoadingComplete, onError, unoptimized: _unoptimized, overrideSrc, loading, ...rest }, ref) {
	const lastLoadedSrcRef = useRef(void 0);
	const lastErrorSrcRef = useRef(void 0);
	const didInsertRef = useRef(false);
	const imgElementRef = useRef(null);
	const mergedRef = useMergedRef(ref, imgElementRef);
	const onLoadRef = useRef(onLoad);
	useEffect(() => {
		onLoadRef.current = onLoad;
	}, [onLoad]);
	const onErrorRef = useRef(onError);
	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);
	const onLoadingCompleteRef = useRef(onLoadingComplete);
	useEffect(() => {
		onLoadingCompleteRef.current = onLoadingComplete;
	}, [onLoadingComplete]);
	const { src, width: imgWidth, height: imgHeight, blurDataURL: imgBlurDataURL } = resolveImageSource({
		src: srcProp,
		width,
		height,
		blurDataURL
	});
	const shouldPreload = preload === true || priority === true;
	const priorityFetchPriority = priority ? "high" : void 0;
	const imageLoading = priority ? "eager" : shouldPreload ? loading : loading ?? "lazy";
	const [completedBlurSrc, setCompletedBlurSrc] = useState(void 0);
	const blurComplete = completedBlurSrc === src;
	const markBlurComplete = () => {
		if (placeholder !== "blur") return;
		setCompletedBlurSrc((current) => current === src ? current : src);
	};
	useNonWarningLayoutEffect(() => {
		if (!didInsertRef.current && imgElementRef.current !== null) {
			const img = imgElementRef.current;
			if (onErrorRef.current) img.src = img.src;
			if (img.complete && img.naturalWidth > 0) {
				markBlurComplete();
				const currentOnLoad = onLoadRef.current;
				const currentOnLoadingComplete = onLoadingCompleteRef.current;
				if (currentOnLoad || currentOnLoadingComplete) {
					if (lastLoadedSrcRef.current !== src) {
						lastLoadedSrcRef.current = src;
						const syntheticEvent = createSyntheticLoadEvent(img);
						currentOnLoad?.(syntheticEvent);
						currentOnLoadingComplete?.(img);
					}
				}
			}
			didInsertRef.current = true;
		}
	}, [
		placeholder,
		sizes,
		_unoptimized
	]);
	const handleLoad = onLoadingComplete ? (e) => {
		if (lastLoadedSrcRef.current === src) return;
		lastLoadedSrcRef.current = src;
		markBlurComplete();
		onLoad?.(e);
		onLoadingComplete(e.currentTarget);
	} : onLoad ? (e) => {
		if (lastLoadedSrcRef.current === src) return;
		lastLoadedSrcRef.current = src;
		markBlurComplete();
		onLoad(e);
	} : placeholder === "blur" ? () => {
		if (lastLoadedSrcRef.current === src) return;
		lastLoadedSrcRef.current = src;
		markBlurComplete();
	} : void 0;
	const handleError = onError ? (e) => {
		if (lastErrorSrcRef.current === src) return;
		lastErrorSrcRef.current = src;
		markBlurComplete();
		onError(e);
	} : placeholder === "blur" ? () => {
		if (lastErrorSrcRef.current === src) return;
		lastErrorSrcRef.current = src;
		markBlurComplete();
	} : void 0;
	if (_unoptimized === true || __globallyUnoptimized) {
		const renderedSrc = overrideSrc || src;
		const sanitizedBlur = imgBlurDataURL ? sanitizeBlurDataURL(imgBlurDataURL) : void 0;
		const blurStyle = !blurComplete && placeholder === "blur" && sanitizedBlur ? {
			backgroundImage: `url(${sanitizedBlur})`,
			backgroundSize: "cover",
			backgroundRepeat: "no-repeat",
			backgroundPosition: "center"
		} : void 0;
		preloadImageResource({
			shouldPreload,
			src: renderedSrc,
			fetchPriority: priorityFetchPriority
		});
		return /* @__PURE__ */ jsx("img", {
			ref: mergedRef,
			src: renderedSrc,
			alt,
			width: fill ? void 0 : imgWidth,
			height: fill ? void 0 : imgHeight,
			loading: imageLoading,
			fetchPriority: priorityFetchPriority,
			decoding: "async",
			className,
			"data-nimg": fill ? "fill" : "1",
			onLoad: handleLoad,
			onError: handleError,
			style: fill ? getFillStyle(style, blurStyle) : {
				...blurStyle,
				...style
			},
			...rest
		});
	}
	if (loader) {
		const resolvedQuality = typeof quality === "string" ? Number(quality) : quality ?? 75;
		const resolvedSrc = loader({
			src,
			width: imgWidth ?? 0,
			quality: resolvedQuality
		});
		preloadImageResource({
			shouldPreload,
			src: resolvedSrc,
			sizes,
			fetchPriority: priorityFetchPriority
		});
		return /* @__PURE__ */ jsx("img", {
			ref: mergedRef,
			src: resolvedSrc,
			alt,
			width: fill ? void 0 : imgWidth,
			height: fill ? void 0 : imgHeight,
			loading: imageLoading,
			decoding: "async",
			sizes,
			className,
			onLoad: handleLoad,
			onError: handleError,
			style: fill ? getFillStyle(style) : style,
			...rest
		});
	}
	if (isRemoteUrl(src)) {
		const validation = validateRemoteUrl(src);
		if (!validation.allowed) if (__isDev) console.warn(`[next/image] ${validation.reason}`);
		else {
			console.error(`[next/image] ${validation.reason}`);
			return null;
		}
		const sanitizedBlur = imgBlurDataURL ? sanitizeBlurDataURL(imgBlurDataURL) : void 0;
		const showBlur = !blurComplete && placeholder === "blur" && sanitizedBlur;
		const blurStyle = showBlur ? {
			backgroundImage: `url(${sanitizedBlur})`,
			backgroundSize: "cover",
			backgroundRepeat: "no-repeat",
			backgroundPosition: "center"
		} : void 0;
		const bg = showBlur ? `url(${sanitizedBlur})` : void 0;
		if (fill) {
			const imageSizes = sizes ?? "100vw";
			preloadImageResource({
				shouldPreload,
				src,
				sizes: imageSizes,
				fetchPriority: priorityFetchPriority
			});
			return /* @__PURE__ */ jsx("img", {
				ref: mergedRef,
				src,
				alt,
				loading: imageLoading,
				fetchPriority: priorityFetchPriority,
				decoding: "async",
				sizes: imageSizes,
				className,
				"data-nimg": "fill",
				onLoad: handleLoad,
				onError: handleError,
				style: getFillStyle(style, blurStyle),
				...rest
			});
		}
		if (imgWidth && imgHeight) {
			const unpicRuntimeStyleProps = { style };
			preloadImageResource({
				shouldPreload,
				src,
				sizes,
				fetchPriority: priorityFetchPriority
			});
			return /* @__PURE__ */ jsx(Image$1, {
				src,
				alt,
				width: imgWidth,
				height: imgHeight,
				layout: "constrained",
				loading: imageLoading,
				fetchPriority: priorityFetchPriority,
				sizes,
				className,
				...unpicRuntimeStyleProps,
				background: bg,
				onLoad: handleLoad,
				onError: handleError,
				ref: mergedRef
			});
		}
	}
	const imgQuality = typeof quality === "string" ? Number(quality) : quality ?? 75;
	const skipOptimization = isSvgUrl(src) && !__dangerouslyAllowSVG;
	const optimizedAttributes = imgWidth && !fill && !skipOptimization ? generateImageAttributes(src, imgWidth, imgQuality, sizes) : void 0;
	const srcSet = optimizedAttributes ? optimizedAttributes.srcSet : imgWidth && !fill ? RESPONSIVE_WIDTHS.filter((w) => w <= imgWidth * 2).map((w) => `${src} ${w}w`).join(", ") || `${src} ${imgWidth}w` : void 0;
	const optimizedSrc = skipOptimization ? src : optimizedAttributes ? optimizedAttributes.src : imageOptimizationUrl(src, RESPONSIVE_WIDTHS[0], imgQuality);
	const sanitizedLocalBlur = imgBlurDataURL ? sanitizeBlurDataURL(imgBlurDataURL) : void 0;
	const blurStyle = !blurComplete && placeholder === "blur" && sanitizedLocalBlur ? {
		backgroundImage: `url(${sanitizedLocalBlur})`,
		backgroundSize: "cover",
		backgroundRepeat: "no-repeat",
		backgroundPosition: "center"
	} : void 0;
	const imageSizes = sizes ?? (fill ? "100vw" : void 0);
	preloadImageResource({
		shouldPreload,
		src: optimizedSrc,
		srcSet,
		sizes: imageSizes,
		fetchPriority: priorityFetchPriority
	});
	return /* @__PURE__ */ jsx("img", {
		ref: mergedRef,
		src: optimizedSrc,
		alt,
		width: fill ? void 0 : imgWidth,
		height: fill ? void 0 : imgHeight,
		loading: imageLoading,
		fetchPriority: priorityFetchPriority,
		decoding: "async",
		srcSet,
		sizes: imageSizes,
		className,
		"data-nimg": fill ? "fill" : "1",
		onLoad: handleLoad,
		onError: handleError,
		style: fill ? getFillStyle(style, blurStyle) : {
			...blurStyle,
			...style
		},
		...rest
	});
});
/**
* getImageProps — for advanced use cases (picture elements, background images).
* Returns the props that would be passed to the underlying <img> element.
*/
function getImageProps(props) {
	const { src: srcProp, alt, width, height, fill, preload: _preload, priority, quality: _quality, placeholder, blurDataURL: blurDataURLProp, loader, sizes, className, style, onLoad: _onLoad, onLoadingComplete: _onLoadingComplete, unoptimized: _unoptimized, overrideSrc, loading, ...rest } = props;
	const { src, width: imgWidth, height: imgHeight, blurDataURL: imgBlurDataURL } = resolveImageSource({
		src: srcProp,
		width,
		height,
		blurDataURL: blurDataURLProp
	});
	const shouldPreload = _preload === true || priority === true;
	if (_unoptimized === true || __globallyUnoptimized) {
		const renderedSrc = overrideSrc || src;
		const sanitizedBlurURL = imgBlurDataURL ? sanitizeBlurDataURL(imgBlurDataURL) : void 0;
		const blurStyle = placeholder === "blur" && sanitizedBlurURL ? {
			backgroundImage: `url(${sanitizedBlurURL})`,
			backgroundSize: "cover",
			backgroundRepeat: "no-repeat",
			backgroundPosition: "center"
		} : void 0;
		const imageProps = {
			src: renderedSrc,
			alt,
			width: fill ? void 0 : imgWidth,
			height: fill ? void 0 : imgHeight,
			loading: priority ? "eager" : shouldPreload ? loading : loading ?? "lazy",
			fetchPriority: priority ? "high" : void 0,
			decoding: "async",
			className,
			style: fill ? getFillStyle(style, blurStyle) : {
				...blurStyle,
				...style
			},
			...rest,
			sizes: sizes ?? (fill ? "100vw" : void 0),
			srcSet: void 0
		};
		return { props: Object.assign(imageProps, { "data-nimg": fill ? "fill" : "1" }) };
	}
	let blockedInProd = false;
	if (isRemoteUrl(src)) {
		const validation = validateRemoteUrl(src);
		if (!validation.allowed) if (__isDev) console.warn(`[next/image] ${validation.reason}`);
		else {
			console.error(`[next/image] ${validation.reason}`);
			blockedInProd = true;
		}
	}
	const imgQuality = typeof _quality === "string" ? Number(_quality) : _quality ?? 75;
	const resolvedSrc = blockedInProd ? "" : loader ? loader({
		src,
		width: imgWidth ?? 0,
		quality: imgQuality
	}) : src;
	const skipOpt = isSvgUrl(resolvedSrc) && !__dangerouslyAllowSVG || blockedInProd || !!loader || isRemoteUrl(resolvedSrc);
	const optimizedAttributes = imgWidth && !fill && !skipOpt ? generateImageAttributes(resolvedSrc, imgWidth, imgQuality, sizes) : null;
	const optimizedSrc = skipOpt ? resolvedSrc : optimizedAttributes ? optimizedAttributes.src : imageOptimizationUrl(resolvedSrc, RESPONSIVE_WIDTHS[0], imgQuality);
	const srcSet = optimizedAttributes?.srcSet;
	const sanitizedBlurURL = imgBlurDataURL ? sanitizeBlurDataURL(imgBlurDataURL) : void 0;
	const blurStyle = placeholder === "blur" && sanitizedBlurURL ? {
		backgroundImage: `url(${sanitizedBlurURL})`,
		backgroundSize: "cover",
		backgroundRepeat: "no-repeat",
		backgroundPosition: "center"
	} : void 0;
	const imageProps = {
		src: optimizedSrc,
		alt,
		width: fill ? void 0 : imgWidth,
		height: fill ? void 0 : imgHeight,
		loading: priority ? "eager" : shouldPreload ? loading : loading ?? "lazy",
		fetchPriority: priority ? "high" : void 0,
		decoding: "async",
		srcSet,
		sizes: sizes ?? (fill ? "100vw" : void 0),
		className,
		style: fill ? getFillStyle(style, blurStyle) : {
			...blurStyle,
			...style
		},
		...rest
	};
	return { props: Object.assign(imageProps, { "data-nimg": fill ? "fill" : "1" }) };
}
//#endregion
export { Image as default, getImageProps, imageOptimizationUrl };
