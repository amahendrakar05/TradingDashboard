"use client";
import { useCallback, useRef } from "react";
//#region src/shims/use-merged-ref.ts
function useMergedRef(refA, refB) {
	const cleanupA = useRef(null);
	const cleanupB = useRef(null);
	return useCallback((current) => {
		if (current === null) {
			const cleanupFnA = cleanupA.current;
			if (cleanupFnA) {
				cleanupA.current = null;
				cleanupFnA();
			}
			const cleanupFnB = cleanupB.current;
			if (cleanupFnB) {
				cleanupB.current = null;
				cleanupFnB();
			}
		} else {
			if (refA) cleanupA.current = applyRef(refA, current);
			if (refB) cleanupB.current = applyRef(refB, current);
		}
	}, [refA, refB]);
}
function applyRef(refA, current) {
	if (typeof refA === "function") {
		const cleanup = refA(current);
		if (typeof cleanup === "function") return cleanup;
		else return () => refA(null);
	} else {
		refA.current = current;
		return () => {
			refA.current = null;
		};
	}
}
//#endregion
export { useMergedRef };
