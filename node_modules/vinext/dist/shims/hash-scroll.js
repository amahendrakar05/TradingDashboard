//#region src/shims/hash-scroll.ts
function decodeHashFragment(fragment) {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return fragment;
	}
}
function scrollToHashTarget(hash) {
	const fragment = decodeHashFragment(hash.startsWith("#") ? hash.slice(1) : hash);
	if (fragment === "" || fragment === "top") {
		window.scrollTo(0, 0);
		return;
	}
	const idElement = document.getElementById(fragment);
	if (idElement) {
		idElement.scrollIntoView({ behavior: "auto" });
		return;
	}
	const namedElement = document.getElementsByName(fragment)[0];
	if (namedElement) {
		namedElement.scrollIntoView({ behavior: "auto" });
		return;
	}
	window.scrollTo(0, 0);
}
function scrollToHashTargetOnNextFrame(hash) {
	requestAnimationFrame(() => {
		scrollToHashTarget(hash);
	});
}
function retryScrollTo(x, y, opts) {
	const minFrames = opts?.minFrames ?? 0;
	const shouldContinue = opts?.shouldContinue ?? (() => true);
	let attempts = 0;
	const restore = () => {
		if (!shouldContinue()) return;
		window.scrollTo(x, y);
		const reachedTarget = Math.abs(window.scrollY - y) <= 1;
		if (!shouldContinue() || reachedTarget && attempts >= minFrames || attempts >= 60) return;
		attempts += 1;
		requestAnimationFrame(restore);
	};
	restore();
}
//#endregion
export { decodeHashFragment, retryScrollTo, scrollToHashTarget, scrollToHashTargetOnNextFrame };
