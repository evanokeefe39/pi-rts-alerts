#!/usr/bin/env node

/**
 * Link pi types for local type-checking (optional).
 *
 * The extension ships with ambient type declarations in src/types/ so
 * `tsc --noEmit` works out of the box without the global pi install.
 *
 * For full type accuracy (e.g., when contributing to pi itself), you can
 * link the real types from a global pi installation:
 *
 *   npx symlink-dir "$(npm root -g)/@earendil-works" node_modules/@earendil-works
 *
 * This script auto-detects the global install and links it if available.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

function detectGlobalPi() {
	try {
		const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
		const pkgDir = path.join(globalRoot, "@earendil-works", "pi-coding-agent");
		if (fs.existsSync(path.join(pkgDir, "package.json"))) {
			return path.join(globalRoot, "@earendil-works");
		}
	} catch {}

	const home = process.env.HOME || process.env.USERPROFILE;
	const candidates = [
		path.join(home, ".pi", "agent", "npm", "node_modules", "@earendil-works"),
		process.env.APPDATA
			? path.join(process.env.APPDATA, "npm", "node_modules", "@earendil-works")
			: null,
	].filter(Boolean);

	for (const dir of candidates) {
		if (
			dir &&
			fs.existsSync(path.join(dir, "pi-coding-agent", "package.json"))
		) {
			return dir;
		}
	}
	return null;
}

function linkTypes(sourceDir) {
	const localDir = path.resolve("node_modules", "@earendil-works");

	if (fs.existsSync(path.join(localDir, "pi-coding-agent", "package.json"))) {
		return; // Already linked
	}

	fs.mkdirSync(path.dirname(localDir), { recursive: true });

	try {
		if (process.platform === "win32") {
			fs.rmSync(localDir, { recursive: true, force: true });
			execSync(`mklink /J "${localDir}" "${sourceDir}"`, {
				shell: "cmd.exe",
				stdio: "pipe",
			});
		} else {
			fs.symlinkSync(sourceDir, localDir, "dir");
		}
		console.log("🔗 Linked @earendil-works types from global install");
	} catch {
		console.log(
			"ℹ️  Could not link global pi types. Using bundled ambient declarations.",
		);
	}
}

function main() {
	// Check if we already have types from a postinstall
	if (
		fs.existsSync(
			path.resolve(
				"node_modules",
				"@earendil-works",
				"pi-coding-agent",
				"package.json",
			),
		)
	) {
		return;
	}

	const source = detectGlobalPi();
	if (source) {
		linkTypes(source);
	}
}

main();
