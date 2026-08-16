import { n as isAgent } from "./deps/.pnpm/am-i-vibing@0.5.0/deps/am-i-vibing/dist/detector-1yx2Hoe0.js";
import { createInterface } from "node:readline/promises";
//#region src/init-platform.ts
const INIT_PLATFORMS = {
	cloudflare: {
		name: "Cloudflare",
		options: resolveCloudflareInitOptions
	},
	node: {
		name: "Node",
		options: async () => void 0
	}
};
function isAgentEnvironment(env = process.env) {
	return isAgent({ env });
}
function parsePlatformArg(args) {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		let value;
		if (arg === "--platform") {
			value = args[index + 1];
			if (!value || value.startsWith("-")) throw new Error("--platform requires a value (cloudflare or node).");
		} else if (arg.startsWith("--platform=")) {
			value = arg.slice(11);
			if (!value) throw new Error("--platform requires a value (cloudflare or node).");
		}
		if (value) {
			if (value === "cloudflare" || value === "node") return value;
			throw new Error(`Unsupported platform "${value}". Expected cloudflare or node.`);
		}
	}
}
function parseChoiceArg(args, flag, choices, displayedChoices = choices) {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		let value;
		if (arg === flag) {
			value = args[index + 1];
			if (!value || value.startsWith("-")) throw new Error(`${flag} requires a value (${displayedChoices.join(" or ")}).`);
		} else if (arg.startsWith(`${flag}=`)) {
			value = arg.slice(flag.length + 1);
			if (!value) throw new Error(`${flag} requires a value (${displayedChoices.join(" or ")}).`);
		}
		if (value) {
			if (choices.includes(value)) return value;
			throw new Error(`Unsupported ${flag} value "${value}". Expected ${displayedChoices.join(" or ")}.`);
		}
	}
}
function parseDataCacheArg(args) {
	return parseChoiceArg(args, "--data-cache", ["kv", "none"]);
}
function parseCdnCacheArg(args) {
	return parseChoiceArg(args, "--cdn-cache", ["workers-cache", "data-cache"]);
}
function parseImageOptimizationArg(args) {
	return parseChoiceArg(args, "--image-optimization", ["cloudflare-images", "none"]);
}
function parsePrerenderArg(args) {
	return parseBooleanArg(args, "--prerender", "--no-prerender", "--prerender expects true or false when using the \"--prerender=value\" form.");
}
function parseWarmCdnCacheArg(args) {
	return parseBooleanArg(args, "--experimental-warm-cdn-cache", "--no-experimental-warm-cdn-cache", "--experimental-warm-cdn-cache expects true or false when using the \"--experimental-warm-cdn-cache=value\" form.");
}
function parseBooleanArg(args, enabledFlag, disabledFlag, errorMessage) {
	for (const arg of args) {
		if (arg === enabledFlag) return true;
		if (arg === disabledFlag) return false;
		if (!arg.startsWith(`${enabledFlag}=`)) continue;
		const value = arg.slice(enabledFlag.length + 1).toLowerCase();
		if (value === "true" || value === "yes" || value === "1") return true;
		if (value === "false" || value === "no" || value === "0") return false;
		throw new Error(errorMessage);
	}
}
async function resolveInitPlatform(args, options = {}) {
	const explicitPlatform = parsePlatformArg(args);
	if (explicitPlatform) return explicitPlatform;
	if (isAgentEnvironment(options.env ?? process.env)) throw new Error("vinext init needs a deployment target. Ask the user whether they want Cloudflare or Node, then re-run the command with --platform=cloudflare or --platform=node.");
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stdout;
	if (!(options.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY))) return "cloudflare";
	const readline = options.question ? void 0 : createInterface({
		input,
		output
	});
	const question = options.question ?? ((prompt) => readline.question(prompt));
	try {
		while (true) {
			const answer = (await question(`  Choose a deployment platform:
    1. ${INIT_PLATFORMS.cloudflare.name} (default)\n    2. ${INIT_PLATFORMS.node.name}\n  Platform [1]: `)).trim().toLowerCase();
			if (answer === "" || answer === "1" || answer === "cloudflare") {
				output.write("\n");
				return "cloudflare";
			}
			if (answer === "2" || answer === "node") {
				output.write("\n");
				return "node";
			}
			output.write("  Please choose Cloudflare (1) or Node (2).\n");
		}
	} finally {
		readline?.close();
	}
}
async function resolveInitOptions(args, options = {}) {
	const platform = await resolveInitPlatform(args, options);
	const platformOptions = await INIT_PLATFORMS[platform].options(args, options);
	const explicitWarmCdnCache = parseWarmCdnCacheArg(args);
	if (platform === "cloudflare" && platformOptions?.cdnCache !== "workers-cache") {
		if (explicitWarmCdnCache === true) throw new Error("--experimental-warm-cdn-cache requires --cdn-cache=workers-cache.");
	}
	const prerender = await resolveInitPrerender(args, options);
	const warmCdnCache = platform === "cloudflare" && platformOptions?.cdnCache === "workers-cache" ? await resolveInitWarmCdnCache(args, options) : false;
	return {
		platform,
		prerender,
		cloudflare: platform === "cloudflare" && platformOptions ? {
			...platformOptions,
			warmCdnCache
		} : void 0
	};
}
async function resolveInitPrerender(args, options = {}) {
	const explicitPrerender = parsePrerenderArg(args);
	if (explicitPrerender !== void 0) return explicitPrerender;
	const env = options.env ?? process.env;
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stdout;
	const isInteractive = options.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
	if (isAgentEnvironment(env) || !isInteractive) return false;
	const readline = options.question ? void 0 : createInterface({
		input,
		output
	});
	const question = options.question ?? ((prompt) => readline.question(prompt));
	try {
		while (true) {
			const answer = (await question("  Pre-render all static routes after build? [y/N]: ")).trim().toLowerCase();
			if (answer === "") {
				output.write("\n");
				return false;
			}
			if (answer === "y" || answer === "yes") {
				output.write("\n");
				return true;
			}
			if (answer === "n" || answer === "no") {
				output.write("\n");
				return false;
			}
			output.write("  Please answer yes or no.\n");
		}
	} finally {
		readline?.close();
	}
}
async function resolveInitWarmCdnCache(args, options = {}) {
	const explicitWarmCdnCache = parseWarmCdnCacheArg(args);
	if (explicitWarmCdnCache !== void 0) return explicitWarmCdnCache;
	const env = options.env ?? process.env;
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stdout;
	const isInteractive = options.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
	if (isAgentEnvironment(env) || !isInteractive) return false;
	const readline = options.question ? void 0 : createInterface({
		input,
		output
	});
	const question = options.question ?? ((prompt) => readline.question(prompt));
	try {
		while (true) {
			const answer = (await question("  Enable Workers Cache experimental pre-warm during deploy? [y/N]: ")).trim().toLowerCase();
			if (answer === "") {
				output.write("\n");
				return false;
			}
			if (answer === "y" || answer === "yes") {
				output.write("\n");
				return true;
			}
			if (answer === "n" || answer === "no") {
				output.write("\n");
				return false;
			}
			output.write("  Please answer yes or no.\n");
		}
	} finally {
		readline?.close();
	}
}
async function resolveCloudflareInitOptions(args, options = {}) {
	const explicitDataCache = parseDataCacheArg(args);
	const explicitCdnCache = parseCdnCacheArg(args);
	const explicitImageOptimization = parseImageOptimizationArg(args);
	if (explicitCdnCache && explicitDataCache && explicitImageOptimization) return {
		dataCache: explicitDataCache,
		cdnCache: explicitCdnCache,
		imageOptimization: explicitImageOptimization
	};
	if (isAgentEnvironment(options.env ?? process.env)) throw new Error("vinext init needs Cloudflare cache and image choices. Ask the user which CDN cache (workers-cache or data-cache), data cache (kv or none), and image optimization (cloudflare-images or none) they want, then re-run with --cdn-cache=..., --data-cache=..., and --image-optimization=....");
	const input = options.input ?? process.stdin;
	const output = options.output ?? process.stdout;
	if (!(options.isInteractive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY))) return {
		dataCache: explicitDataCache ?? "kv",
		cdnCache: explicitCdnCache ?? "workers-cache",
		imageOptimization: explicitImageOptimization ?? "cloudflare-images"
	};
	const readline = options.question ? void 0 : createInterface({
		input,
		output
	});
	const question = options.question ?? ((prompt) => readline.question(prompt));
	try {
		const promptChoice = async (current, prompt, values, defaultValue, error) => {
			if (current) return current;
			while (true) {
				const answer = (await question(prompt)).trim().toLowerCase();
				if (answer === "") {
					output.write("\n");
					return defaultValue;
				}
				const value = values[answer];
				if (value) {
					output.write("\n");
					return value;
				}
				output.write(`  ${error}\n`);
			}
		};
		const cdnCache = await promptChoice(explicitCdnCache, "  Choose a CDN cache:\n    1. Workers Cache (default)\n    2. Data cache\n  CDN cache [1]: ", {
			"1": "workers-cache",
			"workers-cache": "workers-cache",
			workers: "workers-cache",
			"2": "data-cache",
			"data-cache": "data-cache",
			data: "data-cache"
		}, "workers-cache", "Please choose Workers Cache (1) or Data cache (2).");
		return {
			dataCache: await promptChoice(explicitDataCache, "  Choose a data cache:\n    1. Cloudflare KV (default)\n    2. None\n  Data cache [1]: ", {
				"1": "kv",
				kv: "kv",
				"2": "none",
				none: "none"
			}, "kv", "Please choose Cloudflare KV (1) or None (2)."),
			cdnCache,
			imageOptimization: await promptChoice(explicitImageOptimization, "  Choose image optimization:\n    1. Cloudflare Images (default)\n    2. None\n  Image optimization [1]: ", {
				"1": "cloudflare-images",
				"cloudflare-images": "cloudflare-images",
				images: "cloudflare-images",
				"2": "none",
				none: "none"
			}, "cloudflare-images", "Please choose Cloudflare Images (1) or None (2).")
		};
	} finally {
		readline?.close();
	}
}
//#endregion
export { INIT_PLATFORMS, isAgentEnvironment, parseCdnCacheArg, parseDataCacheArg, parseImageOptimizationArg, parsePlatformArg, parsePrerenderArg, parseWarmCdnCacheArg, resolveCloudflareInitOptions, resolveInitOptions, resolveInitPlatform, resolveInitPrerender, resolveInitWarmCdnCache };
