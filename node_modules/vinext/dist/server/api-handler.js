import { hasBasePath } from "../utils/base-path.js";
import { matchRoute } from "../routing/pages-router.js";
import "./server-globals.js";
import { NextRequest } from "../shims/server.js";
import { importModule, reportRequestError } from "./instrumentation.js";
import { mergeRouteParamsIntoQuery, parseQueryString, urlQueryToSearchParams } from "../utils/query.js";
import { DEFAULT_PAGES_API_BODY_SIZE_LIMIT, resolveBodyParserConfig } from "./pages-body-parser-config.js";
import { PagesBodyParseError, getMediaType, isJsonMediaType } from "./pages-media-type.js";
import { resolveRequestHost, resolveRequestProtocol } from "./proxy-trust.js";
import { performOnDemandRevalidate } from "./pages-revalidate.js";
import { attachPagesPreviewApi, attachPagesRequestCookies } from "./pages-node-compat.js";
import { isEdgeApiRuntime } from "./edge-api-runtime.js";
import { decode } from "node:querystring";
import { Buffer } from "node:buffer";
//#region src/server/api-handler.ts
/**
* Default request body size (1 MB). Matches Next.js default bodyParser sizeLimit.
* @see https://nextjs.org/docs/pages/building-your-application/routing/api-routes#custom-config
* Prevents denial-of-service via unbounded request body buffering.
*/
const MAX_BODY_SIZE = DEFAULT_PAGES_API_BODY_SIZE_LIMIT;
/**
* Parse the request body based on content-type.
* Enforces a size limit to prevent memory exhaustion attacks.
*
* The `sizeLimit` argument honours `export const config = { api: { bodyParser:
* { sizeLimit: '4mb' } } }` on the route module. To opt out of parsing
* entirely (`bodyParser: false`), callers must skip this function so the
* underlying readable stream stays intact on `req` (critical for webhook
* HMAC signature verification).
*/
async function parseBody(req, sizeLimit = MAX_BODY_SIZE) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let totalSize = 0;
		let settled = false;
		req.on("data", (chunk) => {
			totalSize += chunk.length;
			if (totalSize > sizeLimit) {
				settled = true;
				req.destroy();
				reject(new PagesBodyParseError("Request body too large", 413));
				return;
			}
			chunks.push(chunk);
		});
		req.on("error", (err) => {
			if (!settled) {
				settled = true;
				reject(err);
			}
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			const raw = Buffer.concat(chunks).toString("utf-8");
			const mediaType = getMediaType(req.headers["content-type"]);
			if (!raw) {
				resolve(isJsonMediaType(mediaType) ? {} : mediaType === "application/x-www-form-urlencoded" ? decode(raw) : void 0);
				return;
			}
			if (isJsonMediaType(mediaType)) try {
				resolve(JSON.parse(raw));
			} catch {
				reject(new PagesBodyParseError("Invalid JSON", 400));
			}
			else if (mediaType === "application/x-www-form-urlencoded") resolve(decode(raw));
			else resolve(raw);
		});
	});
}
function isEdgeApiRouteModule(module) {
	if (typeof module.default !== "function") return false;
	const bare = module.runtime;
	if (typeof bare === "string") return isEdgeApiRuntime(bare);
	const config = module.config;
	if (!config || typeof config !== "object") return false;
	const runtime = "runtime" in config ? config.runtime : void 0;
	return typeof runtime === "string" && isEdgeApiRuntime(runtime);
}
function readEdgeRequestBody(req) {
	if (req.method === "GET" || req.method === "HEAD") return void 0;
	return new ReadableStream({ start(controller) {
		req.on("data", (chunk) => {
			controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk));
		});
		req.on("end", () => controller.close());
		req.on("error", (error) => controller.error(error));
	} });
}
function createEdgeApiRequest(req, url, params, nextConfig) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (name.startsWith(":")) continue;
		if (Array.isArray(value)) for (const item of value) headers.append(name, item);
		else if (value !== void 0) headers.set(name, value);
	}
	const proto = resolveRequestProtocol(req);
	const host = resolveRequestHost(req, "localhost");
	const requestUrl = new URL(req.url ?? url, `${proto}://${host}`);
	const basePath = nextConfig?.basePath;
	if (basePath && !hasBasePath(requestUrl.pathname, basePath)) requestUrl.pathname = `${basePath}${requestUrl.pathname}`;
	requestUrl.search = urlQueryToSearchParams(mergeRouteParamsIntoQuery(parseQueryString(url), params)).toString();
	const body = readEdgeRequestBody(req);
	const init = {
		headers,
		method: req.method
	};
	if (body) {
		init.body = body;
		init.duplex = "half";
	}
	return new Request(requestUrl, init);
}
function waitForWritableDrain(res) {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			res.off("drain", onDrain);
			res.off("error", onError);
			res.off("close", onClose);
		};
		const onDrain = () => {
			cleanup();
			resolve();
		};
		const onError = (error) => {
			cleanup();
			reject(error);
		};
		const onClose = () => {
			cleanup();
			reject(/* @__PURE__ */ new Error("Response closed before writable drain"));
		};
		res.once("drain", onDrain);
		res.once("error", onError);
		res.once("close", onClose);
	});
}
async function writeEdgeApiResponseBody(res, body) {
	if (!body) {
		res.end();
		return;
	}
	const reader = body.getReader();
	try {
		while (true) {
			const result = await reader.read();
			if (result.done) break;
			if (result.value.byteLength === 0) continue;
			if (!res.write(Buffer.from(result.value))) await waitForWritableDrain(res);
		}
		res.end();
	} catch (error) {
		res.destroy(error instanceof Error ? error : new Error(String(error)));
		throw error;
	} finally {
		reader.releaseLock();
	}
}
/**
* Enhance a Node.js req/res pair with Next.js API route helpers.
*/
function enhanceApiObjects(req, res, query, body) {
	const apiReq = Object.assign(req, {
		body,
		query
	});
	attachPagesRequestCookies(apiReq);
	const apiRes = Object.assign(res, {
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(data) {
			this.setHeader("Content-Type", "application/json");
			this.end(JSON.stringify(data));
		},
		send(data) {
			if (Buffer.isBuffer(data)) {
				if (!this.getHeader("Content-Type")) this.setHeader("Content-Type", "application/octet-stream");
				this.setHeader("Content-Length", String(data.length));
				this.end(data);
				return;
			}
			if (typeof data === "object" && data !== null) {
				this.setHeader("Content-Type", "application/json");
				this.end(JSON.stringify(data));
			} else {
				if (!this.getHeader("Content-Type")) this.setHeader("Content-Type", "text/plain");
				this.end(String(data));
			}
		},
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
		},
		async revalidate(urlPath, opts) {
			await performOnDemandRevalidate(req, urlPath, opts);
		}
	});
	attachPagesPreviewApi(apiReq, apiRes);
	return {
		apiReq,
		apiRes
	};
}
/**
* Handle an API route request.
* Returns true if the request was handled, false if no API route matched.
*/
async function handleApiRoute(runner, req, res, url, apiRoutes, nextConfig) {
	const match = matchRoute(url, apiRoutes);
	if (!match) return false;
	const { route, params } = match;
	try {
		const apiModule = await importModule(runner, route.filePath);
		if (isEdgeApiRouteModule(apiModule)) {
			const nextRequest = new NextRequest(createEdgeApiRequest(req, url, params, nextConfig), nextConfig ? { nextConfig: {
				basePath: nextConfig.basePath,
				i18n: nextConfig.i18n ?? void 0,
				trailingSlash: nextConfig.trailingSlash
			} } : void 0);
			const response = await apiModule.default(nextRequest);
			if (!(response instanceof Response)) throw new Error("Edge API route did not return a Response");
			res.statusCode = response.status;
			res.statusMessage = response.statusText;
			const setCookieHeaders = response.headers.getSetCookie();
			response.headers.forEach((value, name) => {
				if (name !== "set-cookie") res.setHeader(name, value);
			});
			if (setCookieHeaders.length) res.setHeader("set-cookie", setCookieHeaders);
			await writeEdgeApiResponseBody(res, response.body);
			return true;
		}
		const handler = apiModule.default;
		if (typeof handler !== "function") {
			console.error(`[vinext] API route ${route.filePath} does not export a default function`);
			res.statusCode = 500;
			res.end("API route does not export a default function");
			return true;
		}
		const query = mergeRouteParamsIntoQuery(parseQueryString(url), params);
		const bodyParserConfig = resolveBodyParserConfig(apiModule.config);
		const { apiReq, apiRes } = enhanceApiObjects(req, res, query, bodyParserConfig.enabled ? await parseBody(req, bodyParserConfig.sizeLimit) : void 0);
		await handler(apiReq, apiRes);
		return true;
	} catch (e) {
		if (e instanceof PagesBodyParseError) {
			res.statusCode = e.statusCode;
			res.statusMessage = e.message;
			res.end(e.message);
			return true;
		}
		console.error(e);
		reportRequestError(e instanceof Error ? e : new Error(String(e)), {
			path: url,
			method: req.method ?? "GET",
			headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !k.startsWith(":")).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]))
		}, {
			routerKind: "Pages Router",
			routePath: match.route.pattern,
			routeType: "route"
		});
		if (!res.headersSent) {
			res.statusCode = 500;
			res.end("Internal Server Error");
		} else if (!res.writableEnded) res.end();
		return true;
	}
}
//#endregion
export { handleApiRoute };
