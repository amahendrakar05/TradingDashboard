//#region src/server/operation-token.d.ts
type OperationLane = "hmr" | "navigation" | "prefetch" | "refresh" | "server-action" | "traverse";
type OperationToken = {
  operationId: number;
  lane: OperationLane;
  navigationId: number;
  baseVisibleCommitVersion: number;
  graphVersion: string | null;
  deploymentVersion: string | null;
  targetSnapshotFingerprint: string;
  cacheVariantFingerprint?: string;
};
declare const verifiedOperationTokenBrand: unique symbol;
type VerifiedOperationToken = OperationToken & {
  readonly [verifiedOperationTokenBrand]: true;
};
type OperationTokenAuthority = {
  activeNavigationId: number;
  visibleCommitVersion: number;
  graphVersion: string | null;
  installedCacheVariantFingerprint: string | null;
};
type OperationTokenDimension = "navigation" | "visibleCommit" | "graphVersion" | "cacheVariant";
type OperationTokenRejectionReason = "staleNavigation" | "staleVisibleCommit" | "graphVersionMismatch" | "graphVersionMissing" | "cacheVariantMismatch" | "cacheVariantMissing";
type OperationTokenVerdict = {
  readonly authorized: true;
  readonly token: VerifiedOperationToken;
} | {
  readonly authorized: false;
  readonly reason: OperationTokenRejectionReason;
};
type OperationTokenVerificationPolicy = {
  check: readonly OperationTokenDimension[];
  require: readonly OperationTokenDimension[];
};
declare function verifyOperationToken(token: OperationToken, authority: OperationTokenAuthority, policy: OperationTokenVerificationPolicy): OperationTokenVerdict;
declare function verifyOperationTokenForCommit(token: OperationToken, authority: Pick<OperationTokenAuthority, "activeNavigationId" | "visibleCommitVersion">): OperationTokenVerdict;
declare function verifyOperationTokenForCacheReuse(token: OperationToken, authority: Pick<OperationTokenAuthority, "graphVersion" | "installedCacheVariantFingerprint">): OperationTokenVerdict;
//#endregion
export { OperationLane, OperationToken, OperationTokenAuthority, OperationTokenRejectionReason, OperationTokenVerdict, OperationTokenVerificationPolicy, VerifiedOperationToken, verifyOperationToken, verifyOperationTokenForCacheReuse, verifyOperationTokenForCommit };