import * as React$1 from "react";

//#region src/shims/app-router-scroll.d.ts
declare class AppRouterScrollTargetInner extends React$1.Component<{
  children: React$1.ReactNode;
  commitId: number | null;
}> {
  scheduledCommitId: number | null;
  schedulePotentialScroll: () => void;
  handlePotentialScroll: () => void;
  componentDidMount(): void;
  componentDidUpdate(): void;
  componentWillUnmount(): void;
  render(): React$1.ReactNode;
}
declare function AppRouterScrollCommitProvider({
  children,
  commitId
}: {
  children?: React$1.ReactNode;
  commitId: number | null;
}): React$1.JSX.Element;
declare function AppRouterScrollTarget({
  children
}: {
  children: React$1.ReactNode;
}): React$1.JSX.Element;
//#endregion
export { AppRouterScrollCommitProvider, AppRouterScrollTarget, AppRouterScrollTargetInner };