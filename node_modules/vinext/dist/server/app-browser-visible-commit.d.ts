import { RouteManifest } from "../routing/app-route-graph.js";
import { AppElements } from "./app-elements-wire.js";
import { NavigationTrace } from "./navigation-trace.js";
import { OperationLane } from "./operation-token.js";
import { ClientNavigationRenderSnapshot } from "../shims/navigation.js";
import { AppNavigationPayloadOrigin, AppRouterAction, AppRouterState, PendingNavigationCommit } from "./app-browser-state.js";

//#region src/server/app-browser-visible-commit.d.ts
type VisibleCommitDecision = {
  disposition: "commit";
  preserveAbsentSlots: boolean;
  preserveElementIds: readonly string[];
  preservePreviousSlotIds: readonly string[];
  trace: NavigationTrace;
};
type HardNavigateCommitDecision = {
  disposition: "hard-navigate";
  trace: NavigationTrace;
};
type NoCommitDecision = {
  disposition: "no-commit";
  trace: NavigationTrace;
};
type CommitDecision = VisibleCommitDecision | HardNavigateCommitDecision | NoCommitDecision;
declare const approvedVisibleCommitBrand: unique symbol;
type ApprovedVisibleCommit = {
  readonly [approvedVisibleCommitBrand]: true;
  readonly action: AppRouterAction;
  readonly decision: VisibleCommitDecision;
  readonly interception: AppRouterAction["interception"];
  readonly interceptionContext: string | null;
  readonly previousNextUrl: string | null;
  readonly rootLayoutTreePath: string | null;
  readonly routeId: string;
};
type VisibleCommitApproval = {
  approvedCommit: ApprovedVisibleCommit;
  decision: VisibleCommitDecision;
};
type NonVisibleCommitApproval = {
  approvedCommit: null;
  decision: HardNavigateCommitDecision | NoCommitDecision;
};
type CommitApproval = VisibleCommitApproval | NonVisibleCommitApproval;
type ClassifiedPendingNavigationCommit = {
  approvedCommit: ApprovedVisibleCommit | null;
  decision: CommitDecision;
  pending: PendingNavigationCommit;
  trace: NavigationTrace;
};
declare function applyApprovedVisibleCommit(state: AppRouterState, commit: ApprovedVisibleCommit): AppRouterState;
declare function approveHmrVisibleCommit(options: {
  currentState: AppRouterState;
  pending: PendingNavigationCommit;
  routeManifest?: RouteManifest | null;
  targetHref: string;
}): CommitApproval;
declare function approvePendingNavigationCommit(options: {
  activeNavigationId: number;
  currentState: AppRouterState;
  pending: PendingNavigationCommit;
  routeManifest?: RouteManifest | null;
  startedNavigationId: number;
  targetHref: string;
}): CommitApproval;
declare function resolveAndClassifyNavigationCommit(options: {
  activeNavigationId: number;
  currentState: AppRouterState;
  getActiveNavigationId?: () => number;
  getCurrentStateForApproval?: () => AppRouterState;
  navigationSnapshot: ClientNavigationRenderSnapshot;
  nextElements: Promise<AppElements>;
  operationLane: OperationLane;
  payloadOrigin: AppNavigationPayloadOrigin;
  previousNextUrl?: string | null;
  renderId: number;
  routeManifest?: RouteManifest | null;
  startedNavigationId: number;
  targetHref: string;
  type: "navigate" | "replace" | "traverse";
}): Promise<ClassifiedPendingNavigationCommit>;
//#endregion
export { ApprovedVisibleCommit, applyApprovedVisibleCommit, approveHmrVisibleCommit, approvePendingNavigationCommit, resolveAndClassifyNavigationCommit };