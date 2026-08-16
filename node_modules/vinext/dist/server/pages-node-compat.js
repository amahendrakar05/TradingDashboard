import { parseCookieHeader } from "../utils/parse-cookie.js";
import { readStreamAsTextWithLimit } from "../utils/text-stream.js";
import { DEFAULT_PAGES_API_BODY_SIZE_LIMIT } from "./pages-body-parser-config.js";
import { PagesBodyParseError, getMediaType, isJsonMediaType } from "./pages-media-type.js";
import { performOnDemandRevalidate } from "./pages-revalidate.js";
import { clearPagesPreviewData, getPagesPreviewState, setPagesDraftMode, setPagesPreviewData } from "./pages-preview.js";
import { decode } from "node:querystring";
import { Readable, Writable } from "node:stream";
//#region src/server/pages-node-compat.ts
const MAX_PAGES_API_BODY_SIZE = DEFAULT_PAGES_API_BODY_SIZE_LIMIT;
async function readPagesRequestBodyWithLimit(request, maxBytes) {
	if (!request.body) return "";
	return readStreamAsTextWithLimit(request.body, maxBytes, () => {
		throw new PagesBodyParseError("Request body too large", 413);
	});
}
/**
* Read and parse a Pages Router API request body for the Workers/prod path.
*
* `maxBytes` defaults to the 1 MB Next.js default but may be overridden by
* `export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }` on
* the route module. Handlers that opt out entirely (`bodyParser: false`)
* MUST skip this function so the body stream stays intact for user code.
*
* @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
*/
async function parsePagesApiBody(request, maxBytes = MAX_PAGES_API_BODY_SIZE) {
	if (Number.parseInt(request.headers.get("content-length") || "0", 10) > maxBytes) throw new PagesBodyParseError("Request body too large", 413);
	let rawBody = "";
	try {
		rawBody = await readPagesRequestBodyWithLimit(request, maxBytes);
	} catch (err) {
		if (err instanceof PagesBodyParseError) throw err;
		throw new PagesBodyParseError("Request body too large", 413);
	}
	const mediaType = getMediaType(request.headers.get("content-type"));
	if (!rawBody) return isJsonMediaType(mediaType) ? {} : mediaType === "application/x-www-form-urlencoded" ? decode(rawBody) : void 0;
	if (isJsonMediaType(mediaType)) try {
		return JSON.parse(rawBody);
	} catch {
		throw new PagesBodyParseError("Invalid JSON", 400);
	}
	if (mediaType === "application/x-www-form-urlencoded") return decode(rawBody);
	return rawBody;
}
async function* requestBodyChunks(request) {
	if (!request.body || request.bodyUsed) return;
	const reader = request.body.getReader();
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) return;
			yield Buffer.from(value.buffer, value.byteOffset, value.byteLength);
		}
	} finally {
		try {
			await reader.cancel();
		} catch {}
		reader.releaseLock();
	}
}
function createRequestReadable(request) {
	return Readable.from(requestBodyChunks(request), { objectMode: false });
}
function parsePagesRequestCookies(cookieHeader) {
	return parseCookieHeader(Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader);
}
function getPagesPreviewDataFromCookieHeader(cookieHeader, options = {}) {
	return getPagesPreviewState(cookieHeader, options).data;
}
function getPagesPreviewData(request, options = {}) {
	return getPagesPreviewDataFromCookieHeader(request.headers.get("cookie"), options);
}
function attachPagesRequestCookies(req) {
	if (Object.hasOwn(req, "cookies")) return;
	Object.defineProperty(req, "cookies", {
		configurable: true,
		enumerable: true,
		get() {
			const cookies = parsePagesRequestCookies(req.headers.cookie);
			Object.defineProperty(req, "cookies", {
				configurable: true,
				enumerable: true,
				value: cookies,
				writable: true
			});
			return cookies;
		},
		set(value) {
			Object.defineProperty(req, "cookies", {
				configurable: true,
				enumerable: true,
				value,
				writable: true
			});
		}
	});
}
function attachPagesPreviewApi(req, res) {
	const preview = getPagesPreviewState(req.headers.cookie);
	req.previewData = preview.data;
	if (preview.data !== false) {
		req.preview = true;
		req.draftMode = true;
	}
	res.setPreviewData = (data, options = {}) => {
		setPagesPreviewData(res, data, options);
		return res;
	};
	res.clearPreviewData = (options = {}) => {
		clearPagesPreviewData(res, options);
		return res;
	};
	res.setDraftMode = (options = { enable: true }) => {
		setPagesDraftMode(res, options.enable !== false);
		return res;
	};
	if (preview.shouldClear) clearPagesPreviewData(res);
}
var PagesResponseStream = class extends Writable {
	resolveResponse;
	rejectResponse;
	requestHeaders;
	resStatusCode = 200;
	resHeaders = {};
	setCookieHeaders = [];
	resolved = false;
	controller = null;
	bufferedChunks = [];
	streamEnded = false;
	constructor(resolveResponse, rejectResponse, requestHeaders) {
		super();
		this.resolveResponse = resolveResponse;
		this.rejectResponse = rejectResponse;
		this.requestHeaders = requestHeaders;
		this.once("error", (err) => {
			if (!this.resolved) {
				this.resolved = true;
				this.rejectResponse(err);
			}
		});
	}
	get statusCode() {
		return this.resStatusCode;
	}
	set statusCode(code) {
		this.resStatusCode = code;
	}
	get headersSent() {
		return this.writableEnded || this.resolved;
	}
	writeHead(code, headers) {
		this.resStatusCode = code;
		if (headers) for (const [key, value] of Object.entries(headers)) this.setHeaderValue(key, value, { replaceSetCookie: false });
		return this;
	}
	setHeader(name, value) {
		this.setHeaderValue(name, value, { replaceSetCookie: true });
		return this;
	}
	getHeader(name) {
		if (name.toLowerCase() === "set-cookie") return this.setCookieHeaders.length > 0 ? this.setCookieHeaders : void 0;
		return this.resHeaders[name.toLowerCase()];
	}
	status(code) {
		this.resStatusCode = code;
		return this;
	}
	json(data) {
		this.resHeaders["content-type"] = "application/json";
		this.end(JSON.stringify(data));
	}
	send(data) {
		if (Buffer.isBuffer(data)) {
			if (!this.resHeaders["content-type"]) this.resHeaders["content-type"] = "application/octet-stream";
			this.resHeaders["content-length"] = String(data.length);
			this.end(data);
			return;
		}
		if (typeof data === "object" && data !== null) {
			this.resHeaders["content-type"] = "application/json";
			this.end(JSON.stringify(data));
			return;
		}
		if (!this.resHeaders["content-type"]) this.resHeaders["content-type"] = "text/plain";
		this.end(String(data));
	}
	redirect(statusOrUrl, url) {
		if (typeof statusOrUrl === "string") {
			url = statusOrUrl;
			statusOrUrl = 307;
		}
		if (typeof statusOrUrl !== "number" || typeof url !== "string") throw new Error("Invalid redirect arguments. Please use a single argument URL, e.g. res.redirect('/destination') or use a status code and URL, e.g. res.redirect(307, '/destination').");
		this.writeHead(statusOrUrl, { Location: url });
		this.write(url);
		this.end();
		return this;
	}
	getHeaders() {
		const headers = { ...this.resHeaders };
		if (this.setCookieHeaders.length > 0) headers["set-cookie"] = this.setCookieHeaders;
		return headers;
	}
	async revalidate(urlPath, opts) {
		await performOnDemandRevalidate(this.requestHeaders, urlPath, opts);
	}
	setPreviewData(data, options = {}) {
		setPagesPreviewData(this, data, options);
		return this;
	}
	clearPreviewData(options = {}) {
		clearPagesPreviewData(this, options);
		return this;
	}
	setDraftMode(options = { enable: true }) {
		setPagesDraftMode(this, options.enable !== false);
		return this;
	}
	_write(chunk, encoding, callback) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
		if (this.controller && !this.streamEnded) try {
			this.controller.enqueue(buffer);
		} catch {}
		else this.bufferedChunks.push(buffer);
		this.resolveOnce();
		callback();
	}
	_final(callback) {
		this.streamEnded = true;
		if (this.controller) try {
			this.controller.close();
		} catch {}
		this.resolveOnce();
		callback();
	}
	_destroy(error, callback) {
		this.streamEnded = true;
		if (!this.resolved) if (error) {
			this.resolved = true;
			this.rejectResponse(error);
		} else this.resolveOnce();
		if (this.controller) try {
			if (error) this.controller.error(error);
			else this.controller.close();
		} catch {}
		callback(error);
	}
	setHeaderValue(name, value, options) {
		if (name.toLowerCase() === "set-cookie") {
			if (options.replaceSetCookie) this.setCookieHeaders.length = 0;
			if (Array.isArray(value)) this.setCookieHeaders.push(...value.map(String));
			else this.setCookieHeaders.push(String(value));
			return;
		}
		this.resHeaders[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
	}
	resolveOnce() {
		if (this.resolved) return;
		this.resolved = true;
		const headers = new Headers();
		for (const [key, value] of Object.entries(this.resHeaders)) headers.set(key, String(value));
		for (const cookie of this.setCookieHeaders) headers.append("set-cookie", cookie);
		const stream = new ReadableStream({
			start: (controller) => {
				this.controller = controller;
				for (const buffer of this.bufferedChunks) try {
					controller.enqueue(buffer);
				} catch {}
				this.bufferedChunks.length = 0;
				if (this.streamEnded) try {
					controller.close();
				} catch {}
			},
			cancel: (reason) => {
				this.bufferedChunks.length = 0;
				this.destroy(reason instanceof Error ? reason : /* @__PURE__ */ new Error("Response body cancelled"));
			}
		});
		this.resolveResponse(new Response(stream, {
			status: this.resStatusCode,
			headers
		}));
	}
};
function createPagesReqRes(options) {
	const headersObj = {};
	for (const [key, value] of options.request.headers) headersObj[key.toLowerCase()] = value;
	const req = Object.assign(createRequestReadable(options.request), {
		method: options.request.method,
		url: options.url,
		headers: headersObj,
		query: options.query,
		body: options.body
	});
	attachPagesRequestCookies(req);
	let resolveResponse;
	let rejectResponse;
	const responsePromise = new Promise((resolve, reject) => {
		resolveResponse = resolve;
		rejectResponse = reject;
	});
	const res = new PagesResponseStream(resolveResponse, rejectResponse, options.request.headers);
	attachPagesPreviewApi(req, res);
	return {
		req,
		res,
		responsePromise
	};
}
//#endregion
export { PagesBodyParseError as PagesApiBodyParseError, attachPagesPreviewApi, attachPagesRequestCookies, createPagesReqRes, getPagesPreviewData, parsePagesApiBody };
