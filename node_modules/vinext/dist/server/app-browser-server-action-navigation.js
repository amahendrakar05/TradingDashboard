//#region src/server/app-browser-server-action-navigation.ts
function applyServerActionResultDecision(decision, clearCaches, performHardNavigation) {
	if (decision.kind !== "hardNavigate") return false;
	if (decision.clearClientNavigationCaches) clearCaches();
	performHardNavigation(decision.url, decision.historyMode);
	return true;
}
//#endregion
export { applyServerActionResultDecision };
