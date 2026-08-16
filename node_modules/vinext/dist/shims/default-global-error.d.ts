import React from "react";

//#region src/shims/default-global-error.d.ts
/**
 * Ported from Next.js's built-in default global error component:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/builtin/global-error.tsx
 *
 * Rendered when an unhandled error reaches the root error boundary and the
 * user has not supplied their own `app/global-error.tsx`. Matches the
 * markup, inline styles, and theme CSS that Next.js's
 * `test/e2e/app-dir/default-error-page-ui/default-error-page-ui.test.ts`
 * exercises:
 *   - `<h1>` reads "This page couldn't load"
 *   - `<p>` contains "Reload to try again, or go back" (client error) or
 *     "A server error occurred. Reload to try again." (server error)
 *   - First `<button>` is "Reload" (form submit triggers a page reload)
 *   - Second `<button>` is "Back" (only for client errors)
 *   - Server errors render an "ERROR <digest>" footer
 *   - SVG warning icon is 32x32
 */
type DefaultGlobalErrorProps = {
  error: {
    digest?: string;
  } | null | undefined;
  reset?: () => void;
};
declare function DefaultGlobalError({
  error
}: DefaultGlobalErrorProps): React.JSX.Element;
//#endregion
export { DefaultGlobalError as default };