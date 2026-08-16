import React from "react";

//#region src/shims/error-boundary.d.ts
type ErrorBoundaryProps = {
  fallback: React.ComponentType<{
    error: unknown;
    reset: () => void;
  }>;
  children: React.ReactNode;
  resetKey?: string | null;
};
type SerializedBoundaryError = {
  digest?: string;
  message: string;
  name?: string;
  stack?: string;
};
declare function SerializedErrorBoundary({
  fallback: Fallback,
  error
}: {
  fallback: React.ComponentType<{
    error: Error & {
      digest?: string;
    };
    reset: () => void;
  }>;
  error: SerializedBoundaryError;
}): React.JSX.Element;
type CapturedError = {
  thrownValue: unknown;
};
type RedirectBoundaryState = {
  redirect: string | null;
  redirectType: "push" | "replace" | null;
};
type ErrorBoundaryInnerProps = {
  isImplicitRootErrorBoundary?: boolean;
  pathname: string | null;
} & ErrorBoundaryProps;
type ErrorBoundaryState = {
  error: CapturedError | null;
  previousPathname: string | null;
  previousResetKey: string | null;
};
declare class RedirectErrorBoundary extends React.Component<{
  children?: React.ReactNode;
}, RedirectBoundaryState> {
  constructor(props: {
    children?: React.ReactNode;
  });
  static getDerivedStateFromError(error: unknown): RedirectBoundaryState;
  render(): string | number | bigint | boolean | React.JSX.Element | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | Iterable<React.ReactNode> | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | React.ReactPortal | null | undefined> | null | undefined;
}
declare function RedirectBoundary({
  children
}: {
  children?: React.ReactNode;
}): React.JSX.Element;
/**
 * Generic ErrorBoundary used to wrap route segments with error.tsx.
 * This must be a client component since error boundaries use
 * componentDidCatch / getDerivedStateFromError.
 */
declare class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps);
  static getDerivedStateFromProps(props: ErrorBoundaryInnerProps, state: ErrorBoundaryState): ErrorBoundaryState | null;
  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState>;
  handleDevErrorRecovery: () => void;
  componentDidMount(): void;
  componentWillUnmount(): void;
  reset: () => void;
  render(): string | number | bigint | boolean | React.JSX.Element | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | Iterable<React.ReactNode> | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | React.ReactPortal | null | undefined> | null | undefined;
}
declare function ErrorBoundary({
  fallback,
  children,
  resetKey
}: ErrorBoundaryProps): React.JSX.Element;
declare function GlobalErrorBoundary({
  fallback,
  children
}: {
  fallback: React.ComponentType<{
    error: unknown;
    reset: () => void;
  }>;
  children: React.ReactNode;
}): React.JSX.Element;
type NotFoundBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
  resetKey?: string | null;
};
/**
 * Wrapper that reads the current pathname and passes it to the inner class
 * component. Segment reset keys own App Router remount semantics when present.
 */
declare function NotFoundBoundary({
  fallback,
  children,
  resetKey
}: NotFoundBoundaryProps): React.JSX.Element;
type ForbiddenBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
  resetKey?: string | null;
};
type ForbiddenBoundaryInnerProps = {
  pathname: string | null;
} & ForbiddenBoundaryProps;
type ForbiddenBoundaryState = {
  forbidden: boolean;
  previousPathname: string | null;
  previousResetKey: string | null;
};
declare class ForbiddenBoundaryInner extends React.Component<ForbiddenBoundaryInnerProps, ForbiddenBoundaryState> {
  constructor(props: ForbiddenBoundaryInnerProps);
  static getDerivedStateFromProps(props: ForbiddenBoundaryInnerProps, state: ForbiddenBoundaryState): ForbiddenBoundaryState | null;
  static getDerivedStateFromError(error: unknown): Partial<ForbiddenBoundaryState>;
  render(): string | number | bigint | boolean | React.JSX.Element | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | Iterable<React.ReactNode> | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | React.ReactPortal | null | undefined> | null | undefined;
}
declare function ForbiddenBoundary({
  fallback,
  children,
  resetKey
}: ForbiddenBoundaryProps): React.JSX.Element;
type UnauthorizedBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
  resetKey?: string | null;
};
type UnauthorizedBoundaryInnerProps = {
  pathname: string | null;
} & UnauthorizedBoundaryProps;
type UnauthorizedBoundaryState = {
  unauthorized: boolean;
  previousPathname: string | null;
  previousResetKey: string | null;
};
declare class UnauthorizedBoundaryInner extends React.Component<UnauthorizedBoundaryInnerProps, UnauthorizedBoundaryState> {
  constructor(props: UnauthorizedBoundaryInnerProps);
  static getDerivedStateFromProps(props: UnauthorizedBoundaryInnerProps, state: UnauthorizedBoundaryState): UnauthorizedBoundaryState | null;
  static getDerivedStateFromError(error: unknown): Partial<UnauthorizedBoundaryState>;
  render(): string | number | bigint | boolean | React.JSX.Element | Iterable<React.ReactNode> | Promise<string | number | bigint | boolean | Iterable<React.ReactNode> | React.ReactElement<unknown, string | React.JSXElementConstructor<any>> | React.ReactPortal | null | undefined> | null | undefined;
}
declare function UnauthorizedBoundary({
  fallback,
  children,
  resetKey
}: UnauthorizedBoundaryProps): React.JSX.Element;
type DevRecoveryBoundaryProps = {
  isImplicitRootErrorBoundary?: boolean;
  resetKey: number;
  onCatch?: (resetKey: number) => void;
  children?: React.ReactNode;
};
type DevRecoveryBoundaryState = {
  error: CapturedError | null;
  previousResetKey: number;
};
declare class DevRecoveryBoundary extends React.Component<DevRecoveryBoundaryProps, DevRecoveryBoundaryState> {
  constructor(props: DevRecoveryBoundaryProps);
  static getDerivedStateFromProps(props: DevRecoveryBoundaryProps, state: DevRecoveryBoundaryState): DevRecoveryBoundaryState | null;
  static getDerivedStateFromError(error: unknown): Partial<DevRecoveryBoundaryState>;
  handleDevErrorRecovery: () => void;
  componentDidMount(): void;
  componentWillUnmount(): void;
  componentDidCatch(): void;
  render(): React.ReactNode;
}
//#endregion
export { DevRecoveryBoundary, DevRecoveryBoundaryProps, ErrorBoundary, ErrorBoundaryInner, ErrorBoundaryProps, ErrorBoundaryState, ForbiddenBoundary, ForbiddenBoundaryInner, GlobalErrorBoundary, NotFoundBoundary, RedirectBoundary, RedirectErrorBoundary, SerializedBoundaryError, SerializedErrorBoundary, UnauthorizedBoundary, UnauthorizedBoundaryInner };