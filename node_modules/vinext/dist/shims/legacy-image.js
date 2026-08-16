import Image from "./image.js";
import "react";
import { jsx } from "react/jsx-runtime";
//#region src/shims/legacy-image.tsx
function LegacyImage(props) {
	const { layout = "intrinsic", objectFit, objectPosition, onLoadingComplete, onLoad, alt, width, height, style, lazyRoot: _lazyRoot, lazyBoundary: _lazyBoundary, ...rest } = props;
	const modernStyle = { ...style };
	if (objectFit) modernStyle.objectFit = objectFit;
	if (objectPosition) modernStyle.objectPosition = objectPosition;
	const handleLoad = onLoadingComplete ? (e) => {
		const img = e.currentTarget;
		onLoadingComplete({
			naturalWidth: img.naturalWidth,
			naturalHeight: img.naturalHeight
		});
		onLoad?.(e);
	} : onLoad;
	if (layout === "fill") return /* @__PURE__ */ jsx(Image, {
		alt: alt ?? "",
		fill: true,
		style: modernStyle,
		onLoad: handleLoad,
		...rest
	});
	if (layout === "responsive") {
		modernStyle.width = "100%";
		modernStyle.height = "auto";
	}
	return /* @__PURE__ */ jsx(Image, {
		alt: alt ?? "",
		width: typeof width === "string" ? parseInt(width, 10) : width,
		height: typeof height === "string" ? parseInt(height, 10) : height,
		style: modernStyle,
		onLoad: handleLoad,
		...rest
	});
}
//#endregion
export { LegacyImage as default };
