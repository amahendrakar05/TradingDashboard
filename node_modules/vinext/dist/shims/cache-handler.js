import { readCacheControlNumberField } from "../utils/cache-control-metadata.js";
//#region src/shims/cache-handler.ts
var NoOpCacheHandler = class {
	async get(_key, _ctx) {
		return null;
	}
	async set(_key, _data, _ctx) {}
	async revalidateTag(_tags, _durations) {}
};
const DEFAULT_MEMORY_CACHE_MAX_SIZE = 50 * 1024 * 1024;
const MAX_REVALIDATED_TAG_ENTRIES = 1e4;
function estimateStringMapSize(map) {
	if (!map) return 0;
	let size = 0;
	for (const [key, value] of Object.entries(map)) {
		size += key.length;
		if (Array.isArray(value)) for (const item of value) size += item.length;
		else size += value.length;
	}
	return size;
}
function estimateIncrementalCacheValueSize(value) {
	if (value === null) return 25;
	switch (value.kind) {
		case "FETCH": return JSON.stringify(value.data ?? "").length;
		case "PAGES": return value.html.length + JSON.stringify(value.pageData ?? {}).length + estimateStringMapSize(value.headers);
		case "APP_PAGE": return value.html.length + (value.rscData?.byteLength ?? 0) + (value.postponed?.length ?? 0) + estimateStringMapSize(value.headers);
		case "APP_ROUTE": return value.body.byteLength + estimateStringMapSize(value.headers);
		case "REDIRECT": return JSON.stringify(value.props ?? {}).length;
		case "IMAGE": return value.buffer.byteLength + value.extension.length + value.etag.length;
		default: return JSON.stringify(value).length;
	}
}
function resolveMemoryCacheMaxSize(options) {
	if (typeof options === "number") return options;
	if (typeof options?.cacheMaxMemorySize === "number") return options.cacheMaxMemorySize;
	if (typeof options?.maxMemoryCacheSize === "number") return options.maxMemoryCacheSize;
	return DEFAULT_MEMORY_CACHE_MAX_SIZE;
}
function readStringArrayField(ctx, field) {
	const value = ctx?.[field];
	if (!Array.isArray(value)) return [];
	return value.filter((item) => typeof item === "string");
}
function readPositiveNumberField(ctx, field) {
	const value = ctx?.[field];
	return typeof value === "number" && value > 0 ? value : void 0;
}
var MemoryCacheHandler = class {
	store = /* @__PURE__ */ new Map();
	tagRevalidatedAt = /* @__PURE__ */ new Map();
	maxMemoryCacheSize;
	currentMemoryCacheSize = 0;
	constructor(options) {
		this.maxMemoryCacheSize = resolveMemoryCacheMaxSize(options);
	}
	estimateEntrySize(entry) {
		return estimateIncrementalCacheValueSize(entry.value) + entry.tags.reduce((sum, tag) => sum + tag.length, 0) + 64;
	}
	deleteEntry(key) {
		const existing = this.store.get(key);
		if (!existing) return;
		this.currentMemoryCacheSize -= this.estimateEntrySize(existing);
		this.store.delete(key);
	}
	touchEntry(key, entry) {
		this.store.delete(key);
		this.store.set(key, entry);
	}
	evictLeastRecentlyUsed() {
		while (this.maxMemoryCacheSize > 0 && this.currentMemoryCacheSize > this.maxMemoryCacheSize) {
			const oldestKey = this.store.keys().next().value;
			if (oldestKey === void 0) return;
			this.deleteEntry(oldestKey);
		}
	}
	async get(key, ctx) {
		const entry = this.store.get(key);
		if (!entry) return null;
		for (const tag of entry.tags) {
			const revalidatedAt = this.tagRevalidatedAt.get(tag);
			if (revalidatedAt && revalidatedAt >= entry.lastModified) {
				this.deleteEntry(key);
				return null;
			}
		}
		for (const tag of readStringArrayField(ctx, "softTags")) {
			const revalidatedAt = this.tagRevalidatedAt.get(tag);
			if (revalidatedAt && revalidatedAt >= entry.lastModified) return null;
		}
		if (entry.expireAt !== null && Date.now() > entry.expireAt) {
			this.deleteEntry(key);
			return null;
		}
		this.touchEntry(key, entry);
		const now = Date.now();
		const requestedRevalidate = readPositiveNumberField(ctx, "revalidate");
		const requestedRevalidateAt = requestedRevalidate === void 0 ? null : entry.lastModified + requestedRevalidate * 1e3;
		if (entry.revalidateAt !== null && now > entry.revalidateAt || requestedRevalidateAt !== null && now > requestedRevalidateAt) return {
			lastModified: entry.lastModified,
			value: entry.value,
			cacheState: "stale",
			cacheControl: entry.cacheControl
		};
		return {
			lastModified: entry.lastModified,
			value: entry.value,
			cacheControl: entry.cacheControl
		};
	}
	async set(key, data, ctx) {
		const tagSet = /* @__PURE__ */ new Set();
		if (data && "tags" in data && Array.isArray(data.tags)) for (const tag of data.tags) tagSet.add(tag);
		for (const tag of readStringArrayField(ctx, "tags")) tagSet.add(tag);
		const tags = [...tagSet];
		let effectiveRevalidate = readCacheControlNumberField(ctx, "revalidate");
		const effectiveExpire = readCacheControlNumberField(ctx, "expire");
		if (data && "revalidate" in data && typeof data.revalidate === "number") effectiveRevalidate = data.revalidate;
		if (effectiveRevalidate === 0) return;
		const now = Date.now();
		const revalidateAt = typeof effectiveRevalidate === "number" && effectiveRevalidate > 0 ? now + effectiveRevalidate * 1e3 : null;
		const expireAt = typeof effectiveExpire === "number" && effectiveExpire > 0 ? now + effectiveExpire * 1e3 : null;
		const cacheControl = typeof effectiveRevalidate === "number" ? effectiveExpire === void 0 ? { revalidate: effectiveRevalidate } : {
			revalidate: effectiveRevalidate,
			expire: effectiveExpire
		} : void 0;
		if (this.maxMemoryCacheSize === 0) return;
		const entry = {
			value: data,
			tags,
			lastModified: now,
			revalidateAt,
			expireAt,
			cacheControl
		};
		const entrySize = this.estimateEntrySize(entry);
		if (entrySize > this.maxMemoryCacheSize) {
			this.deleteEntry(key);
			return;
		}
		this.deleteEntry(key);
		this.store.set(key, entry);
		this.currentMemoryCacheSize += entrySize;
		this.evictLeastRecentlyUsed();
	}
	async revalidateTag(tags) {
		const tagList = Array.isArray(tags) ? tags : [tags];
		const now = Date.now();
		for (const tag of tagList) {
			this.tagRevalidatedAt.set(tag, now);
			while (this.tagRevalidatedAt.size > MAX_REVALIDATED_TAG_ENTRIES) {
				const oldest = this.tagRevalidatedAt.keys().next().value;
				if (oldest === void 0) break;
				this.tagRevalidatedAt.delete(oldest);
			}
		}
	}
	resetRequestCache() {}
};
const HANDLER_KEY = Symbol.for("vinext.cacheHandler");
const globalHandlers = globalThis;
function getActiveHandler() {
	return globalHandlers[HANDLER_KEY] ?? (globalHandlers[HANDLER_KEY] = new MemoryCacheHandler());
}
function configureMemoryCacheHandler(options) {
	const current = globalHandlers[HANDLER_KEY];
	if (current && !(current instanceof MemoryCacheHandler)) return;
	globalHandlers[HANDLER_KEY] = new MemoryCacheHandler(options);
}
function setDataCacheHandler(handler) {
	globalHandlers[HANDLER_KEY] = handler;
}
function getDataCacheHandler() {
	return getActiveHandler();
}
function setCacheHandler(handler) {
	setDataCacheHandler(handler);
}
function getCacheHandler() {
	return getDataCacheHandler();
}
//#endregion
export { MemoryCacheHandler, NoOpCacheHandler, configureMemoryCacheHandler, getCacheHandler, getDataCacheHandler, setCacheHandler, setDataCacheHandler };
