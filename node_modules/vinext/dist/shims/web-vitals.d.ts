import { MetricType } from "web-vitals";

//#region src/shims/web-vitals.d.ts
type WebVitalsMetric = MetricType;
type ReportWebVitalsCallback = (metric: WebVitalsMetric) => void;
declare function useReportWebVitals(callback: ReportWebVitalsCallback): void;
//#endregion
export { type ReportWebVitalsCallback, type WebVitalsMetric, useReportWebVitals };