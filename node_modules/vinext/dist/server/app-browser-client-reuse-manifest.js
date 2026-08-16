import { AppElementsWire } from "./app-elements-wire.js";
import "./app-elements.js";
import { DEFAULT_CACHE_VARIANT_BUDGET, buildCacheVariantWithRouteBudget } from "./cache-proof.js";
import { DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS, countUtf8Bytes, serializeClientReuseManifest } from "./client-reuse-manifest.js";
import { createStaticLayoutClientReuseArtifactCompatibility, createStaticLayoutClientReusePayloadHash, createStaticLayoutClientReuseRouteId } from "./static-layout-client-reuse-proof.js";
//#region src/server/app-browser-client-reuse-manifest.ts
function capClientReuseManifestProducerLimits(limits) {
	return {
		...limits,
		maxEntryCount: Math.min(limits.maxEntryCount, 8)
	};
}
function serializeBoundedClientReuseManifest(input) {
	const entries = input.entries.slice(0, input.limits.maxEntryCount);
	let low = 1;
	let high = entries.length;
	let best = null;
	while (low <= high) {
		const size = Math.floor((low + high) / 2);
		const serialized = serializeClientReuseManifest({
			entries: entries.slice(0, size),
			replayWindow: {
				validFromVisibleCommitVersion: input.visibleCommitVersion,
				validUntilVisibleCommitVersion: input.visibleCommitVersion
			},
			visibleCommitVersion: input.visibleCommitVersion
		});
		if (countUtf8Bytes(serialized) <= input.limits.maxManifestBytes) {
			best = serialized;
			low = size + 1;
		} else high = size - 1;
	}
	return best;
}
function hasRetainedElement(elements, elementId) {
	return Object.hasOwn(elements, elementId);
}
function createStaticLayoutEntry(input) {
	const routeId = createStaticLayoutClientReuseRouteId(input.layoutId);
	const output = {
		kind: "layout",
		layoutId: input.layoutId,
		rootBoundaryId: input.artifactCompatibility.rootBoundaryId,
		routeId
	};
	const candidateVariant = buildCacheVariantWithRouteBudget({
		budget: DEFAULT_CACHE_VARIANT_BUDGET,
		dimensions: [],
		output,
		routeBudget: {
			routeId: output.routeId,
			variantCacheKeys: []
		}
	});
	if (candidateVariant.kind !== "variant") return null;
	const artifactCompatibility = createStaticLayoutClientReuseArtifactCompatibility({
		artifactCompatibility: input.artifactCompatibility,
		layoutId: input.layoutId,
		rootBoundaryId: output.rootBoundaryId,
		routeId: output.routeId,
		variantCacheKey: candidateVariant.variant.cacheKey
	});
	return {
		artifactCompatibility,
		id: input.layoutId,
		payloadHash: createStaticLayoutClientReusePayloadHash({
			artifactCompatibility,
			layoutId: input.layoutId,
			rootBoundaryId: output.rootBoundaryId,
			routeId: output.routeId,
			variantCacheKey: candidateVariant.variant.cacheKey
		}),
		privacy: "public",
		variantCacheKey: candidateVariant.variant.cacheKey
	};
}
function createClientReuseManifestHeaderFromVisibleAppState(state, options = {}) {
	const limits = capClientReuseManifestProducerLimits(options.limits ?? DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS);
	const metadata = AppElementsWire.readMetadata(state.elements);
	const entries = [];
	for (const layoutId of metadata.layoutIds) {
		if (entries.length >= limits.maxEntryCount) break;
		if (layoutId.length > limits.maxEntryIdLength) continue;
		if (metadata.layoutFlags[layoutId] !== "s") continue;
		if (!hasRetainedElement(state.elements, layoutId)) continue;
		if (AppElementsWire.parseElementKey(layoutId)?.kind !== "layout") continue;
		const entry = createStaticLayoutEntry({
			artifactCompatibility: metadata.artifactCompatibility,
			layoutId
		});
		if (entry) entries.push(entry);
	}
	if (entries.length === 0) return null;
	return serializeBoundedClientReuseManifest({
		entries,
		limits,
		visibleCommitVersion: state.visibleCommitVersion
	});
}
//#endregion
export { createClientReuseManifestHeaderFromVisibleAppState };
