import { FormHTMLAttributes, useActionState } from "react";

//#region src/shims/form.d.ts
type FormSubmitter = HTMLButtonElement | HTMLInputElement;
declare function createFormSubmitDestinationUrl(action: string, form: HTMLFormElement, submitter: FormSubmitter | null): string;
declare const Form: import("react").ForwardRefExoticComponent<{
  /** Target URL for GET forms, or server action for POST forms */action: string | ((formData: FormData) => void | Promise<void>); /** Replace instead of push in history (default: false) */
  replace?: boolean; /** Scroll to top after navigation (default: true) */
  scroll?: boolean;
  /**
   * Controls whether the form's target URL is prefetched when the form enters
   * the viewport. Only applies to App Router with a string `action`.
   * - `null` (default): prefetch automatically (production only)
   * - `false`: disable prefetching
   *
   * In pages dir, prefetch is not supported and the prop has no effect.
   */
  prefetch?: false | null;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "encType" | "method" | "target"> & import("react").RefAttributes<HTMLFormElement>>;
//#endregion
export { createFormSubmitDestinationUrl, Form as default, useActionState };