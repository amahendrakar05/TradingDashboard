//#region src/shims/app-router-scroll-state.d.ts
type AppRouterScrollIntent = Readonly<{
  commitId: number | null;
  hash: string | null;
  headElements: ReadonlySet<Element> | null;
  id: number;
  targetHoistedInHead: boolean;
}>;
declare function beginAppRouterScrollIntent(hash: string | null): AppRouterScrollIntent;
declare function clearAppRouterScrollIntent(): void;
declare function getPendingAppRouterScrollIntent(): AppRouterScrollIntent | null;
declare function claimAppRouterScrollIntentForCommit(expected: AppRouterScrollIntent | null | undefined, commitId: number): void;
declare function markAppRouterScrollIntentHeadHoisted(expected: AppRouterScrollIntent | null | undefined, commitId: number): void;
declare function consumeAppRouterScrollIntent(expected: AppRouterScrollIntent | null | undefined, commitId?: number): AppRouterScrollIntent | null;
//#endregion
export { AppRouterScrollIntent, beginAppRouterScrollIntent, claimAppRouterScrollIntentForCommit, clearAppRouterScrollIntent, consumeAppRouterScrollIntent, getPendingAppRouterScrollIntent, markAppRouterScrollIntentHeadHoisted };