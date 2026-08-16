import { isUnknownRecord } from "../utils/record.js";
import { fnv1a64 } from "../utils/hash.js";
import { parseArtifactCompatibilityEnvelope } from "./artifact-compatibility.js";
import { AppElementsWire } from "./app-elements-wire.js";
import { isNonNegativeSafeInteger } from "../utils/number.js";
//#region src/server/client-reuse-manifest.ts
const CLIENT_REUSE_MANIFEST_SCHEMA_VERSION = 1;
const CLIENT_REUSE_MANIFEST_HASH_ALGORITHM = "fnv1a64";
const DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS = {
	maxEntryCount: 64,
	maxEntryIdLength: 512,
	maxManifestBytes: 4096,
	maxPayloadHashLength: 16,
	maxVariantCacheKeyLength: 256
};
const CLIENT_REUSE_MANIFEST_SKIP_VERIFICATION_ENTRY_BUDGET = 8;
const HASH_DIGEST_PATTERN = /^[0-9a-z]+$/;
const textEncoder = new TextEncoder();
function createRejection(code, fields = {}) {
	return {
		code,
		fields
	};
}
function rejectManifest(code, fields = {}) {
	return {
		kind: "rejected",
		rejection: createRejection(code, fields)
	};
}
function rejectEntry(code, entryId, fields = {}) {
	return {
		code,
		entryId,
		fields
	};
}
function compareManifestEntries(left, right) {
	if (left.id < right.id) return -1;
	if (left.id > right.id) return 1;
	return 0;
}
function createCanonicalWireEntries(entries) {
	const entriesById = /* @__PURE__ */ new Map();
	for (const entry of entries) if (!entriesById.has(entry.id)) entriesById.set(entry.id, entry);
	return Array.from(entriesById.values()).sort(compareManifestEntries);
}
function countUtf8Bytes(input) {
	return textEncoder.encode(input).length;
}
function parseReplayWindow(value, visibleCommitVersion) {
	if (!isUnknownRecord(value)) return {
		kind: "rejected",
		rejection: createRejection("SKIP_REPLAY_WINDOW_INVALID", { field: "replayWindow" })
	};
	const validFromVisibleCommitVersion = value.validFromVisibleCommitVersion;
	const validUntilVisibleCommitVersion = value.validUntilVisibleCommitVersion;
	if (!isNonNegativeSafeInteger(validFromVisibleCommitVersion) || !isNonNegativeSafeInteger(validUntilVisibleCommitVersion) || validFromVisibleCommitVersion > validUntilVisibleCommitVersion || visibleCommitVersion < validFromVisibleCommitVersion || visibleCommitVersion > validUntilVisibleCommitVersion) return {
		kind: "rejected",
		rejection: createRejection("SKIP_REPLAY_WINDOW_INVALID", {
			validFromVisibleCommitVersion: isNonNegativeSafeInteger(validFromVisibleCommitVersion) ? validFromVisibleCommitVersion : null,
			validUntilVisibleCommitVersion: isNonNegativeSafeInteger(validUntilVisibleCommitVersion) ? validUntilVisibleCommitVersion : null,
			visibleCommitVersion
		})
	};
	return {
		kind: "parsed",
		replayWindow: {
			validFromVisibleCommitVersion,
			validUntilVisibleCommitVersion
		}
	};
}
function currentCommitVersionMatchesReplayWindow(currentVisibleCommitVersion, replayWindow) {
	if (currentVisibleCommitVersion === void 0) return true;
	return currentVisibleCommitVersion >= replayWindow.validFromVisibleCommitVersion && currentVisibleCommitVersion <= replayWindow.validUntilVisibleCommitVersion;
}
function parseEntryKind(id) {
	const parsed = AppElementsWire.parseElementKey(id);
	if (parsed === null) return null;
	return parsed.kind;
}
function isValidPayloadHash(value, limits) {
	return typeof value === "string" && value.length > 0 && value.length <= limits.maxPayloadHashLength && HASH_DIGEST_PATTERN.test(value);
}
function parseManifestEntry(value, limits, index) {
	if (!isUnknownRecord(value)) return rejectEntry("SKIP_ENTRY_MALFORMED", null, { index });
	const id = value.id;
	if (typeof id !== "string" || id.length === 0) return rejectEntry("SKIP_ENTRY_ID_INVALID", null, { index });
	if (id.length > limits.maxEntryIdLength) return rejectEntry("SKIP_ENTRY_ID_TOO_LONG", id, {
		idHash: createClientReusePayloadHash(id),
		maxEntryIdLength: limits.maxEntryIdLength
	});
	const kind = parseEntryKind(id);
	if (kind === null) return rejectEntry("SKIP_UNKNOWN_ENTRY", id, { idHash: createClientReusePayloadHash(id) });
	const privacy = value.privacy;
	if (privacy === "private") return rejectEntry("SKIP_PRIVATE_ENTRY", id, { privacy });
	if (privacy !== "public") return rejectEntry("SKIP_ENTRY_MALFORMED", id, { field: "privacy" });
	const payloadHash = value.payloadHash;
	if (!isValidPayloadHash(payloadHash, limits)) return rejectEntry("SKIP_ENTRY_HASH_INVALID", id, { maxPayloadHashLength: limits.maxPayloadHashLength });
	const variantCacheKey = value.variantCacheKey;
	if (typeof variantCacheKey !== "string" || variantCacheKey.length === 0) return rejectEntry("SKIP_VARIANT_CACHE_KEY_INVALID", id, { field: "variantCacheKey" });
	if (variantCacheKey.length > limits.maxVariantCacheKeyLength) return rejectEntry("SKIP_VARIANT_CACHE_KEY_TOO_LONG", id, {
		maxVariantCacheKeyLength: limits.maxVariantCacheKeyLength,
		variantCacheKeyHash: createClientReusePayloadHash(variantCacheKey)
	});
	const artifactCompatibility = parseArtifactCompatibilityEnvelope(value.artifactCompatibility);
	if (artifactCompatibility === null) return rejectEntry("SKIP_ARTIFACT_COMPATIBILITY_INVALID", id, { field: "artifactCompatibility" });
	return {
		artifactCompatibility,
		id,
		kind,
		payloadHash,
		privacy,
		variantCacheKey
	};
}
function createClientReusePayloadHash(input) {
	return fnv1a64(input);
}
function createClientReuseManifest(input) {
	const replayWindow = input.replayWindow ?? {
		validFromVisibleCommitVersion: input.visibleCommitVersion,
		validUntilVisibleCommitVersion: input.visibleCommitVersion
	};
	return {
		entries: createCanonicalWireEntries(input.entries),
		hashAlgorithm: CLIENT_REUSE_MANIFEST_HASH_ALGORITHM,
		replayWindow,
		schemaVersion: 1,
		visibleCommitVersion: input.visibleCommitVersion
	};
}
function serializeClientReuseManifest(input) {
	return JSON.stringify(createClientReuseManifest(input));
}
function parseClientReuseManifestHeader(rawHeader, options = {}) {
	const header = rawHeader?.trim();
	if (!header) return { kind: "absent" };
	const limits = options.limits ?? DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS;
	const manifestBytes = countUtf8Bytes(header);
	if (manifestBytes > limits.maxManifestBytes) return rejectManifest("SKIP_MANIFEST_TOO_LARGE", {
		manifestBytes,
		maxManifestBytes: limits.maxManifestBytes
	});
	let decoded;
	try {
		decoded = JSON.parse(header);
	} catch {
		return rejectManifest("SKIP_MANIFEST_MALFORMED");
	}
	if (!isUnknownRecord(decoded)) return rejectManifest("SKIP_MANIFEST_MALFORMED", { field: "manifest" });
	if (decoded.schemaVersion !== 1) return rejectManifest("SKIP_MANIFEST_SCHEMA_UNSUPPORTED", { schemaVersion: typeof decoded.schemaVersion === "number" || typeof decoded.schemaVersion === "string" ? decoded.schemaVersion : null });
	if (decoded.hashAlgorithm !== "fnv1a64") return rejectManifest("SKIP_HASH_ALGORITHM_UNSUPPORTED", { hashAlgorithm: typeof decoded.hashAlgorithm === "string" ? decoded.hashAlgorithm : null });
	const visibleCommitVersion = decoded.visibleCommitVersion;
	if (!isNonNegativeSafeInteger(visibleCommitVersion)) return rejectManifest("SKIP_VISIBLE_COMMIT_VERSION_INVALID", { visibleCommitVersion: null });
	const replayWindowResult = parseReplayWindow(decoded.replayWindow, visibleCommitVersion);
	if (replayWindowResult.kind === "rejected") return {
		kind: "rejected",
		rejection: replayWindowResult.rejection
	};
	const { replayWindow } = replayWindowResult;
	if (!currentCommitVersionMatchesReplayWindow(options.currentVisibleCommitVersion, replayWindow)) return rejectManifest("SKIP_VISIBLE_COMMIT_VERSION_MISMATCH", {
		currentVisibleCommitVersion: options.currentVisibleCommitVersion ?? null,
		validFromVisibleCommitVersion: replayWindow.validFromVisibleCommitVersion,
		validUntilVisibleCommitVersion: replayWindow.validUntilVisibleCommitVersion,
		visibleCommitVersion
	});
	const entriesValue = decoded.entries;
	if (!Array.isArray(entriesValue)) return rejectManifest("SKIP_MANIFEST_MALFORMED", { field: "entries" });
	if (entriesValue.length > limits.maxEntryCount) return rejectManifest("SKIP_ENTRY_COUNT_EXCEEDED", {
		entryCount: entriesValue.length,
		maxEntryCount: limits.maxEntryCount
	});
	const entries = [];
	const entryRejections = [];
	let previousEntryId = null;
	for (let index = 0; index < entriesValue.length; index++) {
		const value = entriesValue[index];
		if (isUnknownRecord(value) && typeof value.id === "string") {
			if (previousEntryId !== null && value.id <= previousEntryId) return rejectManifest("SKIP_ENTRY_ORDER_NON_CANONICAL", {
				entryIdHash: createClientReusePayloadHash(value.id),
				previousEntryIdHash: createClientReusePayloadHash(previousEntryId)
			});
			previousEntryId = value.id;
		}
		const parsedEntry = parseManifestEntry(value, limits, index);
		if ("code" in parsedEntry) entryRejections.push(parsedEntry);
		else entries.push(parsedEntry);
	}
	return {
		entryRejections,
		kind: "parsed",
		manifest: {
			entries,
			hashAlgorithm: CLIENT_REUSE_MANIFEST_HASH_ALGORITHM,
			replayWindow,
			schemaVersion: 1,
			visibleCommitVersion
		},
		skipDisposition: {
			code: "SKIP_MODEL_DISABLED",
			enabled: false,
			mode: "renderAndSend"
		}
	};
}
//#endregion
export { CLIENT_REUSE_MANIFEST_HASH_ALGORITHM, CLIENT_REUSE_MANIFEST_SCHEMA_VERSION, CLIENT_REUSE_MANIFEST_SKIP_VERIFICATION_ENTRY_BUDGET, DEFAULT_CLIENT_REUSE_MANIFEST_LIMITS, countUtf8Bytes, createClientReuseManifest, createClientReusePayloadHash, parseClientReuseManifestHeader, serializeClientReuseManifest };
