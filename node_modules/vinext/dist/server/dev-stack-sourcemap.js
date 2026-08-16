import { toSlash } from "../deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT } from "../utils/dev-stack-sourcemap-endpoint.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
//#region src/server/dev-stack-sourcemap.ts
const MAX_ORIGINAL_STACK_TRACE_BODY_BYTES = 1024 * 1024;
const V8_PAREN_STACK_LINE = /^(\s*at\s+.*?\()(.+):(\d+):(\d+)(\)\s*)$/;
const V8_BARE_STACK_LINE = /^(\s*at\s+)(.+):(\d+):(\d+)(\s*)$/;
const MOZ_STACK_LINE = /^([^@\n]*@)(.+):(\d+):(\d+)(\s*)$/;
var RequestBodyTooLargeError = class extends Error {};
const BASE64_VLQ_VALUES = Object.create(null);
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").forEach((char, index) => {
	BASE64_VLQ_VALUES[char] = index;
});
function installDevStackSourcemapMiddleware(server) {
	server.middlewares.use((req, res, next) => {
		if (!isOriginalStackTraceRequest(req)) {
			next();
			return;
		}
		handleOriginalStackTraceRequest(server, req, res).catch(() => {
			if (!res.headersSent) writeJson(res, 500, { error: "Internal Server Error" });
		});
	});
}
function isOriginalStackTraceRequest(req) {
	return new URL(req.url ?? "/", "http://vinext.local").pathname === VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT;
}
async function handleOriginalStackTraceRequest(server, req, res) {
	if (req.method !== "POST") {
		writeJson(res, 405, { error: "Method Not Allowed" });
		return;
	}
	try {
		const payload = parseStackTraceRequestBody(await readRequestBody(req));
		if (!payload) {
			writeJson(res, 400, { error: "Bad Request" });
			return;
		}
		writeJson(res, 200, await resolveDevServerStackTrace(server, payload.stack, getDevStackSourcemapRequestHost(req.headers)));
	} catch (error) {
		if (error instanceof RequestBodyTooLargeError) {
			writeJson(res, 413, { error: "Payload Too Large" });
			return;
		}
		writeJson(res, 500, { error: "Internal Server Error" });
	}
}
function parseStackTraceRequestBody(body) {
	try {
		const payload = JSON.parse(body);
		return typeof payload.stack === "string" ? { stack: payload.stack } : null;
	} catch {
		return null;
	}
}
async function readRequestBody(req) {
	return await new Promise((resolve, reject) => {
		let body = "";
		let bytes = 0;
		let settled = false;
		req.setEncoding("utf8");
		req.on("data", (chunk) => {
			bytes += Buffer.byteLength(chunk, "utf8");
			if (bytes > MAX_ORIGINAL_STACK_TRACE_BODY_BYTES) {
				settled = true;
				reject(new RequestBodyTooLargeError());
				req.destroy();
				return;
			}
			body += chunk;
		});
		req.on("end", () => {
			if (settled) return;
			settled = true;
			resolve(body);
		});
		req.on("error", (error) => {
			if (settled) return;
			settled = true;
			reject(error);
		});
	});
}
function writeJson(res, statusCode, payload) {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(payload));
}
function getDevStackSourcemapRequestHost(headers) {
	return normalizeRequestHost(headers["x-forwarded-host"]) ?? normalizeRequestHost(headers.host);
}
function normalizeRequestHost(value) {
	return (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim().toLowerCase() || void 0;
}
async function resolveDevServerStackTrace(server, stack, requestHost) {
	const sourceMapCache = /* @__PURE__ */ new Map();
	const mapped = await Promise.all(stack.split("\n").map((line) => mapStackLineWithMetadata(server, line, requestHost, sourceMapCache)));
	const codeFrame = mapped.find((line) => line.isFrame && !line.ignored && line.codeFrame)?.codeFrame;
	const projectRoot = normalizeProjectRoot(server.config?.root);
	return {
		stack: mapped.map((line) => line.line).join("\n"),
		ignoredFrames: createIgnoredFramesForOverlay(mapped),
		...projectRoot ? { projectRoot } : {},
		...codeFrame ? { codeFrame } : {}
	};
}
async function mapStackLine(server, line, requestHost, sourceMapCache) {
	return (await mapStackLineWithMetadata(server, line, requestHost, sourceMapCache)).line;
}
async function mapStackLineWithMetadata(server, line, requestHost, sourceMapCache) {
	const v8Paren = line.match(V8_PAREN_STACK_LINE);
	if (v8Paren) {
		const methodName = extractV8ParenMethodName(v8Paren[1]);
		const mapped = await mapGeneratedFrame(server, v8Paren[2], v8Paren[3], v8Paren[4], methodName, requestHost, sourceMapCache);
		return {
			line: mapped ? `${v8Paren[1]}${mapped.file}:${mapped.line}:${mapped.column}${v8Paren[5]}` : line,
			isFrame: true,
			ignored: mapped?.ignored ?? isIgnoreListedGeneratedFrame(v8Paren[2], requestHost),
			...mapped?.codeFrame ? { codeFrame: mapped.codeFrame } : {}
		};
	}
	const v8Bare = line.match(V8_BARE_STACK_LINE);
	if (v8Bare) {
		const mapped = await mapGeneratedFrame(server, v8Bare[2], v8Bare[3], v8Bare[4], void 0, requestHost, sourceMapCache);
		return {
			line: mapped ? `${v8Bare[1]}${mapped.file}:${mapped.line}:${mapped.column}${v8Bare[5]}` : line,
			isFrame: true,
			ignored: mapped?.ignored ?? isIgnoreListedGeneratedFrame(v8Bare[2], requestHost),
			...mapped?.codeFrame ? { codeFrame: mapped.codeFrame } : {}
		};
	}
	const moz = line.match(MOZ_STACK_LINE);
	if (moz) {
		const mapped = await mapGeneratedFrame(server, moz[2], moz[3], moz[4], moz[1].replace(/@$/, "") || void 0, requestHost, sourceMapCache);
		return {
			line: mapped ? `${moz[1]}${mapped.file}:${mapped.line}:${mapped.column}${moz[5]}` : line,
			isFrame: true,
			ignored: mapped?.ignored ?? isIgnoreListedGeneratedFrame(moz[2], requestHost),
			...mapped?.codeFrame ? { codeFrame: mapped.codeFrame } : {}
		};
	}
	return {
		line,
		isFrame: false,
		ignored: false
	};
}
function createIgnoredFramesForOverlay(mapped) {
	const firstNonEmptyLineIndex = mapped.findIndex((line) => line.line.trim() !== "");
	const firstLineIsMessage = mapped.reduce((count, line) => count + (line.line.trim() !== "" ? 1 : 0), 0) > 1 && firstNonEmptyLineIndex !== -1 && !mapped[firstNonEmptyLineIndex]?.isFrame;
	return mapped.flatMap((line, index) => {
		if (line.line.trim() === "") return [];
		if (firstLineIsMessage && index === firstNonEmptyLineIndex) return [];
		return [line.isFrame ? line.ignored : false];
	});
}
async function mapGeneratedFrame(server, file, line, column, methodName, requestHost, sourceMapCache) {
	const generatedFrame = getMappableGeneratedFrame(server, file, requestHost);
	if (!generatedFrame) return null;
	const generatedLine = Number(line);
	const generatedColumn = Number(column);
	if (!Number.isFinite(generatedLine) || !Number.isFinite(generatedColumn)) return null;
	const sourceMap = await getSourceMapForGeneratedFrame(generatedFrame, sourceMapCache);
	if (!sourceMap) return null;
	const original = traceOriginalPositionFor(sourceMap, generatedLine, generatedColumn);
	if (!original) return null;
	const originalFile = resolveSourceFile(original.source, sourceMap, generatedFrame.sourceMapBaseUrl);
	const codeFrame = await createStackCodeFrame({
		file: originalFile,
		line: original.line,
		column: original.column,
		methodName,
		sourceContent: sourceMap.sourcesContent?.[original.sourceIndex] ?? null
	});
	return {
		file: originalFile,
		line: original.line,
		column: original.column,
		ignored: isSourceMapIgnored(sourceMap, original.sourceIndex) || isIgnoreListedOriginalFrame(original.source) || isIgnoreListedOriginalFrame(originalFile) || isIgnoreListedGeneratedFrame(file, requestHost),
		...codeFrame ? { codeFrame } : {}
	};
}
function extractV8ParenMethodName(prefix) {
	return prefix.replace(/^\s*at\s+/, "").replace(/\($/, "").trim() || void 0;
}
function normalizeProjectRoot(root) {
	if (!root) return void 0;
	return toSlash(root).replace(/\/+$/, "") || (root.startsWith("/") ? "/" : void 0);
}
function stripTrailingSlash(value) {
	return value?.replace(/[\\/]+$/, "");
}
function stripQuery(value) {
	return value.split(/[?#]/, 1)[0] ?? value;
}
function getMappableGeneratedFrame(server, file, requestHost) {
	const normalizedFile = devirtualizeReactServerFrame(file);
	const localPath = getLocalSourcePath(server, normalizedFile);
	if (localPath) return {
		cacheKey: `server:${localPath}`,
		sourceMapBaseUrl: pathToFileURL(localPath),
		transform: () => loadServerSourceMapForLocalPath(server, localPath)
	};
	if (isWindowsAbsolutePath(normalizedFile)) return null;
	const generatedUrl = getMappableClientGeneratedUrl(normalizedFile, requestHost);
	if (!generatedUrl) return null;
	const viteUrl = generatedUrl.pathname + generatedUrl.search;
	return {
		cacheKey: `client:${viteUrl}`,
		sourceMapBaseUrl: generatedUrl,
		transform: () => loadClientSourceMapForGeneratedUrl(server, viteUrl)
	};
}
function devirtualizeReactServerFrame(file) {
	if (!file.startsWith("about://React/")) return file;
	const envIdx = file.indexOf("/", 14);
	const suffixIdx = file.lastIndexOf("?");
	if (envIdx === -1 || suffixIdx === -1 || suffixIdx <= envIdx) return file;
	return file.slice(envIdx + 1, suffixIdx);
}
function getLocalSourcePath(server, file) {
	let localPath = file;
	if (file.startsWith("file://")) try {
		localPath = fileURLToPath(file);
	} catch {
		return null;
	}
	localPath = stripQuery(localPath);
	if (!isAbsolutePath(localPath)) return null;
	const localPathForCompare = normalizeLocalPathForCompare(localPath);
	if (localPathForCompare.includes("/node_modules/")) return null;
	const root = server.config?.root;
	if (!root) return null;
	const rootForCompare = normalizeLocalPathForCompare(root);
	return localPathForCompare === rootForCompare || localPathForCompare.startsWith(`${rootForCompare}/`) ? localPath : null;
}
function isAbsolutePath(value) {
	return value.startsWith("/") || isWindowsAbsolutePath(value);
}
function isWindowsAbsolutePath(value) {
	return /^[A-Za-z]:[\\/]/.test(value);
}
function normalizeLocalPathForCompare(value) {
	const normalized = (stripTrailingSlash(toSlash(value)) ?? "").replace(/\/+/g, "/");
	return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized;
}
function normalizeIgnoreListPath(value) {
	let path = devirtualizeReactServerFrame(value);
	if (path.startsWith("file://")) try {
		path = fileURLToPath(path);
	} catch {}
	else try {
		const url = new URL(path);
		if (url.protocol === "http:" || url.protocol === "https:") path = `${url.pathname}${url.search}`;
	} catch {}
	try {
		path = decodeURIComponent(path);
	} catch {}
	return toSlash(path).toLowerCase();
}
function isExternalHttpFrame(file, requestHost) {
	if (!/^https?:\/\//i.test(file) || !requestHost) return false;
	try {
		return new URL(file).host.toLowerCase() !== requestHost;
	} catch {
		return false;
	}
}
function isIgnoreListedGeneratedFrame(file, requestHost) {
	const normalized = normalizeIgnoreListPath(file);
	return isExternalHttpFrame(file, requestHost) || normalized.startsWith("node:") || normalized.includes("/node_modules/") || normalized.includes("/.vite/") || normalized.includes("/@vite/") || normalized.includes("/@react-refresh") || normalized.includes("/__vite") || normalized.includes("virtual:vinext") || normalized.includes("/packages/vinext/src/") || normalized.includes("/packages/vinext/dist/") || normalized.includes("/vinext/server/");
}
function isIgnoreListedOriginalFrame(file) {
	const normalized = normalizeIgnoreListPath(file);
	return normalized.startsWith("node:") || normalized.includes("/node_modules/") || normalized.includes("/packages/vinext/src/") || normalized.includes("/packages/vinext/dist/") || normalized.includes("/vinext/server/");
}
function isSourceMapIgnored(sourceMap, sourceIndex) {
	return sourceMap.ignoreList?.includes(sourceIndex) ?? false;
}
async function createStackCodeFrame({ file, line, column, methodName, sourceContent }) {
	const source = sourceContent ?? await readSourceFileForCodeFrame(file);
	if (!source) return null;
	const sourceLines = source.split(/\r\n|\r|\n/);
	if (line < 1 || line > sourceLines.length) return null;
	const start = Math.max(1, line - 2);
	const end = Math.min(sourceLines.length, line + 3);
	const lines = [];
	for (let currentLine = start; currentLine <= end; currentLine++) lines.push({
		line: currentLine,
		text: sourceLines[currentLine - 1] ?? "",
		isErrorLine: currentLine === line
	});
	return {
		file,
		line,
		column,
		...methodName ? { methodName } : {},
		lines
	};
}
async function readSourceFileForCodeFrame(file) {
	if (!file.startsWith("file://")) return null;
	try {
		return await readFile(fileURLToPath(file), "utf8");
	} catch {
		return null;
	}
}
function getMappableClientGeneratedUrl(file, requestHost) {
	const isAbsoluteHttpUrl = /^https?:\/\//i.test(file);
	let url;
	try {
		url = new URL(file, "http://vinext.local");
	} catch {
		return null;
	}
	if (isAbsoluteHttpUrl && requestHost && url.host !== requestHost) return null;
	if (url.pathname.includes("/node_modules/")) return null;
	return url;
}
async function getSourceMapForGeneratedFrame(generatedFrame, cache) {
	let sourceMap = cache.get(generatedFrame.cacheKey);
	if (!sourceMap) {
		sourceMap = generatedFrame.transform();
		cache.set(generatedFrame.cacheKey, sourceMap);
	}
	return sourceMap;
}
async function loadClientSourceMapForGeneratedUrl(server, viteUrl) {
	try {
		return normalizeSourceMapPayload((await server.environments.client.transformRequest(viteUrl))?.map);
	} catch {
		return null;
	}
}
async function loadServerSourceMapForLocalPath(server, localPath) {
	for (const environmentName of ["rsc", "ssr"]) {
		const environment = server.environments[environmentName];
		if (!environment) continue;
		try {
			const sourceMap = normalizeSourceMapPayload((await environment.transformRequest(localPath))?.map);
			if (sourceMap) return sourceMap;
		} catch {}
	}
	return null;
}
function normalizeSourceMapPayload(payload) {
	if (!payload || typeof payload !== "object") return null;
	const map = payload;
	if (!Array.isArray(map.sources) || typeof map.mappings !== "string" || map.mappings === "") return null;
	if (!map.sources.every((source) => typeof source === "string")) return null;
	const ignoreList = normalizeIgnoreList(map.ignoreList) ?? normalizeIgnoreList(map.x_google_ignoreList);
	return {
		version: typeof map.version === "number" ? map.version : void 0,
		sources: map.sources,
		sourcesContent: normalizeSourcesContent(map.sourcesContent),
		sourceRoot: typeof map.sourceRoot === "string" ? map.sourceRoot : void 0,
		mappings: map.mappings,
		ignoreList
	};
}
function normalizeSourcesContent(value) {
	if (!Array.isArray(value)) return void 0;
	const sourcesContent = value.map((source) => typeof source === "string" ? source : null);
	return sourcesContent.length > 0 ? sourcesContent : void 0;
}
function normalizeIgnoreList(value) {
	if (!Array.isArray(value)) return void 0;
	const ignoreList = value.filter((index) => Number.isInteger(index) && index >= 0);
	return ignoreList.length > 0 ? ignoreList : void 0;
}
function originalPositionFor(sourceMap, generatedLine, generatedColumn) {
	const original = traceOriginalPositionFor(sourceMap, generatedLine, generatedColumn);
	if (!original) return null;
	return {
		source: original.source,
		line: original.line,
		column: original.column
	};
}
function traceOriginalPositionFor(sourceMap, generatedLine, generatedColumn) {
	const targetLineIndex = generatedLine - 1;
	const targetColumn = Math.max(0, generatedColumn - 1);
	if (targetLineIndex < 0) return null;
	let sourceIndex = 0;
	let originalLine = 0;
	let originalColumn = 0;
	const generatedLines = sourceMap.mappings.split(";");
	for (let generatedLineIndex = 0; generatedLineIndex <= targetLineIndex; generatedLineIndex++) {
		const generatedSegments = generatedLines[generatedLineIndex];
		if (generatedSegments === void 0) return null;
		let generatedSegmentColumn = 0;
		let bestMatch = null;
		for (const segment of generatedSegments.split(",")) {
			if (!segment) continue;
			const decoded = decodeVlqSegment(segment);
			if (decoded.length === 0) continue;
			generatedSegmentColumn += decoded[0] ?? 0;
			if (decoded.length >= 4) {
				sourceIndex += decoded[1] ?? 0;
				originalLine += decoded[2] ?? 0;
				originalColumn += decoded[3] ?? 0;
			}
			if (generatedLineIndex !== targetLineIndex) continue;
			if (generatedSegmentColumn > targetColumn) break;
			bestMatch = decoded.length >= 4 && sourceMap.sources[sourceIndex] ? {
				source: sourceMap.sources[sourceIndex],
				sourceIndex,
				line: originalLine + 1,
				column: originalColumn + 1
			} : null;
		}
		if (generatedLineIndex === targetLineIndex) return bestMatch;
	}
	return null;
}
function decodeVlqSegment(segment) {
	const values = [];
	let value = 0;
	let shift = 0;
	for (const char of segment) {
		const integer = BASE64_VLQ_VALUES[char];
		if (integer === void 0) return [];
		value += (integer & 31) << shift;
		if (integer & 32) {
			shift += 5;
			continue;
		}
		values.push(value & 1 ? -(value >> 1) : value >> 1);
		value = 0;
		shift = 0;
	}
	return values;
}
function resolveSourceFile(source, sourceMap, generatedUrl) {
	const rootedSource = sourceMap.sourceRoot ? `${sourceMap.sourceRoot.replace(/\/?$/, "/")}${source}` : source;
	try {
		return new URL(rootedSource, generatedUrl.href).href;
	} catch {
		return source;
	}
}
//#endregion
export { VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT, decodeVlqSegment, installDevStackSourcemapMiddleware, mapStackLine, mapStackLineWithMetadata, originalPositionFor, resolveSourceFile };
