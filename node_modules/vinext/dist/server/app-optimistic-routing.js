import { buildParams, decodeMatchedParams, splitPathnameForRouteMatch } from "../routing/utils.js";
import { stripBasePath } from "../utils/base-path.js";
import { isUnknownRecord } from "../utils/record.js";
import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import { matchRoutePattern } from "../routing/route-pattern.js";
import { stripRscCacheBustingSearchParam, stripRscSuffix } from "./app-rsc-cache-busting.js";
import { Suspense, createElement, isValidElement } from "react";
//#region src/server/app-optimistic-routing.ts
const routeTrieCache = /* @__PURE__ */ new WeakMap();
const OPTIMISTIC_ROUTE_SEGMENT_SUSPENSE_TRIGGER = new Promise(() => {});
function getOptimisticRouteTemplateKey(options) {
	return `${options.routeId}\0${options.interceptionContext ?? ""}\0${options.mountedSlotsHeader ?? ""}`;
}
function getOptimisticPrefetchSourceKey(options) {
	return `${options.cacheKey}\0${options.interceptionContext ?? ""}\0${options.mountedSlotsHeader ?? ""}`;
}
function createNode() {
	return {
		catchAllChild: null,
		dynamicChild: null,
		optionalCatchAllChild: null,
		route: null,
		staticChildren: /* @__PURE__ */ new Map()
	};
}
function buildRouteTrie(routeManifest) {
	const root = createNode();
	for (const route of routeManifest.segmentGraph.routes.values()) {
		let node = root;
		const parts = route.patternParts;
		if (parts.length === 0) {
			node.route ??= route;
			continue;
		}
		for (const [index, part] of parts.entries()) {
			const isTerminal = index === parts.length - 1;
			if (part.startsWith(":") && part.endsWith("+")) {
				if (isTerminal && node.catchAllChild === null) node.catchAllChild = {
					paramName: part.slice(1, -1),
					route
				};
				break;
			}
			if (part.startsWith(":") && part.endsWith("*")) {
				if (isTerminal && node.optionalCatchAllChild === null) node.optionalCatchAllChild = {
					paramName: part.slice(1, -1),
					route
				};
				break;
			}
			if (part.startsWith(":")) {
				const paramName = part.slice(1);
				if (node.dynamicChild === null) node.dynamicChild = {
					node: createNode(),
					paramName
				};
				else if (node.dynamicChild.paramName !== paramName && import.meta.env.DEV) console.warn(`[vinext] Optimistic route trie found conflicting dynamic segments at the same level: :${node.dynamicChild.paramName} vs ${part}`);
				node = node.dynamicChild.node;
				if (isTerminal) node.route ??= route;
				continue;
			}
			let staticChild = node.staticChildren.get(part);
			if (staticChild === void 0) {
				staticChild = createNode();
				node.staticChildren.set(part, staticChild);
			}
			node = staticChild;
			if (isTerminal) node.route ??= route;
		}
	}
	return root;
}
function getRouteTrie(routeManifest) {
	const existing = routeTrieCache.get(routeManifest);
	if (existing) return existing;
	const trie = buildRouteTrie(routeManifest);
	routeTrieCache.set(routeManifest, trie);
	return trie;
}
function matchNode(node, urlParts, index, entries) {
	if (index === urlParts.length) {
		if (node.route !== null) return {
			route: node.route,
			params: buildParams(entries)
		};
		if (node.optionalCatchAllChild !== null) return {
			route: node.optionalCatchAllChild.route,
			params: buildParams(entries)
		};
		return null;
	}
	const segment = urlParts[index];
	const staticChild = node.staticChildren.get(segment);
	if (staticChild !== void 0) return matchNode(staticChild, urlParts, index + 1, entries);
	if (node.dynamicChild !== null) {
		entries.push([node.dynamicChild.paramName, segment]);
		const match = matchNode(node.dynamicChild.node, urlParts, index + 1, entries);
		if (match !== null) return match;
		entries.pop();
	}
	if (node.catchAllChild !== null) {
		const params = buildParams(entries);
		params[node.catchAllChild.paramName] = urlParts.slice(index);
		return {
			route: node.catchAllChild.route,
			params
		};
	}
	if (node.optionalCatchAllChild !== null) {
		const params = buildParams(entries);
		params[node.optionalCatchAllChild.paramName] = urlParts.slice(index);
		return {
			route: node.optionalCatchAllChild.route,
			params
		};
	}
	return null;
}
function hrefToRouteParts(href, basePath) {
	let url;
	try {
		url = new URL(href, "https://vinext.local");
	} catch {
		return null;
	}
	stripRscCacheBustingSearchParam(url);
	const appPathname = stripBasePath(stripRscSuffix(url.pathname), basePath);
	return splitPathnameForRouteMatch(appPathname === "" ? "/" : appPathname);
}
function matchOptimisticRouteManifestRoute(options) {
	const urlParts = hrefToRouteParts(options.href, options.basePath);
	if (urlParts === null) return null;
	const match = matchNode(getRouteTrie(options.routeManifest), urlParts, 0, []);
	if (match === null) return null;
	decodeMatchedParams(match.params);
	return match;
}
function mergeParams(target, source) {
	for (const [key, value] of Object.entries(source)) target[key] = value;
}
function resolveOptimisticNavigationParams(options) {
	const navigationParams = { ...options.match.params };
	for (const binding of options.routeManifest.segmentGraph.slotBindings.values()) {
		if (binding.routeId !== options.match.route.id || binding.state !== "active") continue;
		const patternParts = binding.slotPatternParts;
		if (!patternParts) continue;
		const matched = matchRoutePattern(options.urlParts, patternParts);
		if (matched) mergeParams(navigationParams, matched);
	}
	return navigationParams;
}
function elementHasSuspenseFallback(value, depth = 0) {
	if (depth > 100) return false;
	if (Array.isArray(value)) return value.some((entry) => elementHasSuspenseFallback(entry, depth + 1));
	if (!isValidElement(value)) return false;
	const props = Reflect.get(value, "props");
	if (value.type === Suspense && isUnknownRecord(props)) {
		const fallback = Reflect.get(props, "fallback");
		if (fallback !== null && fallback !== void 0) return true;
	}
	if (!isUnknownRecord(props)) return false;
	return elementHasSuspenseFallback(Reflect.get(props, "children"), depth + 1);
}
function getPageElementIds(elements, route) {
	const pageElementIds = /* @__PURE__ */ new Set();
	if (route.pageId && Object.hasOwn(elements, route.pageId)) pageElementIds.add(route.pageId);
	for (const slotId of route.slotIds) {
		const parsed = AppElementsWire.parseElementKey(slotId);
		if (parsed?.kind === "slot" && parsed.name === "children" && Object.hasOwn(elements, slotId)) pageElementIds.add(slotId);
	}
	for (const key of Object.keys(elements)) if (AppElementsWire.parseElementKey(key)?.kind === "page") pageElementIds.add(key);
	return Array.from(pageElementIds).sort();
}
function OptimisticRouteSegment() {
	throw OPTIMISTIC_ROUTE_SEGMENT_SUSPENSE_TRIGGER;
}
function createOptimisticRouteTemplate(options) {
	const match = matchOptimisticRouteManifestRoute({
		basePath: options.basePath,
		href: options.href,
		routeManifest: options.routeManifest
	});
	if (match === null || !options.allowLoadingShell && !match.route.isDynamic) return null;
	if (options.interceptionContext !== null) return null;
	const metadata = AppElementsWire.readMetadata(options.elements);
	if (metadata.interception !== null || metadata.interceptionContext !== null) return null;
	const routeElement = options.elements[metadata.routeId];
	if (!options.allowLoadingShell && !elementHasSuspenseFallback(routeElement)) return null;
	if (options.allowLoadingShell && options.elements["__prefetchLoadingShell"] !== "LoadingBoundary") return null;
	if (options.allowLoadingShell && (routeElement === void 0 || routeElement === null)) return null;
	const pageElementIds = getPageElementIds(options.elements, match.route);
	if (pageElementIds.length === 0) return null;
	return {
		elements: options.elements,
		mountedSlotsHeader: options.mountedSlotsHeader,
		pageElementIds,
		routeId: match.route.id
	};
}
function createOptimisticRouteElements(template) {
	const elements = { ...template.elements };
	for (const pageElementId of template.pageElementIds) elements[pageElementId] = createElement(OptimisticRouteSegment);
	return elements;
}
function resolveOptimisticNavigationPayload(options) {
	if (options.interceptionContext !== null) return null;
	const urlParts = hrefToRouteParts(options.href, options.basePath);
	if (urlParts === null) return null;
	const match = matchOptimisticRouteManifestRoute({
		basePath: options.basePath,
		href: options.href,
		routeManifest: options.routeManifest
	});
	if (match === null) return null;
	const template = options.templates.get(getOptimisticRouteTemplateKey({
		interceptionContext: options.interceptionContext,
		mountedSlotsHeader: options.mountedSlotsHeader,
		routeId: match.route.id
	}));
	if (template === void 0) return null;
	if (template.mountedSlotsHeader !== options.mountedSlotsHeader) return null;
	return {
		elements: createOptimisticRouteElements(template),
		params: resolveOptimisticNavigationParams({
			match,
			routeManifest: options.routeManifest,
			urlParts
		}),
		template
	};
}
//#endregion
export { createOptimisticRouteElements, createOptimisticRouteTemplate, getOptimisticPrefetchSourceKey, getOptimisticRouteTemplateKey, matchOptimisticRouteManifestRoute, resolveOptimisticNavigationPayload };
