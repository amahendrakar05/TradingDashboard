import path from "./deps/.pnpm/pathslash@0.1.0/deps/pathslash/dist/index.js";
import { detectPackageManager, detectPackageManagerName, detectProject, ensureESModule, findViteConfigPath, hasViteConfig, renameCJSConfigs } from "./utils/project.js";
import { setupCloudflarePlatform, usesCommonJsViteConfig, validateCloudflarePlatformSetup } from "./init-cloudflare.js";
import { getReactUpgradeDeps } from "./utils/react-version.js";
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
//#region src/init.ts
/**
* vinext init — one-command project migration for Next.js apps.
*
* Automates the steps needed to run a Next.js app under vinext:
*
*   1. Run `vinext check` to show compatibility report
*   2. Add "type": "module" to package.json
*   3. Rename CJS config files to .cjs
*   4. Add vinext scripts to package.json
*   5. Generate vite.config.ts and platform files
*   6. Update .gitignore to include /dist/ and .vinext/
*   7. Install dependencies (vite, @vitejs/plugin-react, and App Router deps)
*   8. Print summary
*
* Non-destructive: does NOT modify next.config, tsconfig, or source files.
* The project should work with both Next.js and vinext simultaneously.
*/
const terminalStyle = {
	bold: (value) => process.stdout.isTTY ? `\x1b[1m${value}\x1b[0m` : value,
	cyan: (value) => process.stdout.isTTY ? `\x1b[36m${value}\x1b[0m` : value,
	green: (value) => process.stdout.isTTY ? `\x1b[32m${value}\x1b[0m` : value,
	yellow: (value) => process.stdout.isTTY ? `\x1b[33m${value}\x1b[0m` : value
};
function formatList(items, indent) {
	return items.map((item) => `${indent}- ${item}`).join("\n");
}
function isApproveBuildsError(error) {
	const details = [
		error instanceof Error ? error.message : String(error),
		typeof error === "object" && error && "output" in error ? String(error.output) : "",
		typeof error === "object" && error && "stdout" in error ? String(error.stdout) : "",
		typeof error === "object" && error && "stderr" in error ? String(error.stderr) : ""
	].join("\n");
	return /approve-builds|ERR_PNPM_.*BUILD/i.test(details) || /pnpm/i.test(details) && /(ignored build scripts|blocked build scripts)/i.test(details);
}
function hasAutomaticallyIgnoredBuilds(output) {
	const automaticallyIgnored = output.match(/Automatically ignored builds during installation:\s*\n([\s\S]*?)(?:\n\s*\n|$)/i)?.[1];
	if (!automaticallyIgnored) return false;
	return automaticallyIgnored.split("\n").map((line) => line.trim()).some((line) => line.length > 0 && !/^none\.?$/i.test(line) && !/^cannot identify\b/i.test(line));
}
function inspectPnpmIgnoredBuilds(root) {
	const result = spawnSync("pnpm", ["ignored-builds"], {
		cwd: root,
		encoding: "utf-8",
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
	return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}
function generateViteConfig(_isAppRouter, prerender = false) {
	return `import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [${prerender ? `vinext({ prerender: { routes: "*" } })` : "vinext()"}],
});
`;
}
/**
* Add vinext scripts to package.json without overwriting existing scripts.
* Returns the list of script names that were added.
*/
function addScripts(root, port, platform = "node", options = {}) {
	const pkgPath = path.join(root, "package.json");
	if (!fs.existsSync(pkgPath)) return [];
	try {
		const raw = fs.readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw);
		if (!pkg.scripts) pkg.scripts = {};
		const added = [];
		const addScript = (name, command) => {
			const scriptName = options.scriptNames === "standard" ? name : `${name}:vinext`;
			if (pkg.scripts[scriptName]) return;
			pkg.scripts[scriptName] = command;
			added.push(scriptName);
		};
		addScript("dev", port === false ? "vinext dev" : `vinext dev --port ${port}`);
		addScript("build", "vinext build");
		addScript("start", platform === "cloudflare" ? "wrangler dev --config dist/server/wrangler.json" : "vinext start");
		if (platform === "cloudflare") addScript("deploy", options.warmCdnCache ? "vinext-cloudflare deploy --config dist/server/wrangler.json --experimental-warm-cdn-cache" : "vinext-cloudflare deploy --config dist/server/wrangler.json");
		if (added.length > 0) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
		return added;
	} catch {
		return [];
	}
}
function getInitDependencyGroups(isAppRouter, platform) {
	const dependencies = ["vinext"];
	const devDependencies = ["vite", "@vitejs/plugin-react"];
	if (isAppRouter) {
		dependencies.push("react-server-dom-webpack");
		devDependencies.push("@vitejs/plugin-rsc");
	}
	if (platform === "cloudflare") {
		dependencies.push("@vinext/cloudflare");
		devDependencies.push("@cloudflare/vite-plugin", "wrangler");
	}
	return {
		dependencies,
		devDependencies
	};
}
function getInitDeps(isAppRouter, platform) {
	const groups = getInitDependencyGroups(isAppRouter, platform);
	return [...groups.dependencies, ...groups.devDependencies];
}
function isDepInstalled(root, dep) {
	const pkgPath = path.join(root, "package.json");
	if (!fs.existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
		return dep in {
			...pkg.dependencies,
			...pkg.devDependencies,
			...pkg.peerDependencies
		};
	} catch {
		return false;
	}
}
function parseDependencySpecifier(specifier) {
	if (specifier.startsWith("@")) {
		const versionSeparator = specifier.indexOf("@", 1);
		if (versionSeparator !== -1) return {
			name: specifier.slice(0, versionSeparator),
			version: specifier.slice(versionSeparator + 1),
			hasExplicitVersion: true
		};
		return {
			name: specifier,
			version: "latest",
			hasExplicitVersion: false
		};
	}
	const versionSeparator = specifier.indexOf("@");
	if (versionSeparator !== -1) return {
		name: specifier.slice(0, versionSeparator),
		version: specifier.slice(versionSeparator + 1),
		hasExplicitVersion: true
	};
	return {
		name: specifier,
		version: "latest",
		hasExplicitVersion: false
	};
}
function addDependencyEntries(root, deps, { dev }) {
	if (deps.length === 0) return [];
	const pkgPath = path.join(root, "package.json");
	if (!fs.existsSync(pkgPath)) return [];
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
	const targetKey = dev ? "devDependencies" : "dependencies";
	const target = pkg[targetKey] ??= {};
	const added = [];
	for (const dep of deps) {
		const { name, version, hasExplicitVersion } = parseDependencySpecifier(dep);
		const existingTarget = pkg.dependencies?.[name] !== void 0 ? pkg.dependencies : pkg.devDependencies?.[name] !== void 0 ? pkg.devDependencies : void 0;
		if (existingTarget) {
			if (!hasExplicitVersion || existingTarget[name] === version) continue;
			existingTarget[name] = version;
			added.push(name);
			continue;
		}
		target[name] = version;
		added.push(name);
	}
	if (added.length > 0) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
	return added;
}
/**
* Check if react/react-dom need upgrading for react-server-dom-webpack compatibility.
*
* react-server-dom-webpack versions are pinned to match their React version
* (e.g. rsdw@19.2.6 requires react@^19.2.6). When a project has an older
* React (e.g. create-next-app ships react@19.2.3), we need to upgrade
* react/react-dom BEFORE installing rsdw to avoid peer-dep conflicts.
*
* Uses createRequire to resolve react's package.json through Node's module
* resolution, which works correctly across all package managers (npm, pnpm,
* yarn, Yarn PnP) and monorepo layouts with hoisting/symlinking.
*
* Returns ["react@latest", "react-dom@latest"] if upgrade is needed, [] otherwise.
*/
async function installDeps(root, deps, exec, { dev = true } = {}) {
	if (deps.length === 0) return "";
	const baseCmd = detectPackageManager(root);
	return await exec(`${dev ? baseCmd : baseCmd.replace(/ -D$/, "")} ${deps.join(" ")}`, {
		cwd: root,
		stdio: "inherit"
	}) ?? "";
}
/**
* Ensure vinext-generated output directories are listed in .gitignore.
* Creates the file if it doesn't exist. Returns true if the file was modified
* (or created), false if all entries were already present.
*/
function updateGitignore(root, platform = "node") {
	const gitignorePath = path.join(root, ".gitignore");
	const entries = [
		{
			entry: "/dist/",
			coveredBy: /* @__PURE__ */ new Set([
				"/dist/",
				"/dist",
				"dist/",
				"dist"
			])
		},
		{
			entry: ".vinext/",
			coveredBy: /* @__PURE__ */ new Set([
				"/.vinext/",
				"/.vinext",
				".vinext/",
				".vinext"
			])
		},
		...platform === "cloudflare" ? [{
			entry: ".wrangler/",
			coveredBy: /* @__PURE__ */ new Set([
				"/.wrangler/",
				"/.wrangler",
				".wrangler/",
				".wrangler"
			])
		}] : []
	];
	let content = "";
	let lines = [];
	if (fs.existsSync(gitignorePath)) {
		content = fs.readFileSync(gitignorePath, "utf-8");
		lines = content.split("\n").map((l) => l.trim());
	}
	const missingEntries = entries.filter(({ coveredBy }) => !lines.some((line) => coveredBy.has(line))).map(({ entry }) => entry);
	if (missingEntries.length === 0) return false;
	const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(gitignorePath, content + separator + missingEntries.join("\n") + "\n", "utf-8");
	return true;
}
function setupNodePlatform(context) {
	if (context.viteConfigExists && !context.force) return {
		generatedViteConfig: false,
		skippedViteConfig: true,
		generatedPlatformFiles: [],
		nextSteps: []
	};
	fs.writeFileSync(context.existingViteConfigPath ?? path.join(context.root, "vite.config.ts"), generateViteConfig(context.isAppRouter, context.prerender), "utf-8");
	return {
		generatedViteConfig: true,
		skippedViteConfig: false,
		generatedPlatformFiles: [],
		nextSteps: []
	};
}
async function init(options) {
	const root = path.resolve(options.root);
	const port = options.port ?? 3001;
	if (!options.platform) throw new Error("A deployment platform must be selected before running vinext init.");
	const platform = options.platform;
	if (platform === "cloudflare" && !options.cloudflare) throw new Error("Cloudflare init options must be resolved before running vinext init.");
	const exec = options._exec ?? ((cmd, opts) => new Promise((resolve, reject) => {
		const child = spawn(cmd, {
			cwd: opts.cwd,
			shell: true,
			stdio: [
				"inherit",
				"pipe",
				"pipe"
			]
		});
		let output = "";
		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			output += text;
			process.stdout.write(text);
		});
		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			output += text;
			process.stderr.write(text);
		});
		child.on("error", (error) => reject(Object.assign(error, { output })));
		child.on("close", (status) => {
			if (status === 0) resolve(output);
			else reject(Object.assign(/* @__PURE__ */ new Error(`Command failed with exit code ${status}: ${cmd}`), {
				status,
				output
			}));
		});
	}));
	const pkgPath = path.join(root, "package.json");
	if (!fs.existsSync(pkgPath)) {
		console.error("  Error: No package.json found in the current directory.");
		console.error("  Run this command from the root of a Next.js project.\n");
		process.exit(1);
	}
	let existingViteConfigPath = findViteConfigPath(root);
	if (existingViteConfigPath?.endsWith("vite.config.js")) {
		const existingConfig = fs.readFileSync(existingViteConfigPath, "utf-8");
		const cjsPath = existingViteConfigPath.replace(/\.js$/, ".cjs");
		if (usesCommonJsViteConfig(existingViteConfigPath, existingConfig) && fs.existsSync(cjsPath)) throw new Error("Cannot rename CommonJS vite.config.js because vite.config.cjs already exists. Remove or consolidate one of the files, then rerun vinext init.");
	}
	const viteConfigExists = hasViteConfig(root);
	const isApp = detectProject(root).isAppRouter;
	const pmName = detectPackageManagerName(root);
	const shouldInstall = options.install ?? true;
	if (platform === "cloudflare") validateCloudflarePlatformSetup({
		root,
		isAppRouter: isApp,
		existingViteConfigPath,
		prerender: options.prerender,
		today: options._today
	}, options.cloudflare);
	if (!options.skipCheck) {
		console.log("  Running compatibility check...\n");
		const { runCheck, formatReport } = await import("./check.js");
		const checkResult = runCheck(root);
		console.log(formatReport(checkResult, { calledFromInit: true }));
		console.log();
	}
	const renamedConfigs = renameCJSConfigs(root);
	if (existingViteConfigPath?.endsWith("vite.config.js") && usesCommonJsViteConfig(existingViteConfigPath, fs.readFileSync(existingViteConfigPath, "utf-8"))) {
		const renamedPath = existingViteConfigPath.replace(/\.js$/, ".cjs");
		fs.renameSync(existingViteConfigPath, renamedPath);
		renamedConfigs.push([path.basename(existingViteConfigPath), path.basename(renamedPath)]);
		existingViteConfigPath = renamedPath;
	}
	const addedTypeModule = ensureESModule(root);
	const addedScripts = addScripts(root, port, platform, {
		warmCdnCache: options.cloudflare?.warmCdnCache ?? false,
		scriptNames: options.scriptNames
	});
	const setupContext = {
		root,
		isAppRouter: isApp,
		existingViteConfigPath,
		viteConfigExists,
		force: options.force ?? false,
		prerender: options.prerender,
		today: options._today
	};
	const platformSetup = platform === "cloudflare" ? setupCloudflarePlatform(setupContext, options.cloudflare) : setupNodePlatform(setupContext);
	const { generatedViteConfig, skippedViteConfig, generatedPlatformFiles } = platformSetup;
	const updatedGitignore = updateGitignore(root, platform);
	const neededDeps = getInitDependencyGroups(isApp, platform);
	const missingDependencies = neededDeps.dependencies.filter((dep) => !isDepInstalled(root, dep));
	const missingDevDependencies = neededDeps.devDependencies.filter((dep) => !isDepInstalled(root, dep));
	let dependencyInstallNeedsApproval = false;
	const dependencyEntriesAdded = [];
	const devDependencyEntriesAdded = [];
	if (isApp && missingDependencies.includes("react-server-dom-webpack")) {
		const reactUpgrade = getReactUpgradeDeps(root);
		if (reactUpgrade.length > 0) {
			console.log(`  ${terminalStyle.cyan(terminalStyle.bold("Upgrading dependencies:"))}`);
			console.log(formatList(reactUpgrade.map((dep) => dep.replace(/@latest$/, "")), "    "));
			try {
				if (shouldInstall) {
					if (isApproveBuildsError(await installDeps(root, reactUpgrade, exec, { dev: false }))) dependencyInstallNeedsApproval = true;
				} else {
					const added = addDependencyEntries(root, reactUpgrade, { dev: false });
					dependencyEntriesAdded.push(...added);
				}
			} catch (error) {
				if (pmName !== "pnpm" || !isApproveBuildsError(error)) throw error;
				dependencyInstallNeedsApproval = true;
			}
		}
	}
	if (missingDependencies.length > 0) {
		console.log(`  ${terminalStyle.cyan(terminalStyle.bold("Installing dependencies:"))}`);
		console.log(formatList(missingDependencies, "    "));
		try {
			if (shouldInstall) {
				const installOutput = await installDeps(root, missingDependencies, exec, { dev: false });
				dependencyEntriesAdded.push(...missingDependencies);
				if (isApproveBuildsError(installOutput)) dependencyInstallNeedsApproval = true;
			} else {
				const added = addDependencyEntries(root, missingDependencies, { dev: false });
				dependencyEntriesAdded.push(...added);
			}
		} catch (error) {
			if (pmName !== "pnpm" || !isApproveBuildsError(error)) throw error;
			dependencyInstallNeedsApproval = true;
		}
		console.log();
	}
	if (missingDevDependencies.length > 0) {
		console.log(`  ${terminalStyle.cyan(terminalStyle.bold("Installing devDependencies:"))}`);
		console.log(formatList(missingDevDependencies, "    "));
		try {
			if (shouldInstall) {
				const installOutput = await installDeps(root, missingDevDependencies, exec);
				devDependencyEntriesAdded.push(...missingDevDependencies);
				if (isApproveBuildsError(installOutput)) dependencyInstallNeedsApproval = true;
			} else {
				const added = addDependencyEntries(root, missingDevDependencies, { dev: true });
				devDependencyEntriesAdded.push(...added);
			}
		} catch (error) {
			if (pmName !== "pnpm" || !isApproveBuildsError(error)) throw error;
			dependencyInstallNeedsApproval = true;
		}
		console.log();
	}
	if (pmName === "pnpm" && shouldInstall && !dependencyInstallNeedsApproval && !options._exec && hasAutomaticallyIgnoredBuilds(inspectPnpmIgnoredBuilds(root))) dependencyInstallNeedsApproval = true;
	else if (pmName === "pnpm" && shouldInstall && !dependencyInstallNeedsApproval && options._inspectPnpmIgnoredBuilds && hasAutomaticallyIgnoredBuilds(options._inspectPnpmIgnoredBuilds(root))) dependencyInstallNeedsApproval = true;
	console.log(`  ${terminalStyle.green(terminalStyle.bold("vinext init complete!"))}\n`);
	if (dependencyEntriesAdded.length > 0) {
		console.log(`    ${terminalStyle.green("✓")} Added dependencies to dependencies:`);
		console.log(formatList(dependencyEntriesAdded, "      "));
	}
	if (devDependencyEntriesAdded.length > 0) {
		console.log(`    ${terminalStyle.green("✓")} Added dependencies to devDependencies:`);
		console.log(formatList(devDependencyEntriesAdded, "      "));
	}
	if (dependencyInstallNeedsApproval) console.log(`    ${terminalStyle.yellow("!")} Dependency installation is waiting for build-script approval`);
	if (addedTypeModule) console.log(`    ${terminalStyle.green("✓")} Added "type": "module" to package.json`);
	for (const [oldName, newName] of renamedConfigs) console.log(`    ${terminalStyle.green("✓")} Renamed ${oldName} \u2192 ${newName}`);
	for (const script of addedScripts) console.log(`    ${terminalStyle.green("✓")} Added ${script} script`);
	if (generatedViteConfig) console.log(`    ${terminalStyle.green("✓")} Generated vite.config.ts`);
	for (const file of generatedPlatformFiles) console.log(`    ${terminalStyle.green("✓")} Generated ${file}`);
	if (skippedViteConfig) console.log(`    ${terminalStyle.yellow("-")} Skipped vite.config.ts (already exists, use --force to overwrite)`);
	if (updatedGitignore) console.log(`    ${terminalStyle.green("✓")} Added vinext output directories to .gitignore`);
	const nextSteps = [...platformSetup.nextSteps];
	if (dependencyInstallNeedsApproval) nextSteps.push("Dependency installation is incomplete because pnpm blocked dependency build scripts:", "1. Review and approve the required build scripts:", "   pnpm approve-builds", "2. Finish installing dependencies:", "   pnpm install");
	const scriptName = (name) => options.scriptNames === "standard" ? name : `${name}:vinext`;
	const deployCommandStep = platform === "cloudflare" ? `    ${pmName} run ${scriptName("deploy")} Deploy to Cloudflare Workers\n` : "";
	const startCommandDescription = platform === "cloudflare" ? "Start the built Worker locally with Wrangler" : "Start vinext production server";
	console.log(`
  ${terminalStyle.cyan(terminalStyle.bold("Next steps:"))}
${nextSteps.map((step) => `    ${step}`).join("\n")}${nextSteps.length > 0 ? "\n" : ""}
    ${pmName} run ${scriptName("dev")}    Start the vinext dev server
    ${pmName} run ${scriptName("build")}  Build production output
    ${pmName} run ${scriptName("start")}  ${startCommandDescription}
${deployCommandStep}${options.scriptNames === "standard" ? "" : `    ${pmName} run dev           Start Next.js (still works as before)\n`}
`);
	return {
		installedDeps: [.../* @__PURE__ */ new Set([...dependencyEntriesAdded, ...devDependencyEntriesAdded])],
		addedTypeModule,
		renamedConfigs,
		addedScripts,
		generatedViteConfig,
		skippedViteConfig,
		updatedGitignore,
		platform,
		generatedPlatformFiles
	};
}
//#endregion
export { addScripts, generateViteConfig, getInitDependencyGroups, getInitDeps, getReactUpgradeDeps, init, isDepInstalled, updateGitignore };
