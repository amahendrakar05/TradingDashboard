//#region src/server/app-browser-rsc-redirect.d.ts
declare function blockDangerousStreamedRscRedirect(response: Response, streamedRedirectTarget: string | null): boolean;
type RscRedirectHistoryUpdateMode = "push" | "replace" | undefined;
type RscRedirectLifecycleDecision = {
  href: string;
  kind: "no-redirect";
} | {
  href: string;
  historyUpdateMode: RscRedirectHistoryUpdateMode;
  kind: "follow";
  previousNextUrl: string | null;
  redirectDepth: number;
} | {
  href: string;
  kind: "terminal-hard-navigation";
  reason: "externalRedirect" | "maxRedirectsExceeded";
  redirectDepth: number;
};
declare function resolveRscRedirectLifecycleHop(options: {
  currentHref: string;
  historyUpdateMode: RscRedirectHistoryUpdateMode;
  maxRedirectDepth?: number;
  origin: string;
  redirectDepth: number;
  requestPreviousNextUrl: string | null;
  responseUrl: string;
}): RscRedirectLifecycleDecision;
declare function resolveStreamedRscRedirectLifecycleHop(options: {
  currentHref: string;
  historyUpdateMode: Exclude<RscRedirectHistoryUpdateMode, undefined>;
  maxRedirectDepth?: number;
  origin: string;
  redirectDepth: number;
  requestPreviousNextUrl: string | null;
  streamedRedirectTarget: string;
}): RscRedirectLifecycleDecision;
//#endregion
export { blockDangerousStreamedRscRedirect, resolveRscRedirectLifecycleHop, resolveStreamedRscRedirectLifecycleHop };