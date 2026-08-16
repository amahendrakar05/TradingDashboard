import React from "react";
import { IncomingMessage, ServerResponse } from "node:http";

//#region src/shims/error.d.ts
type ErrorProps = {
  statusCode: number;
  hostname?: string;
  title?: string;
  withDarkMode?: boolean;
};
type ErrorPageContext = {
  err?: (Error & {
    statusCode?: number;
  }) | null;
  req?: IncomingMessage;
  res?: ServerResponse;
};
declare function getErrorInitialProps({
  err,
  req,
  res
}: ErrorPageContext): ErrorProps;
declare class ErrorComponent<P = {}> extends React.Component<P & ErrorProps> {
  static displayName: string;
  static getInitialProps: typeof getErrorInitialProps;
  static origGetInitialProps: typeof getErrorInitialProps;
  render(): React.ReactElement;
}
type ErrorInfo = {
  error: Error;
  reset: () => void;
  unstable_retry: () => void;
};
type _UserProps = Record<string, unknown>;
/**
 * Wrap a fallback render function in a Component-level error boundary.
 * Returns a Component that renders `children` and, on error, renders the
 * supplied fallback with an `ErrorInfo` value.
 *
 * Ported from Next.js:
 *   https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/catch-error.tsx
 */
declare function unstable_catchError<P extends _UserProps>(fallback: (props: P, errorInfo: ErrorInfo) => React.ReactNode): React.ComponentType<P & {
  children?: React.ReactNode;
}>;
//#endregion
export { ErrorInfo, ErrorProps, ErrorComponent as default, unstable_catchError };