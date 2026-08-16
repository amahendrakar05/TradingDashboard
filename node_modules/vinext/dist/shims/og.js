//#region src/shims/og.tsx
const CACHE_HEADERS = {
	noCache: "no-cache, no-store",
	revalidate: "public, max-age=0, must-revalidate"
};
/**
* next/og shim.
*
* The vinext:og-inline-fetch-assets Vite plugin patches @vercel/og's runtime
* asset fetches so this wrapper can delegate image generation while preserving
* Next.js's public ImageResponse headers and option merging semantics.
*/
var ImageResponse = class extends Response {
	static displayName = "ImageResponse";
	constructor(element, options) {
		const readable = new ReadableStream({ async start(controller) {
			const { ImageResponse: VercelImageResponse } = await import("@vercel/og");
			const imageResponse = new VercelImageResponse(element, options);
			if (!imageResponse.body) {
				controller.close();
				return;
			}
			const reader = imageResponse.body.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					return;
				}
				controller.enqueue(value);
			}
		} });
		const headers = new Headers({
			"content-type": "image/png",
			"cache-control": process.env.NODE_ENV === "development" ? CACHE_HEADERS.noCache : CACHE_HEADERS.revalidate
		});
		if (options?.headers) new Headers(options.headers).forEach((value, key) => {
			headers.set(key, value);
		});
		super(readable, {
			headers,
			status: options?.status,
			statusText: options?.statusText
		});
	}
};
//#endregion
export { ImageResponse };
