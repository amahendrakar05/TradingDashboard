import { VINEXT_DEV_ERROR_RECOVERY_EVENT } from "../utils/dev-error-recovery-event.js";
import { isNavigationSignalError } from "../utils/navigation-signal.js";
import { VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT } from "../utils/dev-stack-sourcemap-endpoint.js";
import { dismissOverlay, expandOverlay, getOverlaySnapshot, minimizeOverlay, reportToOverlay, setOverlayIndex, subscribeOverlay, updateOverlayErrorStack } from "./dev-error-overlay-store.js";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
//#region src/client/dev-error-overlay.tsx
const DEV_ERROR_OVERLAY_HOST_ID = "__vinext_dev_error_overlay_root";
const DEV_ERROR_OVERLAY_MOUNT_ID = "__vinext_dev_error_overlay_mount";
const VITE_ERROR_HANDLER_DATA_KEY = "__vinext_vite_error_handler__";
const REACT_REFRESH_RECOVERY_RETRY_DELAY_MS = 16;
let reactRoot = null;
let installed = false;
const reportedErrors = /* @__PURE__ */ new WeakSet();
function rememberReported(error) {
	if (error && typeof error === "object") reportedErrors.add(error);
}
function alreadyReported(error) {
	return !!error && typeof error === "object" && reportedErrors.has(error);
}
function installDevErrorOverlay() {
	if (typeof window === "undefined") return;
	installReactRefreshErrorRecovery();
	if (installed) return;
	installed = true;
	window.addEventListener("error", (event) => {
		const err = event.error;
		if (isNavigationSignalError(err)) return;
		if (err instanceof Error) {
			if (alreadyReported(err)) return;
			reportDevError(err, { source: "window-error" });
		} else if (event.message) reportDevError(new Error(event.message), { source: "window-error" });
	});
	window.addEventListener("unhandledrejection", (event) => {
		const reason = event.reason;
		if (isNavigationSignalError(reason)) return;
		if (reason instanceof Error) {
			if (alreadyReported(reason)) return;
			reportDevError(reason, { source: "unhandledrejection" });
		} else reportDevError(new Error(String(reason)), { source: "unhandledrejection" });
	});
}
function installReactRefreshErrorRecovery() {
	if (typeof window === "undefined") return;
	if (tryInstallReactRefreshErrorRecovery()) return;
	const refreshWindow = window;
	if (refreshWindow.__vinextReactRefreshErrorRecoveryInstallScheduled) return;
	refreshWindow.__vinextReactRefreshErrorRecoveryInstallScheduled = true;
	let timeoutPending = false;
	const scheduleTimeoutRetry = (delay) => {
		if (timeoutPending) return;
		timeoutPending = true;
		window.setTimeout(() => {
			timeoutPending = false;
			retry();
		}, delay);
	};
	function retry() {
		if (tryInstallReactRefreshErrorRecovery()) {
			refreshWindow.__vinextReactRefreshErrorRecoveryInstallScheduled = false;
			return;
		}
		scheduleTimeoutRetry(REACT_REFRESH_RECOVERY_RETRY_DELAY_MS);
	}
	if (typeof queueMicrotask === "function") queueMicrotask(retry);
	else Promise.resolve().then(retry);
	scheduleTimeoutRetry(0);
}
function tryInstallReactRefreshErrorRecovery() {
	if (typeof window === "undefined") return false;
	const refreshWindow = window;
	if (refreshWindow.__vinextReactRefreshErrorRecoveryInstalled) return true;
	const register = refreshWindow.__registerBeforePerformReactRefresh;
	if (typeof register !== "function") return false;
	refreshWindow.__vinextReactRefreshErrorRecoveryInstalled = true;
	register(() => {
		window.dispatchEvent(new Event(VINEXT_DEV_ERROR_RECOVERY_EVENT));
		dismissOverlay();
	});
	return true;
}
function reportInitialDevServerErrors() {
	if (typeof window === "undefined") return;
	const errors = window.__VINEXT_INITIAL_DEV_ERRORS__;
	if (!errors || errors.length === 0) return;
	window.__VINEXT_INITIAL_DEV_ERRORS__ = [];
	for (const payload of errors) {
		const error = new Error(payload.message);
		if (payload.name) error.name = payload.name;
		if (payload.stack) error.stack = payload.stack;
		reportDevError(error, { source: "server" });
	}
}
function installViteHmrErrorHandler(hot) {
	if (!isViteHmrHotContext(hot) || typeof window === "undefined") return;
	const previousHandler = hot.data[VITE_ERROR_HANDLER_DATA_KEY];
	if (typeof previousHandler === "function" && hot.off) hot.off("vite:error", previousHandler);
	const handler = (payload) => {
		reportViteHmrError(payload);
	};
	hot.on("vite:error", handler);
	hot.data[VITE_ERROR_HANDLER_DATA_KEY] = handler;
	hot.dispose?.((data) => {
		if (data[VITE_ERROR_HANDLER_DATA_KEY] === handler) delete data[VITE_ERROR_HANDLER_DATA_KEY];
	});
}
function isViteHmrHotContext(value) {
	if (!value || typeof value !== "object") return false;
	const hot = value;
	return typeof hot.on === "function" && !!hot.data && typeof hot.data === "object";
}
function reportViteHmrError(payload) {
	const normalized = normalizeViteHmrError(payload);
	dismissOverlay();
	reportDevError(normalized.message, { source: "vite" });
}
function normalizeViteHmrError(payload) {
	const err = payload?.err;
	if (!err || typeof err !== "object") return { message: "Vite build error" };
	const plugin = stringValue(err.plugin);
	return { message: formatViteErrorMessage(stringValue(err.message) ?? "Vite build error", plugin, stringValue(err.frame)) };
}
function reportDevError(error, options) {
	if (typeof window === "undefined") return;
	rememberReported(error);
	const message = error instanceof Error ? error.message : typeof error === "string" ? error : safeStringify(error);
	const stack = error instanceof Error ? error.stack : void 0;
	ensureMounted();
	const id = reportToOverlay({
		source: options.source,
		message,
		stack,
		ignoredStackFrames: void 0,
		projectRoot: void 0,
		codeFrame: void 0,
		componentStack: options.componentStack
	});
	resolveBrowserStackTrace(stack).then((mappedStackTrace) => {
		if (mappedStackTrace.stack !== stack || mappedStackTrace.ignoredFrames !== void 0 || mappedStackTrace.codeFrame || mappedStackTrace.projectRoot) updateOverlayErrorStack(id, mappedStackTrace.stack, mappedStackTrace.ignoredFrames, mappedStackTrace.codeFrame, mappedStackTrace.projectRoot);
	});
}
function devOnCaughtError(error, errorInfo) {
	if (isNavigationSignalError(error)) return;
	console.error(error);
	if (errorInfo?.componentStack) console.error("The above error occurred in a React component:\n" + errorInfo.componentStack);
	reportDevError(error, {
		source: "caught",
		componentStack: errorInfo?.componentStack
	});
}
function devOnUncaughtError(error, errorInfo) {
	if (isNavigationSignalError(error)) return;
	console.error(error);
	if (errorInfo?.componentStack) console.error("The above error occurred in a React component:\n" + errorInfo.componentStack);
	reportDevError(error, {
		source: "uncaught",
		componentStack: errorInfo?.componentStack
	});
}
function safeStringify(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return Object.prototype.toString.call(value);
	}
}
function formatViteErrorMessage(message, plugin, frame) {
	const trimmedMessage = message.trim();
	const trimmedFrame = frame?.trim();
	const body = trimmedFrame && !trimmedMessage.includes(trimmedFrame) ? `${trimmedMessage}\n\n${trimmedFrame}` : trimmedMessage;
	return `${plugin ? `[plugin:${plugin}] ` : ""}${body || "Vite build error"}`;
}
function stringValue(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function ensureMounted() {
	if (reactRoot) return;
	reactRoot = createRoot(createDevErrorOverlayMountNode(document));
	reactRoot.render(/* @__PURE__ */ jsx(DevErrorOverlayApp, {}));
}
function createDevErrorOverlayMountNode(ownerDocument) {
	let host = ownerDocument.getElementById(DEV_ERROR_OVERLAY_HOST_ID);
	if (!host) {
		host = ownerDocument.createElement("div");
		host.id = DEV_ERROR_OVERLAY_HOST_ID;
		configureDevErrorOverlayHost(host);
		(ownerDocument.body ?? ownerDocument.documentElement).appendChild(host);
	} else configureDevErrorOverlayHost(host);
	if (typeof host.attachShadow !== "function") return host;
	const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
	let mountNode = shadowRoot.getElementById(DEV_ERROR_OVERLAY_MOUNT_ID);
	if (!mountNode) {
		mountNode = ownerDocument.createElement("div");
		mountNode.id = DEV_ERROR_OVERLAY_MOUNT_ID;
		shadowRoot.appendChild(mountNode);
	}
	return mountNode;
}
function configureDevErrorOverlayHost(host) {
	host.setAttribute("data-vinext-dev-error-overlay", "");
	host.style.position = "absolute";
	host.style.top = "0";
	host.style.left = "0";
	host.style.width = "0";
	host.style.height = "0";
	host.style.overflow = "visible";
	host.style.zIndex = "2147483647";
}
const SOURCE_LABEL = {
	server: "Server Error",
	vite: "Build Error",
	uncaught: "Unhandled Runtime Error",
	caught: "Runtime Error",
	"window-error": "Unhandled Script Error",
	unhandledrejection: "Unhandled Promise Rejection"
};
function DevErrorOverlayApp() {
	const state = useSyncExternalStore(subscribeOverlay, getOverlaySnapshot, getOverlaySnapshot);
	if (state.errors.length === 0) return null;
	const current = state.errors[state.index] ?? state.errors[0];
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("style", { children: overlayStylesheet }), state.minimized ? /* @__PURE__ */ jsx(DevErrorIndicator, {
		count: state.errors.length,
		source: current.source,
		onExpand: expandOverlay
	}) : /* @__PURE__ */ jsx(DevErrorOverlay, {
		error: current,
		index: state.index,
		total: state.errors.length,
		onPrev: () => setOverlayIndex(state.index - 1),
		onNext: () => setOverlayIndex(state.index + 1),
		onMinimize: minimizeOverlay,
		onDismiss: dismissOverlay
	})] });
}
function DevErrorIndicator({ count, source, onExpand }) {
	return /* @__PURE__ */ jsx("div", {
		style: indicatorContainerStyle,
		children: /* @__PURE__ */ jsxs("button", {
			type: "button",
			"data-testid": "vinext-dev-error-indicator",
			"aria-label": `${count} runtime error${count === 1 ? "" : "s"} — click to expand`,
			title: SOURCE_LABEL[source],
			onClick: onExpand,
			className: "vinext-overlay-indicator",
			children: [/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				style: indicatorIconStyle,
				children: "⚠"
			}), /* @__PURE__ */ jsx("span", {
				"data-testid": "vinext-dev-error-indicator-count",
				style: indicatorCountStyle,
				children: count
			})]
		})
	});
}
function DevErrorOverlay({ error, index, total, onPrev, onNext, onMinimize, onDismiss }) {
	const isBuildError = error.source === "vite";
	const frames = useMemo(() => error.stack && !isBuildError ? parseStack(error.stack).map((frame, frameIndex) => createDisplayStackFrame(frame, error.ignoredStackFrames?.[frameIndex] ?? false, error.projectRoot)) : [], [
		error.stack,
		error.ignoredStackFrames,
		error.projectRoot,
		isBuildError
	]);
	const [showIgnoredFrames, setShowIgnoredFrames] = useState(false);
	const ignoredFramesTally = frames.some((frame) => !frame.ignored) ? frames.reduce((tally, frame) => tally + (frame.ignored ? 1 : 0), 0) : 0;
	const visibleFrames = showIgnoredFrames || ignoredFramesTally === 0 ? frames : frames.filter((frame) => !frame.ignored);
	useEffect(() => {
		setShowIgnoredFrames(false);
	}, [error.id]);
	useEffect(() => {
		const onKey = (e) => {
			if (e.key === "Escape") onMinimize();
			else if (e.key === "ArrowLeft" && total > 1) onPrev();
			else if (e.key === "ArrowRight" && total > 1) onNext();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		onMinimize,
		onPrev,
		onNext,
		total
	]);
	return /* @__PURE__ */ jsx("div", {
		style: backdropStyle,
		"data-testid": "vinext-dev-error-backdrop",
		onClick: onMinimize,
		children: /* @__PURE__ */ jsxs("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": SOURCE_LABEL[error.source],
			"data-testid": "vinext-dev-error-overlay",
			style: dialogStyle,
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ jsxs("header", {
				style: headerStyle,
				children: [/* @__PURE__ */ jsxs("div", {
					style: headerLeftStyle,
					children: [/* @__PURE__ */ jsx("span", {
						"data-testid": "vinext-dev-error-title",
						style: badgeStyle,
						children: SOURCE_LABEL[error.source]
					}), total > 1 ? /* @__PURE__ */ jsxs("div", {
						"data-testid": "vinext-dev-error-pagination",
						style: paginationStyle,
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "button",
								"data-testid": "vinext-dev-error-prev",
								onClick: onPrev,
								disabled: index === 0,
								className: "vinext-overlay-nav",
								"aria-label": "Previous error",
								children: "‹"
							}),
							/* @__PURE__ */ jsxs("span", {
								"data-testid": "vinext-dev-error-counter",
								style: counterStyle,
								children: [
									index + 1,
									" of ",
									total
								]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								"data-testid": "vinext-dev-error-next",
								onClick: onNext,
								disabled: index === total - 1,
								className: "vinext-overlay-nav",
								"aria-label": "Next error",
								children: "›"
							})
						]
					}) : null]
				}), /* @__PURE__ */ jsxs("div", {
					style: headerActionsStyle,
					children: [/* @__PURE__ */ jsx(CopyErrorButton, {
						error,
						frames
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						"data-testid": "vinext-dev-error-close",
						onClick: onDismiss,
						className: "vinext-overlay-close",
						"aria-label": "Dismiss",
						title: "Dismiss all errors",
						children: "×"
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "vinext-overlay-body",
				style: bodyStyle,
				children: [
					isBuildError ? /* @__PURE__ */ jsx(BuildErrorBlock, { message: error.message }) : /* @__PURE__ */ jsx("h2", {
						"data-testid": "vinext-dev-error-message",
						style: messageStyle,
						children: error.message
					}),
					error.codeFrame && !isBuildError ? /* @__PURE__ */ jsx(CodeFrame, {
						codeFrame: error.codeFrame,
						projectRoot: error.projectRoot
					}) : null,
					frames.length > 0 ? /* @__PURE__ */ jsxs("div", {
						"data-testid": "vinext-dev-error-stack-container",
						style: stackContainerStyle,
						children: [/* @__PURE__ */ jsxs("div", {
							style: stackHeaderStyle,
							children: [/* @__PURE__ */ jsxs("p", {
								style: stackTitleStyle,
								children: ["Call Stack", /* @__PURE__ */ jsx("span", {
									style: stackCountStyle,
									children: frames.length
								})]
							}), ignoredFramesTally > 0 ? /* @__PURE__ */ jsxs("button", {
								type: "button",
								"data-testid": "vinext-dev-error-ignored-frames-toggle",
								"data-vinext-ignored-frames-open": showIgnoredFrames,
								className: "vinext-overlay-ignored-frames-toggle",
								onClick: () => setShowIgnoredFrames((open) => !open),
								children: [`${showIgnoredFrames ? "Hide" : "Show"} ${ignoredFramesTally} ignore-listed frame(s)`, /* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									style: ignoredFramesToggleIconStyle,
									children: "↕"
								})]
							}) : null]
						}), /* @__PURE__ */ jsx("ol", {
							"data-testid": "vinext-dev-error-stack",
							style: stackListStyle,
							children: visibleFrames.map((frame) => /* @__PURE__ */ jsx(StackFrameRow, { frame }, frame.key))
						})]
					}) : null,
					error.componentStack ? /* @__PURE__ */ jsxs("details", {
						style: detailsStyle,
						children: [/* @__PURE__ */ jsx("summary", {
							style: summaryStyle,
							children: "Component stack"
						}), /* @__PURE__ */ jsx("pre", {
							"data-testid": "vinext-dev-error-component-stack",
							style: componentStackStyle,
							children: error.componentStack
						})]
					}) : null
				]
			})]
		})
	});
}
function BuildErrorBlock({ message }) {
	return /* @__PURE__ */ jsx("section", {
		"data-testid": "vinext-dev-error-build-message",
		style: buildErrorBlockStyle,
		children: /* @__PURE__ */ jsx("pre", {
			"data-testid": "vinext-dev-error-message",
			style: buildErrorPreStyle,
			children: message
		})
	});
}
function CopyErrorButton({ error, frames }) {
	const [copyState, setCopyState] = useState("idle");
	const label = copyState === "copied" ? "Error Info Copied" : copyState === "failed" ? "Copy Error Info Failed" : "Copy Error Info";
	useEffect(() => {
		if (copyState === "idle") return;
		const timer = window.setTimeout(() => setCopyState("idle"), 2e3);
		return () => window.clearTimeout(timer);
	}, [copyState]);
	return /* @__PURE__ */ jsx("button", {
		type: "button",
		"data-testid": "vinext-dev-error-copy",
		"data-vinext-copy-state": copyState,
		className: "vinext-overlay-copy",
		"aria-label": label,
		title: label,
		onClick: (event) => {
			event.stopPropagation();
			copyTextToClipboard(formatErrorInfoForClipboard(error, frames)).then((copied) => setCopyState(copied ? "copied" : "failed"));
		},
		children: /* @__PURE__ */ jsx("span", {
			"aria-hidden": "true",
			children: copyState === "copied" ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {})
		})
	});
}
function CopyIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "15",
		height: "15",
		viewBox: "0 0 15 15",
		fill: "none",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M5.5 4.5H11.5V12.5H5.5V4.5Z",
			stroke: "currentColor",
			strokeWidth: "1.4",
			strokeLinejoin: "round"
		}), /* @__PURE__ */ jsx("path", {
			d: "M3.5 9.5H2.5V2.5H8.5V3.5",
			stroke: "currentColor",
			strokeWidth: "1.4",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})]
	});
}
function CheckIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "15",
		height: "15",
		viewBox: "0 0 15 15",
		fill: "none",
		children: /* @__PURE__ */ jsx("path", {
			d: "M3.25 7.5L6.25 10.5L11.75 4.5",
			stroke: "currentColor",
			strokeWidth: "1.5",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
function CodeFrame({ codeFrame, projectRoot }) {
	const location = formatCodeFrameLocation(codeFrame, projectRoot);
	const openInEditorFile = `${fileUrlToPath(codeFrame.file)}:${codeFrame.line}:${codeFrame.column}`;
	return /* @__PURE__ */ jsxs("section", {
		"data-testid": "vinext-dev-error-code-frame",
		style: codeFrameContainerStyle,
		children: [/* @__PURE__ */ jsxs("header", {
			style: codeFrameHeaderStyle,
			children: [/* @__PURE__ */ jsx("span", {
				style: codeFrameLocationStyle,
				children: location
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				"data-vinext-open-in-editor": true,
				className: "vinext-overlay-code-frame-open",
				title: `Open ${openInEditorFile} in editor`,
				"aria-label": `Open ${openInEditorFile} in editor`,
				onClick: (event) => {
					event.stopPropagation();
					openViteEditor(openInEditorFile);
				},
				children: "↗"
			})]
		}), /* @__PURE__ */ jsx("pre", {
			className: "vinext-overlay-code-frame-pre",
			style: codeFramePreStyle,
			children: codeFrame.lines.map((line) => /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("span", {
				className: "vinext-overlay-code-frame-line",
				children: [/* @__PURE__ */ jsxs("span", {
					style: codeFrameGutterStyle,
					children: [
						/* @__PURE__ */ jsx("span", {
							style: line.isErrorLine ? codeFrameErrorMarkerStyle : void 0,
							children: line.isErrorLine ? ">" : " "
						}),
						String(line.line).padStart(3, " "),
						" |"
					]
				}), /* @__PURE__ */ jsx("span", { children: line.text || " " })]
			}), line.isErrorLine ? /* @__PURE__ */ jsxs("span", {
				style: codeFrameCaretLineStyle,
				children: [/* @__PURE__ */ jsx("span", {
					style: codeFrameGutterStyle,
					children: "     |"
				}), /* @__PURE__ */ jsxs("span", { children: [" ".repeat(Math.max(0, codeFrame.column - 1)), "^"] })]
			}) : null] }, line.line))
		})]
	});
}
function formatCodeFrameLocation(codeFrame, projectRoot) {
	const file = formatOverlayDisplayFile(codeFrame.file, projectRoot);
	const methodName = codeFrame.methodName ? ` @ ${codeFrame.methodName}` : "";
	return `${file}:${codeFrame.line}:${codeFrame.column}${methodName}`;
}
function StackFrameRow({ frame }) {
	const openInEditorFile = formatStackFrameLocation(frame);
	const displayFile = frame.displayFile ?? frame.file;
	const content = /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
		style: frameFnStyle,
		children: frame.fn
	}), displayFile ? /* @__PURE__ */ jsxs("span", {
		style: frameLocStyle,
		children: [
			displayFile,
			frame.line ? `:${frame.line}` : "",
			frame.col ? `:${frame.col}` : ""
		]
	}) : null] });
	if (!openInEditorFile) return /* @__PURE__ */ jsx("li", {
		className: "vinext-overlay-frame",
		"data-vinext-ignored-frame": frame.ignored || void 0,
		style: stackItemStyle,
		children: content
	});
	return /* @__PURE__ */ jsx("li", {
		className: "vinext-overlay-frame",
		"data-vinext-ignored-frame": frame.ignored || void 0,
		style: stackItemStyle,
		children: /* @__PURE__ */ jsx("button", {
			type: "button",
			"data-vinext-open-in-editor": true,
			className: "vinext-overlay-frame-button",
			style: stackFrameButtonStyle,
			title: `Open ${openInEditorFile} in editor`,
			"aria-label": `Open ${openInEditorFile} in editor`,
			onClick: (event) => {
				event.stopPropagation();
				openViteEditor(openInEditorFile);
			},
			children: content
		})
	});
}
const V8_PAREN_FRAME = /^(.*?)\s*\((.+):(\d+):(\d+)\)$/;
const V8_BARE_FRAME = /^(.+):(\d+):(\d+)$/;
const MOZ_FRAME = /^(.*?)@(.+):(\d+):(\d+)$/;
function parseStack(stack) {
	const frames = [];
	const lines = stack.split("\n").map((raw) => raw.trim()).filter(Boolean);
	const firstLineIsMessage = lines.length > 1 && !isStackFrameLine(lines[0]);
	const seen = /* @__PURE__ */ new Map();
	const pushFrame = (fn, file, line, col) => {
		const base = `${fn}@${file ?? ""}:${line ?? ""}:${col ?? ""}`;
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		const key = count === 1 ? base : `${base}#${count}`;
		frames.push({
			key,
			fn,
			file,
			line,
			col
		});
	};
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (index === 0 && firstLineIsMessage) continue;
		if (line.startsWith("at ")) {
			const body = line.slice(3);
			const parenMatch = body.match(V8_PAREN_FRAME);
			if (parenMatch) {
				pushFrame(parenMatch[1] || "<anonymous>", parenMatch[2], parenMatch[3], parenMatch[4]);
				continue;
			}
			const bareMatch = body.match(V8_BARE_FRAME);
			if (bareMatch) {
				pushFrame("<anonymous>", bareMatch[1], bareMatch[2], bareMatch[3]);
				continue;
			}
			pushFrame(body);
			continue;
		}
		const mozMatch = line.match(MOZ_FRAME);
		if (mozMatch) {
			pushFrame(mozMatch[1] || "<anonymous>", mozMatch[2], mozMatch[3], mozMatch[4]);
			continue;
		}
		pushFrame(line);
	}
	return frames;
}
function isStackFrameLine(line) {
	return line.startsWith("at ") || MOZ_FRAME.test(line);
}
function createDisplayStackFrame(frame, ignored, projectRoot) {
	const normalizedFrame = normalizeStackFrameLocation(frame);
	return {
		...frame,
		...normalizedFrame,
		...normalizedFrame.file ? { displayFile: formatOverlayDisplayFile(normalizedFrame.file, projectRoot) } : {},
		ignored
	};
}
function normalizeStackFrameLocation(frame) {
	if (!frame.file) return frame;
	return {
		...frame,
		file: fileUrlToPath(devirtualizeReactServerUrl(frame.file))
	};
}
function devirtualizeReactServerUrl(sourceUrl) {
	if (sourceUrl.startsWith("about://React/")) {
		const envIdx = sourceUrl.indexOf("/", 14);
		const suffixIdx = sourceUrl.lastIndexOf("?");
		if (envIdx > -1 && suffixIdx > -1) return sourceUrl.slice(envIdx + 1, suffixIdx);
	}
	return sourceUrl;
}
function fileUrlToPath(sourceUrl) {
	if (!sourceUrl.startsWith("file://")) return sourceUrl;
	try {
		const url = new URL(sourceUrl);
		if (url.protocol !== "file:") return sourceUrl;
		const pathname = decodeURIComponent(url.pathname);
		if (url.hostname) return `//${url.hostname}${pathname}`;
		return pathname.replace(/^\/([A-Za-z]:)/, "$1");
	} catch {
		return sourceUrl;
	}
}
function formatOverlayDisplayFile(file, projectRoot) {
	const normalizedFile = normalizeDisplayPath(fileUrlToPath(devirtualizeReactServerUrl(file)));
	const normalizedRoot = projectRoot ? stripTrailingDisplaySlash(normalizeDisplayPath(fileUrlToPath(projectRoot))) : void 0;
	if (!normalizedRoot) return normalizedFile;
	const fileForCompare = normalizeCaseForPathCompare(normalizedFile);
	const rootForCompare = normalizeCaseForPathCompare(normalizedRoot);
	if (fileForCompare === rootForCompare) return ".";
	const rootPrefix = `${rootForCompare}/`;
	if (!fileForCompare.startsWith(rootPrefix)) return normalizedFile;
	return normalizedFile.slice(normalizedRoot.length + 1);
}
function normalizeDisplayPath(file) {
	return file.replaceAll("\\", "/");
}
function stripTrailingDisplaySlash(file) {
	return file.replace(/\/+$/, "") || (file.startsWith("/") ? "/" : "");
}
function normalizeCaseForPathCompare(file) {
	return /^[A-Za-z]:\//.test(file) ? file.toLowerCase() : file;
}
function formatStackFrameLocation(frame) {
	if (!frame.file) return null;
	if (frame.line && frame.col) return `${frame.file}:${frame.line}:${frame.col}`;
	if (frame.line) return `${frame.file}:${frame.line}`;
	return frame.file;
}
function formatErrorInfoForClipboard(error, frames) {
	const sections = [`## Error Type\n\n${SOURCE_LABEL[error.source]}`, `## Error Message\n\n${error.message}`];
	const stackFrames = getClipboardStackFrames(frames);
	if (error.source !== "vite" && stackFrames.length > 0) sections.push(`## Stack\n\n${stackFrames.map(formatClipboardStackFrame).join("\n")}`);
	if (error.source !== "vite" && error.codeFrame) sections.push(`## Code Frame\n\n${formatClipboardCodeFrame(error.codeFrame, error.projectRoot)}`);
	if (error.componentStack) sections.push(`## Component Stack\n\n${error.componentStack.trim()}`);
	return sections.join("\n\n");
}
function getClipboardStackFrames(frames) {
	const visibleFrames = frames.filter((frame) => !frame.ignored);
	return visibleFrames.length > 0 ? visibleFrames : frames;
}
function formatClipboardStackFrame(frame) {
	const location = formatStackFrameLocation({
		file: frame.displayFile ?? frame.file,
		line: frame.line,
		col: frame.col
	});
	return location ? `    at ${frame.fn} (${location})` : `    at ${frame.fn}`;
}
async function copyTextToClipboard(text) {
	const clipboard = typeof navigator === "undefined" ? void 0 : navigator.clipboard;
	if (clipboard?.writeText) try {
		await clipboard.writeText(text);
		return true;
	} catch {}
	if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.readOnly = true;
	textarea.style.position = "fixed";
	textarea.style.top = "0";
	textarea.style.left = "0";
	textarea.style.width = "1px";
	textarea.style.height = "1px";
	textarea.style.opacity = "0";
	textarea.style.pointerEvents = "none";
	try {
		(document.body ?? document.documentElement).appendChild(textarea);
		textarea.focus();
		textarea.select();
		textarea.setSelectionRange(0, text.length);
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		textarea.remove();
	}
}
function formatClipboardCodeFrame(codeFrame, projectRoot) {
	const lineNumberWidth = Math.max(3, ...codeFrame.lines.map((line) => String(line.line).length));
	const lines = codeFrame.lines.flatMap((line) => {
		const formattedLine = `${line.isErrorLine ? ">" : " "} ${String(line.line).padStart(lineNumberWidth, " ")} | ${line.text}`;
		if (!line.isErrorLine) return [formattedLine];
		return [formattedLine, `  ${" ".repeat(lineNumberWidth)} | ${" ".repeat(Math.max(0, codeFrame.column - 1))}^`];
	});
	return [formatCodeFrameLocation(codeFrame, projectRoot), ...lines].join("\n");
}
function formatViteOpenInEditorFile(frame) {
	return formatStackFrameLocation(normalizeStackFrameLocation(frame));
}
function createViteOpenInEditorUrl(file, baseUrl = import.meta.url) {
	return new URL(`/__open-in-editor?file=${encodeURIComponent(file)}`, baseUrl).toString();
}
function openViteEditor(file) {
	if (typeof fetch !== "function") return;
	fetch(createViteOpenInEditorUrl(file)).catch(() => {});
}
async function resolveBrowserStackTrace(stack) {
	if (!stack || typeof window === "undefined" || typeof fetch !== "function") return { stack };
	try {
		const response = await fetch(VINEXT_ORIGINAL_STACK_TRACE_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stack })
		});
		if (!response.ok) return { stack };
		const payload = await response.json();
		const ignoredFrames = Array.isArray(payload.ignoredFrames) ? payload.ignoredFrames.filter((value) => typeof value === "boolean") : void 0;
		const codeFrame = parseOverlayCodeFrame(payload.codeFrame);
		return {
			stack: typeof payload.stack === "string" ? payload.stack : stack,
			ignoredFrames,
			...typeof payload.projectRoot === "string" && payload.projectRoot ? { projectRoot: payload.projectRoot } : {},
			...codeFrame ? { codeFrame } : {}
		};
	} catch {
		return { stack };
	}
}
function parseOverlayCodeFrame(value) {
	if (!value || typeof value !== "object") return void 0;
	const payload = value;
	const file = typeof payload.file === "string" ? payload.file : void 0;
	const line = typeof payload.line === "number" && Number.isInteger(payload.line) ? payload.line : void 0;
	const column = typeof payload.column === "number" && Number.isInteger(payload.column) ? payload.column : void 0;
	const rawLines = Array.isArray(payload.lines) ? payload.lines : void 0;
	if (!file || line === void 0 || column === void 0 || !rawLines) return;
	const lines = rawLines.map((rawLine) => {
		if (!rawLine || typeof rawLine !== "object") return null;
		const item = rawLine;
		if (typeof item.line !== "number" || !Number.isInteger(item.line) || typeof item.text !== "string") return null;
		return {
			line: item.line,
			text: item.text,
			isErrorLine: item.isErrorLine === true
		};
	}).filter((line) => line !== null);
	if (lines.length === 0) return void 0;
	return {
		file,
		line,
		column,
		...typeof payload.methodName === "string" && payload.methodName ? { methodName: payload.methodName } : {},
		lines
	};
}
const FONT_STACK = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const overlayStylesheet = `
#${DEV_ERROR_OVERLAY_MOUNT_ID} {
  color-scheme: dark;
  --vinext-overlay-backdrop: rgba(10, 10, 12, 0.55);
  --vinext-overlay-dialog-bg: #0a0a0a;
  --vinext-overlay-fg: #fafafa;
  --vinext-overlay-muted: #a1a1aa;
  --vinext-overlay-subtle: #71717a;
  --vinext-overlay-border: rgba(255, 255, 255, 0.08);
  --vinext-overlay-divider: rgba(255, 255, 255, 0.06);
  --vinext-overlay-hover: rgba(255, 255, 255, 0.08);
  --vinext-overlay-toggle-hover: rgba(255, 255, 255, 0.06);
  --vinext-overlay-focus: rgba(250, 250, 250, 0.65);
  --vinext-overlay-danger: #ef4444;
  --vinext-overlay-danger-fg: #fca5a5;
  --vinext-overlay-danger-bg: rgba(239, 68, 68, 0.12);
  --vinext-overlay-danger-muted-bg: rgba(239, 68, 68, 0.18);
  --vinext-overlay-danger-border: rgba(239, 68, 68, 0.25);
  --vinext-overlay-danger-strong-border: rgba(239, 68, 68, 0.45);
  --vinext-overlay-danger-strong-border-hover: rgba(239, 68, 68, 0.7);
  --vinext-overlay-success: #22c55e;
  --vinext-overlay-success-border: rgba(34, 197, 94, 0.4);
  --vinext-overlay-count-bg: rgba(255, 255, 255, 0.1);
  --vinext-overlay-count-fg: #d4d4d8;
  --vinext-overlay-code-bg: rgba(255, 255, 255, 0.03);
  --vinext-overlay-code-gutter: #71717a;
  --vinext-overlay-indicator-bg: #18181b;
  --vinext-overlay-indicator-bg-hover: #1f1f23;
  --vinext-overlay-scrollbar-thumb: rgba(161, 161, 170, 0.5);
  --vinext-overlay-scrollbar-thumb-hover: rgba(212, 212, 216, 0.65);
  --vinext-overlay-scrollbar-border: #0a0a0a;
}
@media (prefers-color-scheme: light) {
  #${DEV_ERROR_OVERLAY_MOUNT_ID} {
    color-scheme: light;
    --vinext-overlay-backdrop: rgba(39, 39, 42, 0.42);
    --vinext-overlay-dialog-bg: #ffffff;
    --vinext-overlay-fg: #18181b;
    --vinext-overlay-muted: #71717a;
    --vinext-overlay-subtle: #52525b;
    --vinext-overlay-border: rgba(24, 24, 27, 0.12);
    --vinext-overlay-divider: rgba(24, 24, 27, 0.08);
    --vinext-overlay-hover: rgba(24, 24, 27, 0.07);
    --vinext-overlay-toggle-hover: rgba(24, 24, 27, 0.055);
    --vinext-overlay-focus: rgba(24, 24, 27, 0.45);
    --vinext-overlay-danger: #dc2626;
    --vinext-overlay-danger-fg: #b91c1c;
    --vinext-overlay-danger-bg: rgba(220, 38, 38, 0.1);
    --vinext-overlay-danger-muted-bg: rgba(220, 38, 38, 0.1);
    --vinext-overlay-danger-border: rgba(220, 38, 38, 0.22);
    --vinext-overlay-danger-strong-border: rgba(220, 38, 38, 0.3);
    --vinext-overlay-danger-strong-border-hover: rgba(220, 38, 38, 0.45);
    --vinext-overlay-success: #16a34a;
    --vinext-overlay-success-border: rgba(22, 163, 74, 0.4);
    --vinext-overlay-count-bg: rgba(24, 24, 27, 0.08);
    --vinext-overlay-count-fg: #52525b;
    --vinext-overlay-code-bg: rgba(24, 24, 27, 0.025);
    --vinext-overlay-code-gutter: #71717a;
    --vinext-overlay-indicator-bg: #ffffff;
    --vinext-overlay-indicator-bg-hover: #f4f4f5;
    --vinext-overlay-scrollbar-thumb: rgba(113, 113, 122, 0.45);
    --vinext-overlay-scrollbar-thumb-hover: rgba(82, 82, 91, 0.62);
    --vinext-overlay-scrollbar-border: #ffffff;
  }
}
@keyframes vinextOverlayBackdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes vinextOverlayDialogIn {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes vinextOverlayIndicatorIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.vinext-overlay-nav {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px 8px;
  font-size: 14px;
  line-height: 1;
  border-radius: 6px;
  transition: background 0.12s ease;
}
.vinext-overlay-nav:hover:not(:disabled) {
  background: var(--vinext-overlay-hover);
}
.vinext-overlay-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.vinext-overlay-close {
  background: transparent;
  border: none;
  color: var(--vinext-overlay-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.12s ease, color 0.12s ease;
}
.vinext-overlay-close:hover {
  background: var(--vinext-overlay-hover);
  color: var(--vinext-overlay-fg);
}
.vinext-overlay-close { font-size: 20px; }
.vinext-overlay-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--vinext-overlay-border);
  border-radius: 999px;
  color: var(--vinext-overlay-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.vinext-overlay-copy:hover {
  background: var(--vinext-overlay-hover);
  color: var(--vinext-overlay-fg);
}
.vinext-overlay-copy:focus-visible {
  outline: 2px solid var(--vinext-overlay-focus);
  outline-offset: 2px;
}
.vinext-overlay-copy[data-vinext-copy-state="copied"] {
  color: var(--vinext-overlay-success);
  border-color: var(--vinext-overlay-success-border);
}
.vinext-overlay-copy > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.vinext-overlay-frame {
  padding: 8px 12px 8px 4px;
  border-radius: 6px;
}
.vinext-overlay-frame[data-vinext-ignored-frame="true"] {
  opacity: 0.58;
}
.vinext-overlay-frame-button {
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  cursor: pointer;
}
.vinext-overlay-frame-button:focus-visible {
  outline: 2px solid var(--vinext-overlay-focus);
  outline-offset: 3px;
}
.vinext-overlay-code-frame-line {
  display: flex;
  gap: 10px;
  min-width: max-content;
  padding: 0 10px;
}
.vinext-overlay-code-frame-open {
  all: unset;
  color: var(--vinext-overlay-muted);
  cursor: pointer;
  font: 600 13px ${FONT_STACK};
  line-height: 1;
  padding: 4px;
  border-radius: 6px;
}
.vinext-overlay-code-frame-open:hover {
  background: var(--vinext-overlay-hover);
  color: var(--vinext-overlay-fg);
}
.vinext-overlay-code-frame-open:focus-visible {
  outline: 2px solid var(--vinext-overlay-focus);
  outline-offset: 2px;
}
.vinext-overlay-body,
.vinext-overlay-code-frame-pre {
  scrollbar-width: thin;
  scrollbar-color: var(--vinext-overlay-scrollbar-thumb) transparent;
}
.vinext-overlay-body {
  scrollbar-gutter: stable both-edges;
}
.vinext-overlay-body::-webkit-scrollbar,
.vinext-overlay-code-frame-pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.vinext-overlay-body::-webkit-scrollbar-button,
.vinext-overlay-code-frame-pre::-webkit-scrollbar-button {
  display: none;
}
.vinext-overlay-body::-webkit-scrollbar-track,
.vinext-overlay-code-frame-pre::-webkit-scrollbar-track {
  background: transparent;
}
.vinext-overlay-body::-webkit-scrollbar-thumb,
.vinext-overlay-code-frame-pre::-webkit-scrollbar-thumb {
  min-height: 44px;
  background: var(--vinext-overlay-scrollbar-thumb);
  border-radius: 999px;
}
.vinext-overlay-body::-webkit-scrollbar-thumb:hover,
.vinext-overlay-code-frame-pre::-webkit-scrollbar-thumb:hover {
  background: var(--vinext-overlay-scrollbar-thumb-hover);
}
.vinext-overlay-body::-webkit-scrollbar-corner,
.vinext-overlay-code-frame-pre::-webkit-scrollbar-corner {
  background: transparent;
}
.vinext-overlay-ignored-frames-toggle {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--vinext-overlay-muted);
  font: 500 13px ${FONT_STACK};
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.vinext-overlay-ignored-frames-toggle:hover {
  background: var(--vinext-overlay-toggle-hover);
  color: var(--vinext-overlay-fg);
}
.vinext-overlay-ignored-frames-toggle:focus-visible {
  outline: 2px solid var(--vinext-overlay-focus);
  outline-offset: 2px;
}
.vinext-overlay-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--vinext-overlay-indicator-bg);
  color: var(--vinext-overlay-fg);
  border: 1px solid var(--vinext-overlay-danger-strong-border);
  font: 600 13px ${FONT_STACK};
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
  animation: vinextOverlayIndicatorIn 0.18s ease-out;
}
.vinext-overlay-indicator:hover {
  background: var(--vinext-overlay-indicator-bg-hover);
  border-color: var(--vinext-overlay-danger-strong-border-hover);
  transform: translateY(-1px);
}
`;
const backdropStyle = {
	position: "fixed",
	inset: "10vh 0 0",
	margin: 8,
	background: "transparent",
	display: "flex",
	alignItems: "center",
	flexDirection: "column",
	zIndex: 2147483646,
	animation: "vinextOverlayBackdropIn 0.15s ease-out"
};
const dialogStyle = {
	position: "relative",
	pointerEvents: "auto",
	boxSizing: "border-box",
	width: "min(960px, calc(100vw - 16px))",
	maxHeight: "min(80vh, 720px)",
	display: "flex",
	flexDirection: "column",
	background: "var(--vinext-overlay-dialog-bg)",
	color: "var(--vinext-overlay-fg)",
	border: "1px solid var(--vinext-overlay-border)",
	borderRadius: 12,
	fontFamily: FONT_STACK,
	fontSize: 14,
	lineHeight: 1.5,
	overflow: "hidden",
	animation: "vinextOverlayDialogIn 0.18s ease-out"
};
const indicatorContainerStyle = {
	position: "fixed",
	bottom: 16,
	left: 16,
	zIndex: 2147483646
};
const indicatorIconStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	color: "var(--vinext-overlay-danger)",
	fontSize: 14
};
const indicatorCountStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: 18,
	padding: "0 6px",
	height: 18,
	borderRadius: 999,
	background: "var(--vinext-overlay-danger-muted-bg)",
	color: "var(--vinext-overlay-danger-fg)",
	fontSize: 11,
	fontWeight: 600,
	fontVariantNumeric: "tabular-nums"
};
const headerStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 12,
	padding: "14px 19px 14px 16px"
};
const headerLeftStyle = {
	display: "flex",
	alignItems: "center",
	gap: 10,
	minWidth: 0
};
const headerActionsStyle = {
	display: "flex",
	alignItems: "center",
	gap: 8,
	flex: "0 0 auto"
};
const badgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	background: "var(--vinext-overlay-danger-bg)",
	color: "var(--vinext-overlay-danger-fg)",
	border: "1px solid var(--vinext-overlay-danger-border)",
	padding: "3px 10px",
	borderRadius: 999,
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: .2,
	textTransform: "uppercase",
	whiteSpace: "nowrap"
};
const paginationStyle = {
	display: "flex",
	alignItems: "center",
	gap: 2,
	color: "var(--vinext-overlay-muted)",
	fontSize: 12
};
const counterStyle = {
	padding: "0 4px",
	fontVariantNumeric: "tabular-nums"
};
const bodyStyle = {
	padding: "0 12px 20px",
	overflowX: "hidden",
	overflowY: "auto",
	flex: 1
};
const messageStyle = {
	margin: "0 4px 16px",
	fontFamily: MONO_STACK,
	fontSize: 16,
	fontWeight: 500,
	lineHeight: 1.45,
	color: "var(--vinext-overlay-fg)",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word"
};
const buildErrorBlockStyle = {
	margin: "0 -5px 18px",
	border: "1px solid var(--vinext-overlay-border)",
	borderRadius: 8,
	overflow: "hidden",
	background: "var(--vinext-overlay-code-bg)"
};
const buildErrorPreStyle = {
	margin: 0,
	padding: "12px 14px",
	overflow: "auto",
	fontFamily: MONO_STACK,
	fontSize: 13,
	lineHeight: 1.6,
	color: "var(--vinext-overlay-fg)",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word"
};
const codeFrameContainerStyle = {
	margin: "0 -5px 18px",
	border: "1px solid var(--vinext-overlay-border)",
	borderRadius: 8,
	overflow: "hidden",
	background: "var(--vinext-overlay-code-bg)"
};
const codeFrameHeaderStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 12,
	padding: "8px 10px 8px 8px",
	borderBottom: "1px solid var(--vinext-overlay-divider)",
	fontFamily: MONO_STACK,
	fontSize: 12
};
const codeFrameLocationStyle = {
	color: "var(--vinext-overlay-fg)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap"
};
const codeFramePreStyle = {
	margin: 0,
	padding: "10px 0",
	overflow: "auto",
	fontFamily: MONO_STACK,
	fontSize: 12,
	lineHeight: 1.6,
	color: "var(--vinext-overlay-muted)"
};
const codeFrameGutterStyle = {
	flex: "0 0 auto",
	color: "var(--vinext-overlay-code-gutter)",
	userSelect: "none"
};
const codeFrameErrorMarkerStyle = { color: "var(--vinext-overlay-danger)" };
const codeFrameCaretLineStyle = {
	display: "flex",
	gap: 10,
	minWidth: "max-content",
	padding: "0 10px",
	color: "var(--vinext-overlay-danger)"
};
const stackContainerStyle = {
	display: "flex",
	flexDirection: "column",
	gap: 4
};
const stackHeaderStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	minHeight: 28,
	padding: "0 4px 4px",
	gap: 12
};
const stackTitleStyle = {
	display: "inline-flex",
	alignItems: "center",
	gap: 8,
	margin: 0,
	color: "var(--vinext-overlay-fg)",
	fontFamily: FONT_STACK,
	fontSize: 15,
	fontWeight: 600,
	lineHeight: 1.4
};
const stackCountStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: 20,
	height: 20,
	padding: "0 6px",
	borderRadius: 999,
	background: "var(--vinext-overlay-count-bg)",
	color: "var(--vinext-overlay-count-fg)",
	fontSize: 11,
	fontWeight: 600,
	fontVariantNumeric: "tabular-nums"
};
const ignoredFramesToggleIconStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: 14,
	lineHeight: 1
};
const stackListStyle = {
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 2,
	fontFamily: MONO_STACK,
	fontSize: 12
};
const stackItemStyle = {
	display: "flex",
	flexDirection: "column",
	gap: 2,
	cursor: "default"
};
const stackFrameButtonStyle = {
	color: "inherit",
	font: "inherit"
};
const frameFnStyle = {
	color: "var(--vinext-overlay-fg)",
	fontWeight: 500
};
const frameLocStyle = {
	color: "var(--vinext-overlay-subtle)",
	fontSize: 11
};
const detailsStyle = {
	marginTop: 16,
	paddingTop: 12,
	borderTop: "1px solid var(--vinext-overlay-divider)",
	color: "var(--vinext-overlay-muted)",
	fontSize: 12
};
const summaryStyle = {
	cursor: "pointer",
	userSelect: "none",
	padding: "4px 0",
	color: "var(--vinext-overlay-muted)",
	fontWeight: 500
};
const componentStackStyle = {
	margin: "8px 0 0 0",
	fontFamily: MONO_STACK,
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	color: "var(--vinext-overlay-muted)"
};
//#endregion
export { DEV_ERROR_OVERLAY_HOST_ID, DEV_ERROR_OVERLAY_MOUNT_ID, createDevErrorOverlayMountNode, createViteOpenInEditorUrl, devOnCaughtError, devOnUncaughtError, dismissOverlay, formatErrorInfoForClipboard, formatOverlayDisplayFile, formatViteOpenInEditorFile, installDevErrorOverlay, installReactRefreshErrorRecovery, installViteHmrErrorHandler, normalizeViteHmrError, reportInitialDevServerErrors };
