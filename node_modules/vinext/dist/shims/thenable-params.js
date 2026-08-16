import { createPprFallbackShellSuspensePromiseForState, getPprFallbackShellState } from "./ppr-fallback-shell.js";
//#region src/shims/thenable-params.ts
function hasParamProperty(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}
const wellKnownProperties = /* @__PURE__ */ new Set([
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toString",
	"valueOf",
	"toLocaleString",
	"then",
	"catch",
	"finally",
	"status",
	"value",
	"error",
	"displayName",
	"_debugInfo",
	"toJSON",
	"$$typeof",
	"__esModule",
	"@@iterator"
]);
function isWellKnownProperty(prop) {
	return wellKnownProperties.has(prop);
}
function observeParamKeys(observer, keys) {
	if (observer) observer.observeParamAccess(keys);
}
function observeAllParamKeys(observer, plain) {
	observeParamKeys(observer, Object.keys(plain));
}
function observeReadableParamKeys(observer, plain) {
	observeParamKeys(observer, Object.keys(plain).filter((key) => !isWellKnownProperty(key)));
}
function isPromiseContinuation(prop) {
	return prop === "then" || prop === "catch" || prop === "finally";
}
/**
* Build a proxy around `plain` that preserves fallback-key suspension.
* This is the value `await params` resolves to during fallback-shell
* prerendering. Known params are readable synchronously; fallback params
* suspend (throw a hanging promise) only when actually accessed.
*
* The handler is typed as `ProxyHandler<T>` and no cast is needed because
* the target is already `plain: T`.
*/
function createResolvedParamsProxy(plain, fallbackParamNames, observer, getFallbackShellPromise) {
	if (!fallbackParamNames || fallbackParamNames.size === 0) return plain;
	function isFallbackParam(prop) {
		return typeof prop === "string" && fallbackParamNames !== null && fallbackParamNames.has(prop);
	}
	return new Proxy(plain, {
		get(_target, prop, _receiver) {
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
				if (isFallbackParam(prop)) {
					const p = getFallbackShellPromise();
					if (p) throw p;
				}
				return Reflect.get(plain, prop);
			}
			return Reflect.get(plain, prop);
		},
		getOwnPropertyDescriptor(_target, prop) {
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
				if (isFallbackParam(prop)) return {
					configurable: true,
					enumerable: true,
					get() {
						const p = getFallbackShellPromise();
						if (p) throw p;
					}
				};
				return {
					configurable: true,
					enumerable: true,
					value: Reflect.get(plain, prop),
					writable: true
				};
			}
			return Reflect.getOwnPropertyDescriptor(plain, prop);
		},
		has(_target, prop) {
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			return Reflect.has(plain, prop) || !isWellKnownProperty(prop) && hasParamProperty(plain, prop);
		},
		ownKeys() {
			observeReadableParamKeys(observer, plain);
			return Reflect.ownKeys(plain).filter((prop) => !isWellKnownProperty(prop));
		}
	});
}
/**
* Wrap a `Promise<T>` with a proxy that also exposes param properties for
* synchronous access. TypeScript cannot prove this hybrid shape statically,
* so the single `as ThenableParams<T>` cast is isolated here.
*/
function createThenableParamsProxy(promise, handler) {
	return new Proxy(promise, handler);
}
function makeThenableParams(obj, observer) {
	const plain = { ...obj };
	const fallbackShellState = getPprFallbackShellState();
	const fallbackParamNames = fallbackShellState && Object.keys(plain).some((key) => fallbackShellState.fallbackParamNames.has(key)) ? fallbackShellState.fallbackParamNames : null;
	let fallbackShellPromise = null;
	let fallbackShellPromiseController = null;
	function getFallbackShellPromise() {
		if (!fallbackParamNames || !fallbackShellState) return null;
		if (fallbackShellPromise && fallbackShellPromiseController === fallbackShellState.abortController) return fallbackShellPromise;
		fallbackShellPromiseController = fallbackShellState.abortController;
		fallbackShellPromise = createPprFallbackShellSuspensePromiseForState(fallbackShellState, "`params`");
		return fallbackShellPromise;
	}
	const resolvedParams = createResolvedParamsProxy(plain, fallbackParamNames, observer, getFallbackShellPromise);
	const promise = Promise.resolve(resolvedParams);
	function isFallbackParam(prop) {
		return typeof prop === "string" && (fallbackParamNames?.has(prop) ?? false);
	}
	return createThenableParamsProxy(promise, {
		get(target, prop, receiver) {
			if (isPromiseContinuation(prop)) {
				const value = Reflect.get(target, prop, receiver);
				if (typeof value !== "function") return value;
				return (...args) => {
					if (!fallbackParamNames) observeAllParamKeys(observer, plain);
					return Reflect.apply(value, target, args);
				};
			}
			if (prop === "status" && observer?.observeReactPromiseStatus === true) observeAllParamKeys(observer, plain);
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
				if (isFallbackParam(prop)) {
					const p = getFallbackShellPromise();
					if (p) throw p;
				}
				return Reflect.get(plain, prop);
			}
			const value = Reflect.get(target, prop, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
		getOwnPropertyDescriptor(target, prop) {
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			if (!isWellKnownProperty(prop) && hasParamProperty(plain, prop)) {
				if (isFallbackParam(prop)) return {
					configurable: true,
					enumerable: true,
					get() {
						const p = getFallbackShellPromise();
						if (p) throw p;
					}
				};
				return {
					configurable: true,
					enumerable: true,
					value: Reflect.get(plain, prop),
					writable: true
				};
			}
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
		has(target, prop) {
			if (typeof prop === "string" && !isWellKnownProperty(prop)) observeParamKeys(observer, [prop]);
			return Reflect.has(target, prop) || !isWellKnownProperty(prop) && hasParamProperty(plain, prop);
		},
		ownKeys() {
			observeReadableParamKeys(observer, plain);
			return Reflect.ownKeys(plain).filter((prop) => !isWellKnownProperty(prop));
		}
	});
}
//#endregion
export { makeThenableParams };
