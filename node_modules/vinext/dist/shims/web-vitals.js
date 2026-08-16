import { useEffect, useRef } from "react";
import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from "web-vitals";
//#region src/shims/web-vitals.ts
function useReportWebVitals(callback) {
	const callbackRef = useRef(callback);
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);
	useEffect(() => {
		const reportWebVitals = (metric) => {
			callbackRef.current(metric);
		};
		onCLS(reportWebVitals);
		onFID(reportWebVitals);
		onLCP(reportWebVitals);
		onINP(reportWebVitals);
		onFCP(reportWebVitals);
		onTTFB(reportWebVitals);
	}, []);
}
//#endregion
export { useReportWebVitals };
