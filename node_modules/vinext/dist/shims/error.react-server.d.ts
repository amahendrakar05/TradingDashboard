//#region src/shims/error.react-server.d.ts
type ErrorInfo = {
  error: unknown;
  reset: () => void;
  unstable_retry: () => void;
};
declare function unstable_catchError(): never;
//#endregion
export { ErrorInfo, unstable_catchError };