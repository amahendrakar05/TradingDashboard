import { NEXTJS_ACTION_NOT_FOUND_HEADER } from "./headers.js";
import { UnrecognizedActionError } from "../shims/unrecognized-action-error.js";
//#region src/server/server-action-not-found.ts
const SERVER_ACTION_NOT_FOUND_DOCS = "https://nextjs.org/docs/messages/failed-to-find-server-action";
const SERVER_ACTION_NOT_FOUND_BODY = "Server action not found.";
function getServerActionNotFoundPrefix(actionId) {
	return `Failed to find Server Action${actionId ? ` "${actionId}"` : ""}.`;
}
function getServerActionNotFoundMessage(actionId) {
	return `${getServerActionNotFoundPrefix(actionId)} This request might be from an older or newer deployment.\nRead more: ${SERVER_ACTION_NOT_FOUND_DOCS}`;
}
function getServerActionNotFoundClientMessage(actionId) {
	return `Server Action "${actionId}" was not found on the server. \nRead more: ${SERVER_ACTION_NOT_FOUND_DOCS}`;
}
function getUnknownMessage(error) {
	if (error instanceof Error) return error.message;
	return typeof error === "string" ? error : "";
}
function isServerActionNotFoundError(error, actionId) {
	const message = getUnknownMessage(error);
	if (!message) return false;
	if (actionId && message.startsWith(getServerActionNotFoundPrefix(actionId))) return true;
	if (!actionId && message.startsWith("Failed to find Server Action")) return true;
	if (actionId) {
		const moduleId = actionId.split("#")[0];
		if (message.includes(`[vite-rsc] invalid server reference '${actionId}'`) || moduleId && moduleId !== actionId && message.includes(`[vite-rsc] invalid server reference '${moduleId}'`)) return true;
		if (message.includes(`server reference not found '${actionId}'`) || moduleId && moduleId !== actionId && message.includes(`server reference not found '${moduleId}'`)) return true;
		return false;
	}
	return /\[vite-rsc] invalid server reference '/.test(message) || /server reference not found '/.test(message);
}
function createServerActionNotFoundResponse() {
	return new Response(SERVER_ACTION_NOT_FOUND_BODY, {
		status: 404,
		headers: {
			[NEXTJS_ACTION_NOT_FOUND_HEADER]: "1",
			"content-type": "text/plain"
		}
	});
}
function isServerActionNotFoundResponse(response) {
	return response.headers.get(NEXTJS_ACTION_NOT_FOUND_HEADER) === "1";
}
/**
* Throw an `UnrecognizedActionError` when the server reported the requested
* server action id as unknown (the `x-nextjs-action-not-found` response
* header); otherwise return so the caller can keep processing the response.
*
* The client-side counterpart of `createServerActionNotFoundResponse`. The
* typed error lets client `catch` blocks call the public
* `unstable_isUnrecognizedActionError` predicate to detect client/server
* deployment skew and recover (typically by reloading the page).
*
* Mirrors Next.js, whose server-action reducer throws `UnrecognizedActionError`
* on this same response header:
* https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts
*/
function throwOnServerActionNotFound(response, actionId) {
	if (isServerActionNotFoundResponse(response)) throw new UnrecognizedActionError(getServerActionNotFoundClientMessage(actionId));
}
//#endregion
export { createServerActionNotFoundResponse, getServerActionNotFoundMessage, isServerActionNotFoundError, throwOnServerActionNotFound };
