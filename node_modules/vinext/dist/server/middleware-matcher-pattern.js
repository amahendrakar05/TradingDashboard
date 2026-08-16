import { analyzeRegexSafety, regexAtomsMayOverlap } from "../utils/regex-safety.js";
import { middlewarePathTokensToRegExp, normalizeMiddlewarePathTokens, parseMiddlewarePath } from "./middleware-path-to-regexp.js";
//#region src/server/middleware-matcher-pattern.ts
const MATCHER_OBJECT_KEYS = /* @__PURE__ */ new Set([
	"source",
	"locale",
	"has",
	"missing"
]);
const CONDITION_TYPES_WITH_KEY = /* @__PURE__ */ new Set([
	"header",
	"query",
	"cookie"
]);
function invalidConditionReason(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return "has and missing entries must be objects";
	const condition = value;
	const type = condition.type;
	if (typeof type === "string" && CONDITION_TYPES_WITH_KEY.has(type)) {
		for (const key of Object.keys(condition)) if (key !== "type" && key !== "key" && key !== "value") return `condition contains unsupported field "${key}"`;
		if (typeof condition.key !== "string") return `condition type "${type}" requires a string key`;
		if (condition.value !== void 0 && typeof condition.value !== "string") return `condition type "${type}" requires value to be a string`;
		return null;
	}
	if (type === "host") {
		for (const key of Object.keys(condition)) if (key !== "type" && key !== "value") return `host condition contains unsupported field "${key}"`;
		return typeof condition.value === "string" ? null : "host condition requires a string value";
	}
	return "condition type must be header, query, cookie, or host";
}
function invalidConditionsReason(value, field) {
	if (value === void 0) return null;
	if (!Array.isArray(value)) return `${field} must be an array`;
	for (const condition of value) {
		const reason = invalidConditionReason(condition);
		if (reason) return `${field} ${reason}`;
	}
	return null;
}
function matcherObjectSource(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "matcher entries must be strings or objects" };
	const matcher = value;
	for (const key of Object.keys(matcher)) if (!MATCHER_OBJECT_KEYS.has(key)) return { error: `matcher object contains unsupported field "${key}"` };
	if (typeof matcher.source !== "string") return { error: "matcher object requires a string source" };
	if (matcher.locale !== void 0 && matcher.locale !== false) return { error: "matcher object locale must be false when provided" };
	const invalidHas = invalidConditionsReason(matcher.has, "has");
	if (invalidHas) return { error: invalidHas };
	const invalidMissing = invalidConditionsReason(matcher.missing, "missing");
	if (invalidMissing) return { error: invalidMissing };
	return { source: matcher.source };
}
function isValidMiddlewareMatcherObjectConfig(value) {
	return matcherObjectSource(value).error === void 0;
}
function patternMatches(pattern, value) {
	try {
		return new RegExp(`^(?:${pattern})$`).test(value);
	} catch {
		return false;
	}
}
function atomsOverlap(left, right) {
	return regexAtomsMayOverlap(left, right, true);
}
function groupCanMatchEmpty(group) {
	if (/^\?(?:[=!]|<[=!])/.test(group)) return true;
	return patternMatches(group.startsWith("?:") ? group.slice(2) : group, "");
}
function hasOverlappingSequentialRepetition(pattern) {
	const repeatedAtDepth = [[]];
	const groupStarts = [];
	let depth = 0;
	for (let index = 0; index < pattern.length; index++) {
		const character = pattern[index];
		if (character === "(") {
			groupStarts.push(index);
			depth++;
			repeatedAtDepth[depth] = [];
			if (pattern[index + 1] === "?") {
				index++;
				if (pattern[index + 1] === "<" && /[=!]/.test(pattern[index + 2] ?? "")) index += 2;
				else if (/[=:!]/.test(pattern[index + 1] ?? "")) index++;
			}
			continue;
		}
		if (character === ")") {
			const groupStart = groupStarts.pop();
			repeatedAtDepth[depth] = [];
			depth = Math.max(0, depth - 1);
			if (groupStart !== void 0) {
				const modifier = pattern[index + 1];
				if (!(modifier === "*" || modifier === "?" || modifier === "{" && /^\{0(?:,\d*)?\}/.test(pattern.slice(index + 1))) && !groupCanMatchEmpty(pattern.slice(groupStart + 1, index))) repeatedAtDepth[depth] = [];
			}
			continue;
		}
		if (character === "|") {
			repeatedAtDepth[depth] = [];
			continue;
		}
		if (character === "^" || character === "$") continue;
		if (character === "*" || character === "+" || character === "?" || character === "{") continue;
		let atom = character;
		if (character === "\\") {
			if (index + 1 >= pattern.length) return true;
			atom += pattern[++index];
		} else if (character === "[") {
			let classEnd = index + 1;
			if (pattern[classEnd] === "^") classEnd++;
			while (classEnd < pattern.length && pattern[classEnd] !== "]") {
				if (pattern[classEnd] === "\\") classEnd++;
				classEnd++;
			}
			if (classEnd >= pattern.length) return true;
			atom = pattern.slice(index, classEnd + 1);
			index = classEnd;
		} else if (character === ".") atom = ".";
		const quantifierStart = index + 1;
		const quantifier = pattern[quantifierStart];
		let unbounded = quantifier === "*" || quantifier === "+";
		let canBeEmpty = quantifier === "*";
		let quantifierEnd = quantifierStart;
		if (quantifier === "{") {
			const match = /^\{(\d+),\}/.exec(pattern.slice(quantifierStart));
			if (match) {
				unbounded = true;
				canBeEmpty = Number(match[1]) === 0;
				quantifierEnd += match[0].length - 1;
			}
		}
		if (!unbounded) {
			if (quantifier !== "?") repeatedAtDepth[depth] = [];
			if (quantifier === "?") index = quantifierStart;
			continue;
		}
		if (repeatedAtDepth[depth].some((previous) => atomsOverlap(previous, atom))) return true;
		repeatedAtDepth[depth] = canBeEmpty ? [...repeatedAtDepth[depth], atom] : [atom];
		index = quantifierEnd;
	}
	return false;
}
function unsafeTokenReason(token) {
	const regexSafetyIssue = analyzeRegexSafety(token.pattern, { ignoreCase: true });
	if (regexSafetyIssue) {
		if (regexSafetyIssue === "analysis budget exceeded") return `parameter "${token.name}" exceeds the regex analysis budget`;
		return `parameter "${token.name}" contains ${regexSafetyIssue}`;
	}
	if (hasOverlappingSequentialRepetition(token.pattern)) return `parameter "${token.name}" contains overlapping sequential repetition`;
	if (token.modifier !== "*" && token.modifier !== "+") return null;
	if (patternMatches(token.pattern, "") || patternMatches(token.pattern, "/")) return `repeated parameter "${token.name}" may match an empty value or path delimiter`;
	return null;
}
function validateTokens(tokens) {
	for (const token of tokens) {
		if (typeof token === "string") continue;
		const reason = unsafeTokenReason(token);
		if (reason) return reason;
	}
	return null;
}
function compileMiddlewareMatcherPattern(source) {
	if (!source.startsWith("/")) return {
		kind: "invalid",
		error: "source must start with /"
	};
	if (source.length > 4096) return {
		kind: "invalid",
		error: "source exceeds max built length of 4096"
	};
	let tokens;
	try {
		tokens = parseMiddlewarePath(source);
	} catch (error) {
		return {
			kind: "invalid",
			error: error instanceof Error ? error.message : "matcher could not be parsed"
		};
	}
	const unsafeReason = validateTokens(tokens);
	if (unsafeReason) return {
		kind: "unsafe",
		error: unsafeReason
	};
	try {
		return { regexp: middlewarePathTokensToRegExp(tokens) };
	} catch {
		const normalizedTokens = normalizeMiddlewarePathTokens(tokens);
		const normalizedUnsafeReason = validateTokens(normalizedTokens);
		if (normalizedUnsafeReason) return {
			kind: "unsafe",
			error: normalizedUnsafeReason
		};
		try {
			return { regexp: middlewarePathTokensToRegExp(normalizedTokens) };
		} catch (error) {
			return {
				kind: "invalid",
				error: error instanceof Error ? error.message : "matcher could not be compiled"
			};
		}
	}
}
function validateMiddlewareMatcherPatterns(value) {
	const sources = [];
	if (typeof value === "string") sources.push(value);
	else if (Array.isArray(value)) for (const matcher of value) if (typeof matcher === "string") sources.push(matcher);
	else {
		const result = matcherObjectSource(matcher);
		if (result.error) throw new Error(`Invalid middleware matcher config: ${result.error}.`);
		sources.push(result.source);
	}
	else throw new Error("Invalid middleware matcher config: matcher must be a string or an array of strings or objects.");
	for (const source of sources) {
		const result = compileMiddlewareMatcherPattern(source);
		if (result.regexp) continue;
		throw new Error(`Invalid middleware matcher "${source}": ${result.error}.`);
	}
}
//#endregion
export { compileMiddlewareMatcherPattern, isValidMiddlewareMatcherObjectConfig, validateMiddlewareMatcherPatterns };
