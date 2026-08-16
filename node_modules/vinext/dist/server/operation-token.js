//#region src/server/operation-token.ts
const DIMENSION_ORDER = [
	"navigation",
	"visibleCommit",
	"graphVersion",
	"cacheVariant"
];
function evaluateDimension(dimension, token, authority) {
	switch (dimension) {
		case "navigation": return token.navigationId === authority.activeNavigationId ? { kind: "satisfied" } : {
			kind: "mismatch",
			reason: "staleNavigation"
		};
		case "visibleCommit": return token.baseVisibleCommitVersion === authority.visibleCommitVersion ? { kind: "satisfied" } : {
			kind: "mismatch",
			reason: "staleVisibleCommit"
		};
		case "graphVersion":
			if (token.graphVersion === null || authority.graphVersion === null) return {
				kind: "absent",
				missingReason: "graphVersionMissing"
			};
			return token.graphVersion === authority.graphVersion ? { kind: "satisfied" } : {
				kind: "mismatch",
				reason: "graphVersionMismatch"
			};
		case "cacheVariant": {
			const tokenVariant = token.cacheVariantFingerprint;
			const installedVariant = authority.installedCacheVariantFingerprint;
			if (tokenVariant === void 0 || installedVariant === null) return {
				kind: "absent",
				missingReason: "cacheVariantMissing"
			};
			return tokenVariant === installedVariant ? { kind: "satisfied" } : {
				kind: "mismatch",
				reason: "cacheVariantMismatch"
			};
		}
		default: throw new Error("[vinext] Unknown operation-token dimension: " + String(dimension));
	}
}
function verifyOperationToken(token, authority, policy) {
	const required = new Set(policy.require);
	const evaluated = /* @__PURE__ */ new Set([...policy.check, ...policy.require]);
	for (const dimension of DIMENSION_ORDER) {
		if (!evaluated.has(dimension)) continue;
		const status = evaluateDimension(dimension, token, authority);
		if (status.kind === "mismatch") return {
			authorized: false,
			reason: status.reason
		};
		if (status.kind === "absent" && required.has(dimension)) return {
			authorized: false,
			reason: status.missingReason
		};
	}
	return {
		authorized: true,
		token
	};
}
function verifyOperationTokenForCommit(token, authority) {
	return verifyOperationToken(token, {
		activeNavigationId: authority.activeNavigationId,
		visibleCommitVersion: authority.visibleCommitVersion,
		graphVersion: token.graphVersion,
		installedCacheVariantFingerprint: token.cacheVariantFingerprint ?? null
	}, {
		check: ["navigation", "visibleCommit"],
		require: ["navigation", "visibleCommit"]
	});
}
function verifyOperationTokenForCacheReuse(token, authority) {
	return verifyOperationToken(token, {
		activeNavigationId: token.navigationId,
		visibleCommitVersion: token.baseVisibleCommitVersion,
		graphVersion: authority.graphVersion,
		installedCacheVariantFingerprint: authority.installedCacheVariantFingerprint
	}, {
		check: ["graphVersion", "cacheVariant"],
		require: []
	});
}
//#endregion
export { verifyOperationToken, verifyOperationTokenForCacheReuse, verifyOperationTokenForCommit };
