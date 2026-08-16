"use client";
import { VINEXT_MOUNTED_SLOTS_HEADER } from "../server/headers.js";
import { assertSafeNavigationUrl } from "./url-safety.js";
import { AppElementsWire } from "../server/app-elements-wire.js";
import { APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL } from "../server/app-rsc-render-mode.js";
import "../server/app-elements.js";
import { withBasePath } from "./url-utils.js";
import { isBotUserAgent } from "../utils/html-limited-bots.js";
import { createRscRequestHeaders, createRscRequestUrl } from "../server/app-rsc-cache-busting.js";
import { hasAppNavigationRuntime } from "../client/navigation-runtime.js";
import { getMountedSlotsHeader, getPrefetchInterceptionContext, getPrefetchedUrls, hasPrefetchCacheEntryForNavigation, navigateClientSide, prefetchRscResponse } from "./navigation.js";
import { useMergedRef } from "./use-merged-ref.js";
import { forwardRef, useActionState, useCallback, useEffect, useRef } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/shims/form.tsx
/**
* next/form shim
*
* Progressive enhancement form component. In Next.js, this replaces
* the standard <form> element with one that intercepts submissions
* and performs client-side navigation for GET forms (search forms).
*
* For POST forms with server actions, it delegates to React's built-in
* form action handling.
*
* Usage:
*   import Form from 'next/form';
*   <Form action="/search">
*     <input name="q" />
*     <button type="submit">Search</button>
*   </Form>
*/
const __basePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";
const DISALLOWED_FORM_PROPS = [
	"method",
	"encType",
	"target"
];
const SUPPORTED_FORM_ENCTYPE = "application/x-www-form-urlencoded";
const SUPPORTED_FORM_METHOD = "GET";
const SUPPORTED_FORM_TARGET = "_self";
function isPrefetchableAction(action) {
	try {
		const actionUrl = new URL(action, window.location.href);
		return (actionUrl.protocol === "http:" || actionUrl.protocol === "https:") && actionUrl.origin === window.location.origin;
	} catch {
		return false;
	}
}
function getSubmitter(nativeEvent) {
	const submitter = nativeEvent && typeof nativeEvent === "object" && "submitter" in nativeEvent && nativeEvent.submitter instanceof Element ? nativeEvent.submitter : null;
	if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) return submitter;
	return null;
}
function hasReactServerActionAttributes(submitter) {
	const name = submitter.getAttribute("name");
	return Boolean(name && (name.startsWith("$ACTION_ID_") || name.startsWith("$ACTION_REF_")));
}
function hasReactClientActionAttributes(submitter) {
	const action = submitter.getAttribute("formAction");
	return Boolean(action && /\s*javascript:/i.test(action));
}
function getEffectiveAction(submitter, formAction) {
	return submitter?.getAttribute("formaction") ?? formAction;
}
function checkFormActionUrl(action, source) {
	const aPropName = source === "action" ? "an `action`" : "a `formAction`";
	let testUrl;
	try {
		testUrl = new URL(action, "http://n");
	} catch {
		console.error(`<Form> received ${aPropName} that cannot be parsed as a URL: "${action}".`);
		return;
	}
	if (testUrl.searchParams.size) console.warn(`<Form> received ${aPropName} that contains search params: "${action}". This is not supported, and they will be ignored. If you need to pass in additional search params, use an \`<input type="hidden" />\` instead.`);
}
function hasUnsupportedSubmitterAttributes(submitter) {
	const formEncType = submitter.getAttribute("formenctype");
	if (formEncType !== null && formEncType !== SUPPORTED_FORM_ENCTYPE) {
		if (process.env.NODE_ENV !== "production") console.error(`<Form>'s \`encType\` was set to an unsupported value via \`formEncType="${formEncType}"\`. This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
		return true;
	}
	const formMethod = submitter.getAttribute("formmethod");
	if (formMethod !== null && formMethod.toUpperCase() !== SUPPORTED_FORM_METHOD) {
		if (process.env.NODE_ENV !== "production") console.error(`<Form>'s \`method\` was set to an unsupported value via \`formMethod="${formMethod}"\`. This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
		return true;
	}
	const formTarget = submitter.getAttribute("formtarget");
	if (formTarget !== null && formTarget !== SUPPORTED_FORM_TARGET) {
		if (process.env.NODE_ENV !== "production") console.error(`<Form>'s \`target\` was set to an unsupported value via \`formTarget="${formTarget}"\`. This will disable <Form>'s navigation functionality. If you need this, use a native <form> element instead.`);
		return true;
	}
	return false;
}
function createFormSubmitDestinationUrl(action, form, submitter) {
	const targetUrl = new URL(action, window.location.href);
	if (targetUrl.searchParams.size) targetUrl.search = "";
	const formData = buildFormData(form, submitter);
	for (const [name, value] of formData) if (typeof value !== "string") {
		if (process.env.NODE_ENV !== "production") console.warn("<Form> only supports file inputs if `action` is a function. File inputs cannot be used if `action` is a string, because files cannot be encoded as search params.");
		targetUrl.searchParams.append(name, value.name);
	} else targetUrl.searchParams.append(name, value);
	return targetUrl.href;
}
function buildFormData(form, submitter) {
	if (!submitter) return new FormData(form);
	try {
		return new FormData(form, submitter);
	} catch {
		const formData = new FormData(form);
		if (!submitter.disabled && submitter.name) formData.append(submitter.name, submitter.value);
		return formData;
	}
}
const Form = forwardRef(function Form(props, ref) {
	const { action, replace = false, scroll = true, prefetch = null, onSubmit, ...rest } = props;
	const isNavigatingForm = typeof action === "string";
	if (process.env.NODE_ENV !== "production") {
		if (typeof action === "string") checkFormActionUrl(action, "action");
		if (!(props.prefetch === void 0 || props.prefetch === false || props.prefetch === null)) console.error("The `prefetch` prop of <Form> must be `false` or `null`");
		if (props.prefetch !== void 0 && !isNavigatingForm) console.error("Passing `prefetch` to a <Form> whose `action` is a function has no effect.");
		if (!isNavigatingForm && (props.replace !== void 0 || props.scroll !== void 0)) console.error("Passing `replace` or `scroll` to a <Form> whose `action` is a function has no effect.\nSee the relevant docs to learn how to control this behavior for navigations triggered from actions:\n  `redirect()`       - https://nextjs.org/docs/app/api-reference/functions/redirect#parameters\n  `router.replace()` - https://nextjs.org/docs/app/api-reference/functions/use-router#userouter\n");
	}
	const cleanRest = { ...rest };
	for (const key of DISALLOWED_FORM_PROPS) if (key in cleanRest) {
		if (process.env.NODE_ENV !== "production") console.error(`<Form> does not support changing \`${key}\`. ` + (isNavigatingForm ? "If you'd like to use it to perform a mutation, consider making `action` a function instead.\nLearn more: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations" : ""));
		delete cleanRest[key];
	}
	const formRef = useRef(null);
	const setRefs = useMergedRef(useCallback((node) => {
		formRef.current = node;
	}, []), ref ?? null);
	const actionHref = typeof action === "string" ? withBasePath(action, __basePath) : "";
	useEffect(() => {
		if (typeof action !== "string") return;
		if (prefetch === false || process.env.NODE_ENV !== "production") return;
		if (!isPrefetchableAction(actionHref)) return;
		if (!hasAppNavigationRuntime()) return;
		const node = formRef.current;
		if (!node) return;
		if (typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) if (entry.isIntersecting || entry.intersectionRatio > 0) {
				(async () => {
					if (isBotUserAgent(window.navigator?.userAgent ?? "")) return;
					const interceptionContext = getPrefetchInterceptionContext(actionHref);
					const mountedSlotsHeader = getMountedSlotsHeader();
					const headers = createRscRequestHeaders({
						interceptionContext,
						renderMode: APP_RSC_RENDER_MODE_PREFETCH_LOADING_SHELL
					});
					if (mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
					const rscUrl = await createRscRequestUrl(actionHref, headers);
					const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
					const prefetched = getPrefetchedUrls();
					if (prefetched.has(cacheKey)) return;
					if (hasPrefetchCacheEntryForNavigation(rscUrl, interceptionContext, mountedSlotsHeader)) return;
					prefetched.add(cacheKey);
					prefetchRscResponse(rscUrl, fetch(rscUrl, {
						headers,
						credentials: "include",
						priority: "low",
						purpose: "prefetch"
					}), interceptionContext, mountedSlotsHeader, void 0, {
						cacheForNavigation: false,
						optimisticRouteShell: true
					});
				})();
				observer.unobserve(node);
			}
		}, { rootMargin: "200px" });
		observer.observe(node);
		return () => {
			observer.unobserve(node);
		};
	}, [
		action,
		prefetch,
		actionHref
	]);
	if (typeof action === "function") return /* @__PURE__ */ jsx("form", {
		ref: setRefs,
		action,
		onSubmit,
		...cleanRest
	});
	function handleSubmit(e) {
		if (onSubmit) {
			onSubmit(e);
			if (e.defaultPrevented) return;
		}
		const submitter = getSubmitter(e.nativeEvent);
		if (submitter) {
			if (process.env.NODE_ENV !== "production" && hasReactServerActionAttributes(submitter)) return;
			if (hasUnsupportedSubmitterAttributes(submitter)) return;
			if (hasReactClientActionAttributes(submitter)) return;
		}
		const effectiveAction = getEffectiveAction(submitter, actionHref);
		if (process.env.NODE_ENV !== "production" && submitter?.getAttribute("formaction") !== null) checkFormActionUrl(effectiveAction, "formAction");
		const url = createFormSubmitDestinationUrl(effectiveAction, e.currentTarget, submitter);
		e.preventDefault();
		if (hasAppNavigationRuntime()) {
			assertSafeNavigationUrl(url);
			navigateClientSide(url, replace ? "replace" : "push", scroll);
		} else {
			assertSafeNavigationUrl(url);
			(async () => {
				let Router;
				try {
					Router = (await import("./router.js")).default;
					if (replace) await Router.replace(url, void 0, { scroll });
					else await Router.push(url, void 0, { scroll });
				} catch {
					if (replace) window.location.replace(url);
					else window.location.assign(url);
				}
			})();
		}
	}
	return /* @__PURE__ */ jsx("form", {
		ref: setRefs,
		action: actionHref,
		onSubmit: (event) => {
			handleSubmit(event);
		},
		...cleanRest
	});
});
//#endregion
export { createFormSubmitDestinationUrl, Form as default, useActionState };
